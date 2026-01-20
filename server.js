const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const backup = require('./src/backup.js');
const config = require('./src/config.js');
const trash = require('./src/trash.js');
const note = require('./src/note.js');

const PORT = process.env.PORT || 3000;

function getCachedPackageJson() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
  );
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(require('express-fileupload')());
app.use(express.static(path.join(__dirname, 'static')));

const projectClients = new Map();
const projectSpriteWatchers = new Map();
const projectWsClients = new Map();

function ensureProjectStructure(projectPath, projectName, options = {}) {
  const templatePath = path.join(__dirname, 'static', 'template');

  fs.mkdirSync(path.join(projectPath, 'ms'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'sprites'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });

  const templateIconPath = path.join(templatePath, 'icon.png');
  if (fs.existsSync(templateIconPath)) {
    fs.copyFileSync(templateIconPath, path.join(projectPath, 'sprites', 'icon.png'));
  }

  const templateFontPath = path.join(templatePath, 'BitCell.ttf');
  if (fs.existsSync(templateFontPath)) {
    fs.copyFileSync(templateFontPath, path.join(projectPath, 'assets', 'BitCell.ttf'));
  }

  const mainMsPath = path.join(projectPath, 'ms', 'main.ms');
  if (!fs.existsSync(mainMsPath)) {
    const templateMainMsPath = path.join(templatePath, 'main.ms');
    if (fs.existsSync(templateMainMsPath)) {
      fs.copyFileSync(templateMainMsPath, mainMsPath);
    } else {
      const mainMs = `init = function()
end

update = function()
end

draw = function()
  screen.clear()
  screen.drawText("Hello, World!", 0, 0, 12, "white")
end
`;
      fs.writeFileSync(mainMsPath, mainMs);
    }
  }

  if (options.createConfig !== false) {
    const projectConfig = config.createConfig(options.name || projectName, path.basename(projectPath), {
      orientation: options.orientation || 'any',
      aspect: options.aspect || 'free',
      spriteDirection: options.spriteDirection || 'vertical',
      spriteFrames: { 'icon.png': 1 },
    });
    config.write(projectPath, projectConfig);
  }
}

const mtimeCache = new Map();
const MTIME_CACHE_TTL = 5000;

function getLatestMtime(dir) {
  const cached = mtimeCache.get(dir);
  if (cached && Date.now() - cached.timestamp < MTIME_CACHE_TTL) {
    return cached.mtime;
  }

  let latest = 0;

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.mtimeMs > latest) {
      latest = stats.mtimeMs;
    }

    if (stats.isDirectory()) {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        walk(path.join(currentPath, entry.name));
      }
    }
  }

  walk(dir);

  mtimeCache.set(dir, { mtime: latest, timestamp: Date.now() });
  return latest;
}

async function getProjectLastUpdated(slug) {
  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) return null;
  const mtimeMs = getLatestMtime(projectPath);
  return mtimeMs > 0 ? new Date(mtimeMs) : null;
}

async function validatePath(slug, subdir, userPath) {
  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) return null;

  const basePath = path.resolve(projectPath, subdir);
  const resolved = path.resolve(basePath, userPath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

async function getProjects() {
  await config.cleanStaleProjects();
  const projects = await config.getAllProjects();

  const results = await Promise.all(
    projects.map(async (proj) => {
      const projectPath = proj.path;
      try {
        const projectConfig = await config.read(projectPath);
        const mtime = getLatestMtime(projectPath);
        const hasNote = note.noteExists(projectPath);
        return {
          name: projectConfig.meta.name,
          slug: projectConfig.meta.slug,
          orientation: projectConfig.settings.orientation,
          aspect: projectConfig.settings.aspect,
          projectPath: proj.path,
          lastUpdated: mtime > 0 ? new Date(mtime) : null,
          hasNote,
        };
      } catch (e) {
        console.warn(`Failed to read project.toml for ${proj.slug}:`, e.message);
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

async function getProjectFiles(slug) {
  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) return null;

  const msDir = path.join(projectPath, 'ms');
  const sources = [];
  if (fs.existsSync(msDir)) {
    const msFiles = fs.readdirSync(msDir, { recursive: true });
    for (const file of msFiles) {
      if (file.endsWith('.ms')) {
        const name = file.replace('.ms', '').replace(/\//g, '-');
        sources.push({
          file: file,
          name: name,
          version: Date.now(),
        });
      }
    }
  }

  const spritesDir = path.join(projectPath, 'sprites');
  const images = [];
  if (fs.existsSync(spritesDir)) {
    const spriteFiles = fs.readdirSync(spritesDir, { recursive: true });

    const projectConfig = await config.read(projectPath);
    const spriteDirection = projectConfig.sprites?.direction || 'vertical';

    let spriteProperties = {};
    for (const [key, value] of Object.entries(projectConfig.sprites || {})) {
      if (key !== 'direction') {
        spriteProperties[key] = { frames: value.frames, fps: 5 };
      }
    }

    for (const file of spriteFiles) {
      if (file.match(/\.(png|jpg|jpeg|gif)$/i)) {
        const imageObj = {
          file: file,
          version: Date.now(),
        };

        const baseName = path.basename(file).replace(/\.(png|jpg|jpeg|gif)$/i, '');
        if (spriteProperties[baseName]) {
          imageObj.properties = spriteProperties[baseName];
        } else if (spriteProperties[file]) {
          imageObj.properties = spriteProperties[file];
        } else {
          const pngPath = path.join(spritesDir, file);
          if (fs.existsSync(pngPath)) {
            try {
              const detectedFrames = config.detectSpriteFrames(pngPath, spriteDirection);
              imageObj.properties = { frames: detectedFrames, fps: 5 };
            } catch (err) {
              imageObj.properties = { frames: 1, fps: 5 };
            }
          } else {
            imageObj.properties = { frames: 1, fps: 5 };
          }
        }

        images.push(imageObj);
      }
    }
  }

  const mapsDir = path.join(projectPath, 'maps');
  const maps = [];
  if (fs.existsSync(mapsDir)) {
    const mapFiles = fs.readdirSync(mapsDir);
    for (const file of mapFiles) {
      if (file.endsWith('.json') || file.endsWith('.map')) {
        const name = file.replace(/\.(json|map)$/i, '').replace(/\//g, '-');
        maps.push({
          file: name + '.json',
          version: Date.now(),
        });
      }
    }
  }

  const soundsDir = path.join(projectPath, 'sounds');
  const sounds = [];
  if (fs.existsSync(soundsDir)) {
    const soundFiles = fs.readdirSync(soundsDir);
    for (const file of soundFiles) {
      if (file.match(/\.(wav|mp3|ogg)$/i)) {
        const name = file.replace(/\.(wav|mp3|ogg)$/i, '').replace(/\//g, '-');
        const ext = file.split('.').pop();
        sounds.push({
          file: name + '.' + ext,
          version: Date.now(),
        });
      }
    }
  }

  const musicDir = path.join(projectPath, 'music');
  const music = [];
  if (fs.existsSync(musicDir)) {
    const musicFiles = fs.readdirSync(musicDir);
    for (const file of musicFiles) {
      if (file.match(/\.(wav|mp3|ogg)$/i)) {
        const name = file.replace(/\.(wav|mp3|ogg)$/i, '').replace(/\//g, '-');
        const ext = file.split('.').pop();
        music.push({
          file: name + '.' + ext,
          version: Date.now(),
        });
      }
    }
  }

  const assetsDir = path.join(projectPath, 'assets');
  const assets = [];
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    for (const file of assetFiles) {
      if (file.match(/\.(json|glb|obj|jpg|ttf|wasm|txt|csv|md)$/i)) {
        const name = file
          .replace(/\.(json|glb|obj|jpg|ttf|wasm|txt|csv|md)$/i, '')
          .replace(/\//g, '-');
        assets.push({
          file: name + '.' + file.split('.').pop(),
          version: Date.now(),
        });
      }
    }
  }

  return { sources, images, maps, sounds, music, assets };
}

async function watchProject(slug) {
  if (projectClients.has(slug)) return;

  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) return;

  const msDir = path.join(projectPath, 'ms');
  if (!fs.existsSync(msDir)) return;

  const watcher = chokidar.watch(msDir, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', async (filePath) => {
    try {
      const fileName = path.basename(filePath);
      const content = await fs.promises.readFile(filePath, 'utf-8');

      broadcastToProject(slug, {
        type: 'update',
        file: fileName.replace('.ms', ''),
        code: content,
        version: Date.now(),
      });

      await config.touch(projectPath);
      broadcastToAllProjects();
    } catch (err) {
      console.error(`[Server] Error reading ${filePath}:`, err);
    }
  });

  projectClients.set(slug, watcher);
  watchSprites(slug);
}

async function handleSpriteChange(slug, event, filePath) {
  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) return;

  try {
    await config.syncSprites(projectPath);
    const spriteProps = config.getSpriteProperties(filePath, projectPath);
    const fileName = path.basename(filePath).replace(/\.(png|jpg|jpeg|gif)$/i, '');

    broadcastToProject(slug, {
      type: 'sprites',
      file: fileName,
      version: Date.now(),
      properties: spriteProps || { frames: 1 },
    });
  } catch (e) {
    console.error(`[Server] Error handling sprite change for ${slug}:`, e);
  }
}

async function watchSprites(slug) {
  if (projectSpriteWatchers.has(slug)) return;

  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) return;

  const spritesDir = path.join(projectPath, 'sprites');
  if (!fs.existsSync(spritesDir)) return;

  const watcher = chokidar.watch(spritesDir, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', (filePath) => handleSpriteChange(slug, 'add', filePath));
  watcher.on('unlink', (filePath) => handleSpriteChange(slug, 'unlink', filePath));
  watcher.on('change', (filePath) => handleSpriteChange(slug, 'change', filePath));

  projectSpriteWatchers.set(slug, watcher);
}

async function watchAllProjects() {
  const projects = await config.getAllProjects();
  for (const proj of projects) {
    await watchProject(proj.slug);
  }
}

function broadcastToProject(project, message) {
  const clients = getWSClients(project);
  const msg = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastToAllProjects() {
  const message = JSON.stringify({ type: 'projectListUpdated' });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function getWSClients(project) {
  const clients = projectWsClients.get(project);
  if (!clients) return [];
  return Array.from(clients).filter(client => client.readyState === WebSocket.OPEN);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const project = url.searchParams.get('project');
  ws.project = project;

  if (project) {
    watchProject(project);
    if (!projectWsClients.has(project)) {
      projectWsClients.set(project, new Set());
    }
    projectWsClients.get(project).add(ws);
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      const timestamp = new Date().toISOString();
      const projectTag = ws.project || 'unknown';

      if (msg.type === 'log') {
        console.log(`[${projectTag}] ${msg.data}`);
      } else if (msg.type === 'error') {
        console.error(`[${projectTag}] ${msg.data}`);
      }
    } catch (e) {
    }
  });

  ws.on('close', () => {
    if (ws.project && projectWsClients.has(ws.project)) {
      projectWsClients.get(ws.project).delete(ws);
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/api/projects', async (req, res) => {
  const projects = await getProjects();
  res.json(projects);
});

app.get('/api/project/:name', async (req, res) => {
  const slug = req.params.name;
  const projectPath = await config.getProjectPath(slug);

  if (!projectPath) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let projectConfig;
  try {
    projectConfig = await config.read(projectPath);
  } catch (e) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = await getProjectFiles(slug);
  const configData = {
    name: projectConfig.meta.name,
    slug: projectConfig.meta.slug,
    orientation: projectConfig.settings.orientation,
    aspect: projectConfig.settings.aspect,
    graphics: projectConfig.settings.graphics,
    spriteDirection: projectConfig.sprites.direction,
  };
  res.json({ ...configData, files });
});

app.get('/api/file/:project/*', async (req, res) => {
  const { project } = req.params;
  const file = req.params[0];
  const filePath = await validatePath(project, 'ms', file);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  } else {
    res.status(404).send('File not found');
  }
});

app.put('/api/project/:name/config', async (req, res) => {
  const oldSlug = req.params.name;
  const newConfig = req.body;

  const oldProjectPath = await config.getProjectPath(oldSlug);
  if (!oldProjectPath) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const newSlug = newConfig.slug || oldSlug;
  let newProjectPath = oldProjectPath;

  if (oldSlug !== newSlug) {
    newProjectPath = await config.generateDefaultProjectPath(newSlug);
    if (fs.existsSync(newProjectPath)) {
      return res
        .status(400)
        .json({ error: 'A project with this slug already exists' });
    }
  }

  try {
    const projectConfig = await config.read(oldProjectPath);
    projectConfig.meta.name = newConfig.name;
    projectConfig.meta.slug = newSlug;
    projectConfig.settings.orientation = newConfig.orientation;
    projectConfig.settings.aspect = newConfig.aspect;
    projectConfig.settings.graphics = newConfig.graphics;
    projectConfig.sprites.direction = newConfig.spriteDirection;
    projectConfig.meta.lastModified = new Date().toISOString().slice(0, 19) + 'Z';

    if (oldSlug !== newSlug) {
      fs.renameSync(oldProjectPath, newProjectPath);
      await config.removeProject(oldSlug);
      await config.addProject(newSlug, newProjectPath);
    }

    await config.write(newProjectPath, projectConfig);

    res.json({ success: true, slug: newSlug });
  } catch (e) {
    console.error('Failed to update project config:', e);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name, slug, orientation, aspect, spriteDirection, path: customPath } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  if (!slug || !slug.trim()) {
    return res.status(400).json({ error: 'Project slug is required' });
  }

  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    return res.status(400).json({ error: 'Slug can only contain lowercase letters, numbers, and hyphens' });
  }

  const registry = await config.readProjectsToml();
  const existingProject = registry.projects?.paths?.find(p => p.slug === slug);
  if (existingProject) {
    return res.status(400).json({ error: 'A project with this slug already exists', existingPath: existingProject.path });
  }

  if (!customPath || !customPath.trim()) {
    return res.status(400).json({ error: 'Project path is required' });
  }

  const isAbsolute = path.isAbsolute(customPath);
  if (!isAbsolute) {
    return res.status(400).json({ error: 'Path must be an absolute path' });
  }

  const parentDir = path.dirname(customPath);
  if (!fs.existsSync(parentDir)) {
    return res.status(400).json({ error: 'Parent directory does not exist', parentPath: parentDir });
  }

  const folderExists = fs.existsSync(customPath);

  let projectPath = customPath;

  try {
    ensureProjectStructure(projectPath, slug, {
      name: name,
      orientation: orientation || 'any',
      aspect: aspect || 'free',
      spriteDirection: spriteDirection || 'vertical',
    });

    await config.addProject(slug, projectPath);

    res.json({ success: true, slug: slug, path: projectPath });
  } catch (e) {
    console.error('Failed to create project:', e);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.post('/api/project/open', async (req, res) => {
  const { path: projectPath } = req.body;

  console.log('[Open Project] Received path:', projectPath);

  if (!projectPath) {
    console.log('[Open Project] No path provided');
    return res.status(400).json({ success: false, error: 'No path provided' });
  }

  if (!fs.existsSync(projectPath)) {
    console.log('[Open Project] Folder does not exist:', projectPath);
    return res.json({ success: false, error: 'Folder does not exist' });
  }

  const tomlPath = path.join(projectPath, 'project.toml');
  console.log('[Open Project] Checking for TOML at:', tomlPath);
  if (!fs.existsSync(tomlPath)) {
    return res.json({
      success: false,
      error: 'Missing project.toml - not a microRunner project',
    });
  }

  const msPath = path.join(projectPath, 'ms');
  console.log('[Open Project] Checking for ms/ at:', msPath);
  if (!fs.existsSync(msPath)) {
    return res.json({
      success: false,
      error: 'Missing ms/ directory - not a valid microRunner project',
    });
  }

  let projectConfig;
  try {
    projectConfig = await config.read(projectPath);
    console.log('[Open Project] Config loaded, slug:', projectConfig.meta?.slug);
  } catch (e) {
    console.log('[Open Project] Invalid TOML:', e.message);
    return res.json({
      success: false,
      error: 'Invalid project.toml format',
    });
  }

  const originalSlug = projectConfig.meta?.slug;
  if (!originalSlug) {
    return res.json({
      success: false,
      error: 'Missing slug in project.toml',
    });
  }

  async function generateUniqueSlug(baseSlug) {
    let counter = 1;
    let newSlug = baseSlug;
    while (await config.getProjectPath(newSlug)) {
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    return newSlug;
  }

  const existingPath = await config.getProjectPath(originalSlug);
  console.log('[Open Project] Existing path for slug:', existingPath);

  if (existingPath === projectPath) {
    console.log('[Open Project] Same project already registered');
    return res.json({ success: true, alreadyExists: true, slug: originalSlug });
  }

  if (existingPath) {
    console.log('[Open Project] Slug conflict, generating unique slug');
    const newSlug = await generateUniqueSlug(originalSlug);
    console.log('[Open Project] New slug:', newSlug);

    projectConfig.meta.slug = newSlug;
    try {
      await config.write(projectPath, projectConfig);
      console.log('[Open Project] Updated project.toml with new slug');
    } catch (e) {
      console.log('[Open Project] Failed to update project.toml:', e.message);
      return res.json({
        success: false,
        error: 'Failed to update project.toml: ' + e.message,
      });
    }

    await config.addProject(newSlug, projectPath);
    console.log('[Open Project] Added project with new slug:', newSlug);

    return res.json({
      success: true,
      slugChanged: true,
      oldSlug: originalSlug,
      newSlug: newSlug,
    });
  }

  await config.addProject(originalSlug, projectPath);
  console.log('[Open Project] Successfully added project:', originalSlug);

  res.json({ success: true, slug: originalSlug });
});

app.delete('/api/project/:name', async (req, res) => {
  const slug = req.params.name;
  const projectPath = await config.getProjectPath(slug);

  if (!projectPath) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    await trash.moveToTrash(projectPath, slug);
    await config.removeProject(slug);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete project:', e);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.post('/api/project/config', async (req, res) => {
  const { slug, newName, newSlug, orientation, aspect, spriteDirection } = req.body;

  if (!slug || !newName || !newSlug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (slug !== newSlug) {
    const registry = await config.readProjectsToml();
    const existing = registry.projects?.paths?.find(p => p.slug === newSlug);
    if (existing) {
      return res.status(400).json({ error: 'A project with this slug already exists' });
    }
  }

  const projectPath = await config.getProjectPath(slug);
  if (!projectPath) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const projectTomlPath = path.join(projectPath, 'project.toml');

  try {
    const projectConfig = await config.read(projectTomlPath);

    projectConfig.name = newName;
    projectConfig.orientation = orientation;
    projectConfig.aspect = aspect;
    projectConfig.spriteDirection = spriteDirection;

    if (slug !== newSlug) {
      projectConfig.slug = newSlug;
      await config.updateProjectSlug(slug, newSlug);
    }

    await config.write(projectTomlPath, projectConfig);

    res.json({ success: true });
  } catch (e) {
    console.error('Failed to save config:', e);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.post('/api/project/:name/duplicate', async (req, res) => {
  const slug = req.params.name;
  const { name, path, orientation, aspect, spriteDirection } = req.body;

  try {
    const options = {};
    if (name) options.name = name;
    if (path) options.path = path;
    if (orientation) options.orientation = orientation;
    if (aspect) options.aspect = aspect;
    if (spriteDirection) options.spriteDirection = spriteDirection;

    const result = await backup.duplicateProject(slug, options);
    res.json(result);
  } catch (e) {
    console.error('Failed to duplicate project:', e);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

app.get('/api/project/:name/duplicate/preview', async (req, res) => {
  const slug = req.params.name;

  try {
    const result = await backup.getDuplicatePreview(slug);
    res.json(result);
  } catch (e) {
    console.error('Failed to get duplicate preview:', e);
    res.status(500).json({ error: 'Failed to get duplicate preview' });
  }
});

app.get('/api/sprite/:project/*', async (req, res) => {
  const { project } = req.params;
  const spritePath = req.params[0];
  const filePath = await validatePath(project, 'sprites', spritePath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Sprite not found');
  }
});

app.get('/api/map/:project/*', async (req, res) => {
  const { project } = req.params;
  const mapPath = req.params[0];
  const filePath = await validatePath(project, 'maps', mapPath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Map not found');
  }
});

app.get('/api/sound/:project/*', async (req, res) => {
  const { project } = req.params;
  const soundPath = req.params[0];
  let filePath = await validatePath(project, 'sounds', soundPath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    const ext = soundPath.split('.').pop();
    if (ext !== 'wav' && ext !== 'mp3' && ext !== 'ogg') {
      const basePath = soundPath.replace(/\.(wav|mp3|ogg)$/i, '');
      for (const tryExt of ['wav', 'mp3', 'ogg']) {
        const tryPath = await validatePath(
          project,
          'sounds',
          basePath + '.' + tryExt,
        );
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send('Sound not found');
  }
});

app.get('/api/music/:project/*', async (req, res) => {
  const { project } = req.params;
  const musicPath = req.params[0];
  let filePath = await validatePath(project, 'music', musicPath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    const ext = musicPath.split('.').pop();
    if (ext !== 'wav' && ext !== 'mp3' && ext !== 'ogg') {
      const basePath = musicPath.replace(/\.(wav|mp3|ogg)$/i, '');
      for (const tryExt of ['wav', 'mp3', 'ogg']) {
        const tryPath = await validatePath(project, 'music', basePath + '.' + tryExt);
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send('Music not found');
  }
});

app.get('/api/assets/:project/*', async (req, res) => {
  const { project } = req.params;
  const assetPath = req.params[0];
  const filePath = await validatePath(project, 'assets', assetPath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Asset not found');
  }
});

app.post('/api/project/:name/backup', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await backup.createBackup(name);
    res.json({
      success: true,
      fileName: result.fileName,
      timestamp: result.timestamp,
    });
  } catch (e) {
    console.error('Failed to create backup:', e);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/api/project/:name/export', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await backup.createExport(name);
    res.download(result.filePath, result.fileName, (err) => {
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }
    });
  } catch (e) {
    console.error('Failed to export project:', e);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

app.get('/api/project/:name/backups', async (req, res) => {
  const { name } = req.params;
  try {
    const backups = await backup.listBackups(name);
    res.json(backups);
  } catch (e) {
    console.error('Failed to list backups:', e);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.delete('/api/project/:name/backups/:file', async (req, res) => {
  const { name, file } = req.params;
  try {
    await backup.deleteBackup(name, file);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete backup:', e);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

app.get('/api/project/:name/backups/:file/download', async (req, res) => {
  const { name, file } = req.params;
  try {
    const filePath = await backup.getBackupPath(name, file);
    if (fs.existsSync(filePath)) {
      res.download(filePath, file);
    } else {
      res.status(404).json({ error: 'Backup file not found' });
    }
  } catch (e) {
    console.error('Failed to download backup:', e);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

app.post('/api/project/:name/restore', async (req, res) => {
  const { name } = req.params;
  const { backupFile, createPreRestoreBackup } = req.body;

  if (!backupFile) {
    return res.status(400).json({ error: 'Backup file is required' });
  }

  try {
    const result = await backup.restoreProject(name, backupFile, {
      createPreRestoreBackup: createPreRestoreBackup,
    });
    res.json(result);
  } catch (e) {
    console.error('Failed to restore backup:', e);
    res.status(500).json({ error: 'Failed to restore backup: ' + e.message });
  }
});

app.post('/api/project/:name/restore-upload', async (req, res) => {
  const { name } = req.params;

  if (!req.files || !req.files.backup) {
    return res.status(400).json({ error: 'No backup file uploaded' });
  }

  const backupFile = req.files.backup;
  const tempPath = path.join(__dirname, 'temp_upload_' + Date.now() + '.zip');

  try {
    await backupFile.mv(tempPath);

    await backup.restoreProjectFromUpload(name, tempPath, {
      createPreRestoreBackup: true,
    });

    fs.unlinkSync(tempPath);

    res.json({ success: true });
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('Failed to restore from uploaded backup:', e);
    res.status(500).json({ error: 'Failed to restore backup: ' + e.message });
  }
});

app.post('/api/import-project', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedFile = req.files.file;
  const { path: customPath, name, slug, orientation, aspect, spriteDirection } = req.body;
  const tempPath = path.join(__dirname, 'temp_import_' + Date.now() + '.zip');

  try {
    await uploadedFile.mv(tempPath);

    const options = customPath ? { customPath } : {};
    if (name) options.name = name;
    if (slug) options.slug = slug;
    if (orientation) options.orientation = orientation;
    if (aspect) options.aspect = aspect;
    if (spriteDirection) options.spriteDirection = spriteDirection;

    const result = await backup.importProjectFromArchive(tempPath, options);

    fs.unlinkSync(tempPath);

    res.json(result);
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('Failed to import project:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import-project/preview', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedFile = req.files.file;
  const tempPath = path.join(__dirname, 'temp_import_preview_' + Date.now() + '.zip');

  try {
    await uploadedFile.mv(tempPath);

    const result = await backup.previewProjectFromArchive(tempPath);

    fs.unlinkSync(tempPath);

    res.json(result);
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('Failed to preview project:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/project/:name/backups/upload', async (req, res) => {
  const { name } = req.params;

  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedFile = req.files.file;
  const tempPath = path.join(
    __dirname,
    'temp_backup_upload_' + Date.now() + '.zip',
  );

  try {
    await uploadedFile.mv(tempPath);

    const result = await backup.uploadBackupToArchive(name, tempPath);

    fs.unlinkSync(tempPath);

    res.json(result);
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('Failed to upload backup:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/project/:name/backups/:file/note', async (req, res) => {
  const { name, file } = req.params;
  try {
    const note = await backup.getBackupNote(name, file);
    res.json({ note });
  } catch (e) {
    console.error('Failed to get note:', e);
    res.status(500).json({ error: 'Failed to get note' });
  }
});

app.put('/api/project/:name/backups/:file/note', async (req, res) => {
  const { name, file } = req.params;
  const { note } = req.body;
  try {
    await backup.saveBackupNote(name, file, note || '');
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to save note:', e);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

app.delete('/api/project/:name/backups/:file/note', async (req, res) => {
  const { name, file } = req.params;
  try {
    await backup.deleteBackupNote(name, file);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete note:', e);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.get('/api/project/:name/note', async (req, res) => {
  const { name } = req.params;
  try {
    const projectPath = await config.getProjectPath(name);
    if (!projectPath) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const content = await note.readNote(projectPath);
    res.json({ note: content });
  } catch (e) {
    console.error('Failed to read note:', e);
    res.status(500).json({ error: 'Failed to read note' });
  }
});

app.put('/api/project/:name/note', async (req, res) => {
  const { name } = req.params;
  const { note: noteContent } = req.body;
  try {
    const projectPath = await config.getProjectPath(name);
    if (!projectPath) {
      return res.status(404).json({ error: 'Project not found' });
    }
    await note.writeNote(projectPath, noteContent || '');
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to save note:', e);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

app.delete('/api/project/:name/note', async (req, res) => {
  const { name } = req.params;
  try {
    const projectPath = await config.getProjectPath(name);
    if (!projectPath) {
      return res.status(404).json({ error: 'Project not found' });
    }
    await note.deleteNote(projectPath);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete note:', e);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.get('/:project', (req, res) => {
  const project = req.params.project;
  if (project === 'api' || project === 'static' || project.startsWith('api.') || project === 'favicon.ico') {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'static', 'game.html'));
});

app.get('/api/default-path', async (req, res) => {
  const { name } = req.query;
  const baseName = name || 'Project';
  const slug = baseName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const defaultPath = await config.generateDefaultProjectPath(slug);
  res.json({ path: defaultPath });
});

app.get('/api/unique-folder-name', async (req, res) => {
  const { slug } = req.query;
  if (!slug) {
    return res.json({ folderName: 'Project' });
  }
  const folderName = config.generateUniqueFolderName(slug);
  res.json({ folderName });
});

app.get('/api/slug-exists', async (req, res) => {
  const { slug } = req.query;
  if (!slug) {
    return res.json({ exists: false });
  }
  const registry = await config.readProjectsToml();
  const exists = registry.projects?.paths?.some(p => p.slug === slug);
  res.json({ exists, slug });
});

app.get('/api/documents-path', async (req, res) => {
  const documentsPath = config.getDocumentsPath();
  res.json({ path: documentsPath });
});

app.get('/api/system/pick-folder', (req, res) => {
  const platform = process.platform;
  let command = '';

  if (platform === 'darwin') {
    command = 'osascript -e \'POSIX path of (choose folder with prompt "Choose project folder")\'';
  } else if (platform === 'win32') {
    command = 'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = \'Choose project folder\'; $f.ShowNewFolderButton = $true; if($f.ShowDialog() -eq \'OK\') { $f.SelectedPath }"';
  } else if (platform === 'linux') {
    command = 'if command -v zenity >/dev/null; then zenity --file-selection --directory --title="Choose project folder"; elif command -v kdialog >/dev/null; then kdialog --getexistingdirectory . --title="Choose project folder"; else echo "NO_TOOL"; fi';
  } else {
    command = 'echo "NO_TOOL"';
  }

  exec(command, (error, stdout, stderr) => {
    const output = stdout.trim();

    if (error || output === 'NO_TOOL' || !output) {
      return res.json({ path: null, cancelled: true, error: output === 'NO_TOOL' ? 'Missing zenity or kdialog' : null });
    }

    const normalizedPath = path.normalize(output);
    res.json({ path: normalizedPath, cancelled: false });
  });
});

const GITHUB_REPO = 'Nascir/microrunner';

app.get('/api/version', (req, res) => {
  const pkg = getCachedPackageJson();
  const currentVersion = pkg.version;
  const updateConfig = pkg.update || { repository: 'Nascir/microrunner', branch: 'main' };
  const repo = updateConfig.repository;
  const branch = updateConfig.branch || 'main';

  const https = require('https');
  https
    .get(
      `https://raw.githubusercontent.com/${repo}/${branch}/package.json`,
      {
        headers: {
          'User-Agent': 'microRunner',
        },
        timeout: 10000,
      },
      (response) => {
        if (response.statusCode !== 200) {
          return res.json({
            current: currentVersion,
            latest: currentVersion,
            hasUpdate: false,
            downloadUrl: null,
            error: response.statusCode === 404 ? 'Not found' : 'Connection failed',
          });
        }

        let data = '';
        response.on('data', (chunk) => (data += chunk));
        response.on('end', () => {
          try {
            const remotePkg = JSON.parse(data);
            const latestVersion = remotePkg.version || currentVersion;
            res.json({
              current: currentVersion,
              latest: latestVersion,
              hasUpdate: latestVersion !== currentVersion,
              downloadUrl: `https://github.com/${repo}/archive/${branch}.zip`,
            });
          } catch (e) {
            res.json({
              current: currentVersion,
              latest: currentVersion,
              hasUpdate: false,
              downloadUrl: null,
              error: 'Failed to parse remote package.json',
            });
          }
        });
      },
    )
    .on('error', () => {
      res.json({
        current: currentVersion,
        latest: currentVersion,
        hasUpdate: false,
        downloadUrl: null,
        error: 'Connection failed',
      });
    });
});

app.get('/api/update/download', async (req, res) => {
  const https = require('https');
  const AdmZip = require('adm-zip');
  const crypto = require('crypto');

  const pkg = getCachedPackageJson();
  const currentVersion = pkg.version;
  const updateConfig = pkg.update || { repository: 'Nascir/microrunner', branch: 'main' };
  const repo = updateConfig.repository;
  const branch = updateConfig.branch || 'main';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });
  res.write('\n');

  function sendProgress(message, progress = null) {
    const data = { message };
    if (progress !== null) data.progress = progress;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  const excludePatterns = [
    'projects.toml',
    '.gitignore',
    '.DS_Store',
    'node_modules',
    'temp_update_',
    'temp_extract_',
    'logs',
    'trash',
  ];

  function shouldExclude(filePath) {
    const baseName = path.basename(filePath);
    return excludePatterns.some((p) => baseName === p);
  }

  function getAllFiles(dir, baseDir) {
    const result = [];
    if (!fs.existsSync(dir)) return result;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      if (shouldExclude(relativePath) || shouldExclude(entry.name)) continue;

      if (entry.isDirectory()) {
        result.push(...getAllFiles(fullPath, baseDir));
      } else {
        result.push(relativePath);
      }
    }
    return result;
  }

  function calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  try {
    sendProgress('Checking for updates...', 5);

    const remotePackageJson = await new Promise((resolve, reject) => {
      https
        .get(
          `https://raw.githubusercontent.com/${repo}/${branch}/package.json`,
          { headers: { 'User-Agent': 'microRunner' }, timeout: 10000 },
          (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode}`));
              return;
            }
            let data = '';
            response.on('data', (chunk) => (data += chunk));
            response.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error('Failed to parse remote package.json'));
              }
            });
          },
        )
        .on('error', reject)
        .setTimeout(10000, () => {
          reject(new Error('Request timeout'));
        });
    });

    const latestVersion = remotePackageJson.version;
    if (latestVersion === currentVersion) {
      sendProgress('Already up to date', 100);
      res.end();
      return;
    }

    sendProgress(`Downloading update (${currentVersion} → ${latestVersion})...`, 20);

    const zipUrl = `https://github.com/${repo}/archive/${branch}.zip`;
    const tempZip = path.join(__dirname, `temp_update_${Date.now()}.zip`);

    await new Promise((resolve, reject) => {
      let redirects = 0;

      function doRequest(url) {
        if (redirects > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        https
          .get(
            url,
            { headers: { 'User-Agent': 'microRunner' } },
            (response) => {
              if (response.statusCode === 302 || response.statusCode === 301) {
                redirects++;
                const location = response.headers.location;
                if (!location) {
                  reject(new Error('Redirect without location'));
                  return;
                }
                doRequest(
                  location.startsWith('http')
                    ? location
                    : `https://github.com${location}`,
                );
                return;
              }

              if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
              }

              const totalBytes = parseInt(response.headers['content-length']) || 0;
              let downloadedBytes = 0;

              response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                  const percent = 20 + Math.min(20, (downloadedBytes / totalBytes) * 20);
                  sendProgress(`Downloading... ${Math.round(percent)}%`, percent);
                }
              });

              const file = fs.createWriteStream(tempZip);
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve();
              });
              file.on('error', (err) => {
                if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
                reject(err);
              });
            },
          )
          .on('error', reject)
          .setTimeout(60000, () => reject(new Error('Download timeout')));
      }

      doRequest(zipUrl);
    });

    const checksum = calculateChecksum(tempZip);
    console.log(`Downloaded archive SHA256: ${checksum}`);

    sendProgress('Extracting files...', 40);

    const tempDir = path.join(__dirname, `temp_extract_${Date.now()}`);
    const zip = new AdmZip(tempZip);
    zip.extractAllTo(tempDir, true);

    const entries = fs.readdirSync(tempDir);
    let sourceDir = null;

    for (const entry of entries) {
      const p = path.join(tempDir, entry);
      if (fs.statSync(p).isDirectory()) {
        if (fs.existsSync(path.join(p, 'package.json'))) {
          sourceDir = p;
          break;
        }
      }
    }

    if (!sourceDir) {
      throw new Error('Could not find source directory in update archive');
    }

    sendProgress('Installing files...', 70);

    fs.cpSync(sourceDir, __dirname, {
      recursive: true,
      force: true,
      filter: (src) => {
        const baseName = path.basename(src);
        return !excludePatterns.includes(baseName);
      },
    });

    const archiveFiles = getAllFiles(sourceDir, sourceDir);
    const localFiles = getAllFiles(__dirname, __dirname);

    let deletedCount = 0;
    for (const file of localFiles) {
      const topLevel = file.split('/')[0];
      if (excludePatterns.includes(topLevel)) continue;
      if (archiveFiles.includes(file)) continue;

      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        deletedCount++;
      }
    }

    console.log(`[Update] Update complete. ${deletedCount} obsolete files removed.`);

    sendProgress('Verifying installation...', 90);

    const newPackagePath = path.join(__dirname, 'package.json');
    if (fs.existsSync(newPackagePath)) {
      const newPackage = JSON.parse(fs.readFileSync(newPackagePath, 'utf-8'));
      sendProgress(`Updated to version ${newPackage.version}`, 100);
    } else {
      sendProgress('Update complete', 100);
    }

    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    if (fs.existsSync(tempDir))
      fs.rmSync(tempDir, { recursive: true, force: true });

    console.log('\n🔄 Update complete.');

    const isDevMode = process.argv.some(arg => arg.includes('nodemon'));

    if (isDevMode) {
      console.log('Please restart dev server manually (npm run dev)');
      setTimeout(() => {
        res.end();
        server.close(() => {
          process.exit(0);
        });
        setTimeout(() => {
          process.exit(0);
        }, 5000);
      }, 2000);
    } else {
      const restartScript = path.join(__dirname, 'restart.js');
      const child = spawn('node', [restartScript], {
        cwd: __dirname,
        stdio: 'ignore',
        detached: true
      });
      child.unref();

      setTimeout(() => {
        res.end();
        server.close(() => {
          process.exit(0);
        });
        setTimeout(() => {
          console.log('Forcing shutdown (restart may be incomplete)...');
          process.exit(0);
        }, 5000);
      }, 2000);
    }
  } catch (e) {
    sendProgress('Error: ' + e.message, 0);
    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    res.end();
  }
});

(async () => {
  try {
    const count = trash.emptyExpiredTrash();
    if (count > 0) {
      console.log(`[Trash] Permanently deleted ${count} expired project(s)`);
    }
  } catch (e) {
    console.error('[Trash] Cleanup failed:', e.message);
  }
})();

watchAllProjects();

server.listen(PORT, () => {
  console.log(`🟢 microRunner running at http://localhost:${PORT}`);
});

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Forcing shutdown...');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
