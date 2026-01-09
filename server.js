const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const backup = require('./src/backup.js');

const PORT = process.env.PORT || 3000;
const PROJECTS_DIR = path.join(__dirname, 'projects');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(require('express-fileupload')());
app.use(express.static(path.join(__dirname, 'static')));

const projectClients = new Map();

function ensureProjectsDir() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function createDemoProject() {
  const demoDir = path.join(PROJECTS_DIR, 'demo', 'ms');
  const spritesDir = path.join(PROJECTS_DIR, 'demo', 'sprites');

  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }
  if (!fs.existsSync(spritesDir)) {
    fs.mkdirSync(spritesDir, { recursive: true });
  }

  const mainMs = path.join(demoDir, 'main.ms');
  if (!fs.existsSync(mainMs)) {
    fs.writeFileSync(mainMs, `init = function()
end

update = function()
end

draw = function()
end
`);
  }

  const configPath = path.join(PROJECTS_DIR, 'demo', 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({
      name: "Demo Project",
      slug: "demo",
      graphics: "m1",
      orientation: "any",
      aspect: "free",
      public: true
    }, null, 2));
  }
}

function getLatestMtime(dir) {
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
  return latest;
}

function getProjectLastUpdated(projectSlug) {
  const projectDir = path.join(PROJECTS_DIR, projectSlug);
  const mtimeMs = getLatestMtime(projectDir);
  return mtimeMs > 0 ? new Date(mtimeMs) : null;
}

function validatePath(project, subdir, userPath) {
  const basePath = path.resolve(PROJECTS_DIR, project, subdir);
  const resolved = path.resolve(basePath, userPath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

function getProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projects = [];
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const configPath = path.join(PROJECTS_DIR, entry.name, 'config.json');
      let config = { name: entry.name, slug: entry.name, projectPath: '~/projects/' + entry.name + '/' };
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          config.projectPath = '~/projects/' + entry.name + '/';
        } catch (e) {
          console.warn(`Invalid config.json for ${entry.name}:`, e.message);
        }
      }
      config.lastUpdated = getProjectLastUpdated(entry.name);
      projects.push(config);
    }
  }
  return projects;
}

function getProjectFiles(project) {
  const projectPath = path.join(PROJECTS_DIR, project);
  const msDir = path.join(projectPath, 'ms');
  if (!fs.existsSync(msDir)) return { sources: [], images: [], maps: [], sounds: [], music: [], assets: [] };

  const sources = [];
  const files = fs.readdirSync(msDir, { recursive: true });
  for (const file of files) {
    if (file.endsWith('.ms')) {
      sources.push({
        file: file,
        version: Date.now()
      });
    }
  }

  const spritesDir = path.join(projectPath, 'sprites');
  const images = [];
  if (fs.existsSync(spritesDir)) {
    const spriteFiles = fs.readdirSync(spritesDir);

    let spriteProperties = {};

    const projectJsonPath = path.join(projectPath, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
      try {
        const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
        if (projectJson.files) {
          for (const [entryPath, data] of Object.entries(projectJson.files)) {
            if (entryPath.startsWith('sprites/') && data.properties) {
              const fileName = entryPath.replace('sprites/', '');
              spriteProperties[fileName] = data.properties;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse project.json for', project, e);
      }
    }

    const config = getProjectConfig(project);
    const spriteDirection = config.spriteDirection || 'vertical';

    for (const file of spriteFiles) {
      if (file.match(/\.(png|jpg|jpeg|gif)$/i)) {
        const name = file.replace(/\.(png|jpg|jpeg|gif)$/i, '').replace(/\//g, '-');
        const imageObj = {
          file: name + '.png',
          version: Date.now()
        };

        if (spriteProperties[file]) {
          imageObj.properties = spriteProperties[file];
        } else {
          const pngPath = path.join(spritesDir, file);
          if (fs.existsSync(pngPath)) {
            try {
              const buffer = fs.readFileSync(pngPath);
              if (buffer.length >= 24) {
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                let frames = 1;

                if (spriteDirection === 'horizontal') {
                  frames = Math.max(1, Math.round(width / height));
                } else {
                  frames = Math.max(1, Math.round(height / width));
                }

                imageObj.properties = { frames: frames, fps: 5 };
              }
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
          version: Date.now()
        });
      }
    }
  }

  const soundsDir = path.join(PROJECTS_DIR, project, 'sounds');
  const sounds = [];
  if (fs.existsSync(soundsDir)) {
    const soundFiles = fs.readdirSync(soundsDir);
    for (const file of soundFiles) {
      if (file.match(/\.(wav|mp3|ogg)$/i)) {
        const name = file.replace(/\.(wav|mp3|ogg)$/i, '').replace(/\//g, '-');
        const ext = file.split('.').pop();
        sounds.push({
          file: name + '.' + ext,
          version: Date.now()
        });
      }
    }
  }

  const musicDir = path.join(PROJECTS_DIR, project, 'music');
  const music = [];
  if (fs.existsSync(musicDir)) {
    const musicFiles = fs.readdirSync(musicDir);
    for (const file of musicFiles) {
      if (file.match(/\.(wav|mp3|ogg)$/i)) {
        const name = file.replace(/\.(wav|mp3|ogg)$/i, '').replace(/\//g, '-');
        const ext = file.split('.').pop();
        music.push({
          file: name + '.' + ext,
          version: Date.now()
        });
      }
    }
  }

  const assetsDir = path.join(PROJECTS_DIR, project, 'assets');
  const assets = [];
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    for (const file of assetFiles) {
      if (file.match(/\.(json|glb|obj|jpg|ttf|wasm|txt|csv|md)$/i)) {
        const name = file.replace(/\.(json|glb|obj|jpg|ttf|wasm|txt|csv|md)$/i, '').replace(/\//g, '-');
        assets.push({
          file: name + '.' + file.split('.').pop(),
          version: Date.now()
        });
      }
    }
  }

  return { sources, images, maps, sounds, music, assets };
}

function getProjectConfig(project) {
  const projectPath = path.join(PROJECTS_DIR, project);
  const projectJsonPath = path.join(projectPath, 'project.json');
  const configPath = path.join(projectPath, 'config.json');

  if (fs.existsSync(projectJsonPath)) {
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
      return {
        name: projectJson.title,
        slug: projectJson.slug,
        orientation: projectJson.orientation,
        aspect: projectJson.aspect,
        graphics: projectJson.graphics?.toLowerCase() || 'm1',
        spriteDirection: projectJson.spriteDirection || 'vertical',
        public: true
      };
    } catch (e) {
      console.warn('Failed to parse project.json for', project, e);
    }
  }

  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  return {
    name: project,
    slug: project,
    graphics: 'm1',
    orientation: 'any',
    aspect: 'free',
    spriteDirection: 'vertical',
    public: true
  };
}

function handleSpriteChange(project, fileName) {
  const projectPath = path.join(PROJECTS_DIR, project);
  const spritePath = path.join(projectPath, 'sprites', fileName);

  if (!fs.existsSync(spritePath)) {
    return;
  }

  let width = 1;
  let height = 1;

  try {
    const buffer = fs.readFileSync(spritePath);
    if (buffer.length >= 24) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    }
  } catch (e) {
    console.warn(`[Server] Failed to read sprite dimensions: ${fileName}`, e);
  }

  const config = getProjectConfig(project);
  const spriteDirection = config.spriteDirection || 'vertical';

  let frames = 1;
  if (spriteDirection === 'horizontal') {
    frames = Math.max(1, Math.round(width / height));
  } else {
    frames = Math.max(1, Math.round(height / width));
  }

  const projectJsonPath = path.join(projectPath, 'project.json');
  let projectJson = {
    owner: 'local',
    title: config.name,
    slug: config.slug,
    tags: [],
    orientation: config.orientation,
    aspect: config.aspect,
    spriteDirection: spriteDirection,
    platforms: ['computer', 'phone', 'tablet'],
    controls: ['touch', 'mouse'],
    type: 'app',
    language: 'microscript_v2',
    graphics: 'M1',
    networking: false,
    libs: [],
    date_created: Date.now(),
    last_modified: Date.now(),
    first_published: 0,
    files: {},
    description: ''
  };

  if (fs.existsSync(projectJsonPath)) {
    try {
      projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
      if (!projectJson.files) {
        projectJson.files = {};
      }
    } catch (e) {
      console.warn(`[Server] Failed to parse project.json for ${project}, creating new one`);
    }
  }

  const spriteEntry = `sprites/${fileName}`;
  const existingProps = projectJson.files?.[spriteEntry]?.properties;
  const existingFrames = existingProps?.frames;

  const needsUpdate = !existingProps || existingFrames !== frames;

  if (!needsUpdate) {
    return;
  }

  projectJson.files[spriteEntry] = {
    properties: {
      frames: frames
    }
  };

  projectJson.last_modified = Date.now();

  fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2));

  console.log(`[Server] Sprite updated: ${fileName} -> ${frames} frame(s)`);

  broadcastToAllProjects();
}

function scanProjectSprites(project) {
  const projectPath = path.join(PROJECTS_DIR, project);
  const spritesDir = path.join(projectPath, 'sprites');

  if (!fs.existsSync(spritesDir)) return 0;

  const files = fs.readdirSync(spritesDir);
  const imageFiles = files.filter(f => f.match(/\.(png|jpg|jpeg|gif)$/i));

  if (imageFiles.length === 0) return 0;

  const config = getProjectConfig(project);
  const spriteDirection = config.spriteDirection || 'vertical';
  const projectJsonPath = path.join(projectPath, 'project.json');

  let projectJson = {
    owner: 'local',
    title: config.name,
    slug: config.slug,
    tags: [],
    orientation: config.orientation,
    aspect: config.aspect,
    spriteDirection: spriteDirection,
    platforms: ['computer', 'phone', 'tablet'],
    controls: ['touch', 'mouse'],
    type: 'app',
    language: 'microscript_v2',
    graphics: 'M1',
    networking: false,
    libs: [],
    date_created: Date.now(),
    last_modified: Date.now(),
    first_published: 0,
    files: {},
    description: ''
  };

  if (fs.existsSync(projectJsonPath)) {
    try {
      projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
      if (!projectJson.files) {
        projectJson.files = {};
      }
    } catch (e) {
      console.warn(`[Server] Failed to parse project.json for ${project}, creating new one`);
    }
  }

  let updated = false;

  for (const fileName of imageFiles) {
    const spritePath = path.join(spritesDir, fileName);
    const spriteEntry = `sprites/${fileName}`;

    let width = 1;
    let height = 1;

    try {
      const buffer = fs.readFileSync(spritePath);
      if (buffer.length >= 24) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      }
    } catch (e) {
      console.warn(`[Server] Failed to read sprite dimensions: ${fileName}`, e);
    }

    let frames = 1;
    if (spriteDirection === 'horizontal') {
      frames = Math.max(1, Math.round(width / height));
    } else {
      frames = Math.max(1, Math.round(height / width));
    }

    const existingProps = projectJson.files?.[spriteEntry]?.properties;
    const existingFrames = existingProps?.frames;

    if (!existingProps || existingFrames !== frames) {
      projectJson.files[spriteEntry] = {
        properties: {
          frames: frames
        }
      };
      updated = true;
    }
  }

  if (updated) {
    projectJson.last_modified = Date.now();
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2));
    console.log(`[Server] Scanned ${imageFiles.length} sprite(s) for ${project}`);
  }

  return imageFiles.length;
}

function watchProject(project) {
  if (projectClients.has(project)) return;

  const projectPath = path.join(PROJECTS_DIR, project);
  const msDir = path.join(projectPath, 'ms');
  const spritesDir = path.join(projectPath, 'sprites');

  if (!fs.existsSync(msDir)) return;

  const watcher = chokidar.watch(msDir, {
    ignored: /^\./,
    persistent: true
  });

  watcher.on('change', (filePath) => {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    broadcastToProject(project, {
      type: 'update',
      file: fileName.replace('.ms', ''),
      code: content,
      version: Date.now()
    });

    broadcastToAllProjects();
  });

  if (fs.existsSync(spritesDir)) {
    const spriteWatcher = chokidar.watch(spritesDir, {
      ignored: /^\./,
      persistent: true
    });

    spriteWatcher.on('add', (filePath) => {
      const fileName = path.basename(filePath);
      if (fileName.match(/\.(png|jpg|jpeg|gif)$/i)) {
        handleSpriteChange(project, fileName);
      }
    });

    spriteWatcher.on('change', (filePath) => {
      const fileName = path.basename(filePath);
      if (fileName.match(/\.(png|jpg|jpeg|gif)$/i)) {
        handleSpriteChange(project, fileName);
      }
    });
  }

  projectClients.set(project, watcher);
}

function watchAllProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return;

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      watchProject(entry.name);
      scanProjectSprites(entry.name);
    }
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
  return Array.from(wss.clients).filter(client => {
    return client.project === project && client.readyState === WebSocket.OPEN;
  });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const project = url.searchParams.get('project');
  ws.project = project;
  
  if (project) {
    watchProject(project);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/api/projects', (req, res) => {
  res.json(getProjects());
});

app.get('/api/project/:name', (req, res) => {
  const project = req.params.name;
  const config = getProjectConfig(project);
  const files = getProjectFiles(project);
  res.json({ ...config, files });
});

app.get('/api/file/:project/*', (req, res) => {
  const { project } = req.params;
  const file = req.params[0];
  const filePath = validatePath(project, 'ms', file);
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

app.put('/api/project/:name/config', (req, res) => {
  const { name } = req.params;
  const newConfig = req.body;

  const oldConfigPath = path.join(PROJECTS_DIR, name, 'config.json');
  if (!fs.existsSync(oldConfigPath)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const oldSlug = name;
  const newSlug = newConfig.slug || name;

  try {
    if (oldSlug !== newSlug) {
      const oldProjectPath = path.join(PROJECTS_DIR, oldSlug);
      const newProjectPath = path.join(PROJECTS_DIR, newSlug);
      if (fs.existsSync(newProjectPath)) {
        return res.status(400).json({ error: 'A project with this slug already exists' });
      }
      fs.renameSync(oldProjectPath, newProjectPath);
    }

    const configPath = path.join(PROJECTS_DIR, newSlug, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.name = newConfig.name;
    config.slug = newConfig.slug;
    config.orientation = newConfig.orientation;
    config.aspect = newConfig.aspect;
    config.spriteDirection = newConfig.spriteDirection;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const projectJsonPath = path.join(PROJECTS_DIR, newSlug, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
      projectJson.title = newConfig.name;
      projectJson.slug = newConfig.slug;
      projectJson.orientation = newConfig.orientation;
      projectJson.aspect = newConfig.aspect;
      projectJson.graphics = newConfig.graphics?.toUpperCase();
      projectJson.spriteDirection = newConfig.spriteDirection;
      projectJson.last_modified = Date.now();
      fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2));
    }

    res.json({ success: true, slug: newSlug });
  } catch (e) {
    console.error('Failed to update project config:', e);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

app.post('/api/projects', (req, res) => {
  const { name, slug, orientation, aspect, spriteDirection } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const generateSlug = (n) => n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const baseSlug = slug || generateSlug(name);
  let projectSlug = baseSlug;
  let counter = 1;

  while (fs.existsSync(path.join(PROJECTS_DIR, projectSlug))) {
    projectSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  try {
    const projectPath = path.join(PROJECTS_DIR, projectSlug);
    fs.mkdirSync(path.join(projectPath, 'ms'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'sprites'), { recursive: true });
    const defaultIconPath = path.join(__dirname, 'static', 'icon.png');
    if (fs.existsSync(defaultIconPath)) {
      fs.copyFileSync(defaultIconPath, path.join(projectPath, 'sprites', 'icon.png'));
    }

    const mainMs = `init = function()
  // Initialize your game here
end

update = function()
  // Update game logic (60 FPS)
end

draw = function()
  // Draw to screen
  screen.clear()
  screen.drawText("Hello, World!", 0, 0, 12, "white")
end
`;
    fs.writeFileSync(path.join(projectPath, 'ms', 'main.ms'), mainMs);

    const config = {
      name: name,
      slug: projectSlug,
      graphics: "m1",
      orientation: orientation || "any",
      aspect: aspect || "free",
      spriteDirection: spriteDirection || "vertical",
      public: true
    };
    fs.writeFileSync(path.join(projectPath, 'config.json'), JSON.stringify(config, null, 2));

    const projectJson = {
      owner: 'local',
      title: name,
      slug: projectSlug,
      tags: [],
      orientation: orientation || 'any',
      aspect: aspect || 'free',
      spriteDirection: spriteDirection || 'vertical',
      platforms: ['computer', 'phone', 'tablet'],
      controls: ['touch', 'mouse'],
      type: 'app',
      language: 'microscript_v2',
      graphics: 'M1',
      networking: false,
      libs: [],
      date_created: Date.now(),
      last_modified: Date.now(),
      first_published: 0,
      files: {},
      description: ''
    };
    fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(projectJson, null, 2));

    res.json({ success: true, slug: projectSlug });
  } catch (e) {
    console.error('Failed to create project:', e);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.delete('/api/project/:name', (req, res) => {
  const { name } = req.params;
  const projectPath = path.join(PROJECTS_DIR, name);

  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    fs.rmSync(projectPath, { recursive: true, force: true });
    backup.deleteAllBackups(name);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete project:', e);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.post('/api/project/:name/duplicate', (req, res) => {
  const { name } = req.params;
  const projectPath = path.join(PROJECTS_DIR, name);

  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const result = backup.duplicateProject(name);
    res.json(result);
  } catch (e) {
    console.error('Failed to duplicate project:', e);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

app.get('/api/sprite/:project/*', (req, res) => {
  const { project } = req.params;
  const spritePath = req.params[0];
  const filePath = validatePath(project, 'sprites', spritePath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Sprite not found');
  }
});

app.get('/api/map/:project/*', (req, res) => {
  const { project } = req.params;
  const mapPath = req.params[0];
  const filePath = validatePath(project, 'maps', mapPath);
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

app.get('/api/sound/:project/*', (req, res) => {
  const { project } = req.params;
  const soundPath = req.params[0];
  let filePath = validatePath(project, 'sounds', soundPath);
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
        const tryPath = validatePath(project, 'sounds', basePath + '.' + tryExt);
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send('Sound not found');
  }
});

app.get('/api/music/:project/*', (req, res) => {
  const { project } = req.params;
  const musicPath = req.params[0];
  let filePath = validatePath(project, 'music', musicPath);
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
        const tryPath = validatePath(project, 'music', basePath + '.' + tryExt);
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send('Music not found');
  }
});

app.get('/api/assets/:project/*', (req, res) => {
  const { project } = req.params;
  const assetPath = req.params[0];
  const filePath = validatePath(project, 'assets', assetPath);
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
    res.json({ success: true, fileName: result.fileName, timestamp: result.timestamp });
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

app.get('/api/project/:name/backups', (req, res) => {
  const { name } = req.params;
  try {
    const backups = backup.listBackups(name);
    res.json(backups);
  } catch (e) {
    console.error('Failed to list backups:', e);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.delete('/api/project/:name/backups/:file', (req, res) => {
  const { name, file } = req.params;
  try {
    backup.deleteBackup(name, file);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete backup:', e);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

app.get('/api/project/:name/backups/:file/download', (req, res) => {
  const { name, file } = req.params;
  try {
    const filePath = backup.getBackupPath(name, file);
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
      createPreRestoreBackup: createPreRestoreBackup
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
      createPreRestoreBackup: true
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
  const tempPath = path.join(__dirname, 'temp_import_' + Date.now() + '.zip');

  try {
    await uploadedFile.mv(tempPath);

    const result = await backup.importProjectFromArchive(tempPath);

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

app.post('/api/project/:name/backups/upload', async (req, res) => {
  const { name } = req.params;

  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedFile = req.files.file;
  const tempPath = path.join(__dirname, 'temp_backup_upload_' + Date.now() + '.zip');

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

app.get('/api/project/:name/backups/:file/note', (req, res) => {
  const { name, file } = req.params;
  try {
    const note = backup.getBackupNote(name, file);
    res.json({ note });
  } catch (e) {
    console.error('Failed to get note:', e);
    res.status(500).json({ error: 'Failed to get note' });
  }
});

app.put('/api/project/:name/backups/:file/note', (req, res) => {
  const { name, file } = req.params;
  const { note } = req.body;
  try {
    backup.saveBackupNote(name, file, note || '');
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to save note:', e);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

app.delete('/api/project/:name/backups/:file/note', (req, res) => {
  const { name, file } = req.params;
  try {
    backup.deleteBackupNote(name, file);
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to delete note:', e);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.get('/run/:project', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'game.html'));
});

const GITHUB_REPO = 'Nascir/microrunner';

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'User-Agent': 'microRunner-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            resolve(release);
          } catch (e) {
            reject(new Error('Failed to parse GitHub response'));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('GitHub API request timeout'));
    });
  });
}

app.get('/api/version', async (req, res) => {
  const currentVersion = require('./package.json').version;

  try {
    const release = await getLatestRelease();
    const latestVersion = release.tag_name?.replace(/^v/, '') || currentVersion;
    const hasUpdate = latestVersion !== currentVersion;

    res.json({
      current: currentVersion,
      latest: latestVersion,
      hasUpdate: hasUpdate,
      releaseUrl: release.html_url || null,
      publishedAt: release.published_at || null
    });
  } catch (e) {
    console.warn('[Version] Could not check for updates:', e.message);
    res.json({
      current: currentVersion,
      latest: currentVersion,
      hasUpdate: false,
      releaseUrl: null,
      publishedAt: null,
      error: 'Could not check for updates'
    });
  }
});

app.post('/api/update/apply', async (req, res) => {
  const https = require('https');
  const AdmZip = require('adm-zip');
  const { exec } = require('child_process');

  const currentVersion = require('./package.json').version;

  function sendProgress(message, progress = null, debug = null) {
    const data = { message, progress };
    if (debug !== null) {
      data.debug = debug;
    }
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function logToConsole(prefix, message) {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}] [Update] ${prefix}: ${message}`);
  }

  try {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('\n');

    logToConsole('INFO', `Starting update from v${currentVersion}`);

    let release;
    try {
      logToConsole('STEP', 'Checking GitHub for latest release...');
      sendProgress('Checking for latest version...', 5, 'Connecting to GitHub API...');
      release = await getLatestRelease();
      logToConsole('INFO', `Found release: ${release.tag_name}`);
    } catch (e) {
      logToConsole('ERROR', `GitHub API failed: ${e.message}`);
      sendProgress('Error: Could not connect to GitHub', 0, `Connection failed: ${e.message}`);
      res.end();
      return;
    }

    const latestVersion = release.tag_name?.replace(/^v/, '');
    logToConsole('INFO', `Current: ${currentVersion}, Latest: ${latestVersion}`);

    if (!latestVersion) {
      logToConsole('ERROR', 'Could not parse latest version');
      sendProgress('Error: Invalid version from GitHub', 0, 'Could not parse version');
      res.end();
      return;
    }

    if (latestVersion === currentVersion) {
      logToConsole('INFO', 'Already up to date');
      sendProgress('Already up to date', 100, 'No update needed');
      res.end();
      return;
    }

    logToConsole('STEP', `Downloading v${latestVersion}...`);
    sendProgress(`Downloading version ${latestVersion}...`, 10, `URL: https://github.com/${GITHUB_REPO}/archive/refs/tags/v${latestVersion}.zip`);

    const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/tags/v${latestVersion}.zip`;
    const tempZip = path.join(__dirname, `temp_update_${Date.now()}.zip`);

    try {
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tempZip);
        const request = https.get(zipUrl, { headers: { 'User-Agent': 'microRunner-Updater' } }, (response) => {
          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(tempZip);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            const stats = fs.statSync(tempZip);
            logToConsole('INFO', `Downloaded ZIP: ${stats.size} bytes`);
            resolve();
          });
        });
        request.on('error', (err) => {
          if (fs.existsSync(tempZip)) {
            fs.unlinkSync(tempZip);
                   }
          reject(err);
        });
        request.setTimeout(30000, () => {
          request.destroy();
          if (fs.existsSync(tempZip)) {
            fs.unlinkSync(tempZip);
          }
          reject(new Error('Download timeout'));
        });
      });
    } catch (e) {
      logToConsole('ERROR', `Download failed: ${e.message}`);
      sendProgress('Error: Download failed', 0, `Download error: ${e.message}`);
      res.end();
      return;
    }

    logToConsole('STEP', 'Extracting ZIP...');
    sendProgress('Extracting files...', 30, 'Unpacking archive...');

    const tempDir = path.join(__dirname, `temp_extract_${Date.now()}`);

    try {
      const zip = new AdmZip(tempZip);
      zip.extractAllTo(tempDir, true);
      logToConsole('INFO', 'ZIP extracted successfully');
    } catch (e) {
      logToConsole('ERROR', `Extraction failed: ${e.message}`);
      sendProgress('Error: Extraction failed', 0, `Extract error: ${e.message}`);
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      res.end();
      return;
    }

    const entries = fs.readdirSync(tempDir);
    logToConsole('INFO', `Extracted directory contents: ${entries.join(', ')}`);

    if (entries.length === 0) {
      logToConsole('ERROR', 'Extracted directory is empty');
      sendProgress('Error: Empty archive', 0, 'Extracted dir is empty');
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      res.end();
      return;
    }

    const sourceDir = entries[0];
    const fullSourceDir = path.join(tempDir, sourceDir);
    logToConsole('INFO', `Source directory: ${sourceDir}`);

    if (!fs.existsSync(fullSourceDir)) {
      logToConsole('ERROR', `Source directory not found: ${fullSourceDir}`);
      sendProgress('Error: Invalid archive structure', 0, `Source dir not found: ${fullSourceDir}`);
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      res.end();
      return;
    }

    const excludePatterns = [
      'projects',
      'archive',
      '.gitignore',
      '.DS_Store',
      'node_modules',
      'temp_update_',
      'temp_extract_'
    ];

    let filesCopied = 0;
    let dirsCreated = 0;

    function copyWithExclusions(src, dest) {
      if (!fs.existsSync(src)) return;

      const stats = fs.statSync(src);
      const baseName = path.basename(src);

      if (excludePatterns.some(p => baseName.includes(p))) {
        logToConsole('SKIP', `Excluded: ${baseName}`);
        return;
      }

      if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
          dirsCreated++;
        }
        const entries = fs.readdirSync(src);
        for (const entry of entries) {
          copyWithExclusions(path.join(src, entry), path.join(dest, entry));
        }
      } else {
        try {
          fs.copyFileSync(src, dest);
          filesCopied++;
          if (filesCopied <= 10) {
            logToConsole('COPY', `${baseName}`);
          } else if (filesCopied === 11) {
            logToConsole('COPY', '... (more files)');
          }
        } catch (e) {
          logToConsole('ERROR', `Failed to copy ${baseName}: ${e.message}`);
        }
      }
    }

    logToConsole('STEP', 'Installing files...');
    sendProgress('Installing files...', 50, `Copying from ${sourceDir}...`);

    copyWithExclusions(fullSourceDir, __dirname);

    logToConsole('INFO', `Copied: ${filesCopied} files, ${dirsCreated} directories`);

    sendProgress('Verifying installation...', 80, `Verification: ${filesCopied} files copied`);

    const newPackagePath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(newPackagePath)) {
      logToConsole('ERROR', 'package.json not found after copy!');
      sendProgress('Error: Installation failed', 0, 'package.json not found');
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      res.end();
      return;
    }

    try {
      const newPackage = JSON.parse(fs.readFileSync(newPackagePath, 'utf-8'));
      const newVersion = newPackage.version;
      logToConsole('INFO', `New version installed: ${newVersion}`);

      if (newVersion !== latestVersion) {
        logToConsole('ERROR', `Version mismatch! Expected ${latestVersion}, got ${newVersion}`);
        sendProgress('Error: Version mismatch', 0, `Expected ${latestVersion}, got ${newVersion}`);
        res.end();
        return;
      }
    } catch (e) {
      logToConsole('ERROR', `Failed to read new version: ${e.message}`);
      sendProgress('Error: Verification failed', 0, `Parse error: ${e.message}`);
      res.end();
      return;
    }

    logToConsole('STEP', 'Cleaning up temp files...');
    sendProgress('Cleaning up...', 90, 'Removing temporary files...');

    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

    logToConsole('INFO', 'Update completed successfully');
    sendProgress('Update complete. Restarting server...', 100, 'Ready to restart');

    setTimeout(() => {
      res.end();
      console.log(`\n🔄 Updated from v${currentVersion} to v${latestVersion}`);
      console.log(`📡 Restarting server... (copied ${filesCopied} files)\n`);

      exec('npm start', (error, stdout, stderr) => {
        if (error) {
          console.error('[Update] Failed to restart:', error.message);
        } else {
          console.log('[Update] Server restarted successfully');
        }
      });
    }, 1500);

  } catch (e) {
    console.error('[Update] Fatal error:', e);
    sendProgress('Error: ' + e.message, 0, `Fatal error: ${e.message}`);
    res.end();
  }
});

app.get('/api/update/status', (req, res) => {
  const statusPath = path.join(__dirname, '.update_status');
  if (fs.existsSync(statusPath)) {
    res.json(JSON.parse(fs.readFileSync(statusPath, 'utf-8')));
  } else {
    res.json({ updating: false });
  }
});

ensureProjectsDir();
backup.ensureArchiveDir();
createDemoProject();
watchAllProjects();

server.listen(PORT, () => {
  console.log(`🟢 microRunner running at http://localhost:${PORT}`);
  console.log(`📁 Projects directory: ${PROJECTS_DIR}\n`);
});
