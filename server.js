const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { exec, spawn } = require('child_process');
const backup = require('./src/backup.js');
const config = require('./src/config.js');
const trash = require('./src/trash.js');
const note = require('./src/note.js');

let cliProjectPath = null;
let cliPort = null;

for (const arg of process.argv) {
  if (arg.startsWith('--project-path=')) {
    cliProjectPath = arg.split('=')[1];
  } else if (arg.startsWith('--port=')) {
    cliPort = parseInt(arg.split('=')[1], 10);
  }
}

const PORT = cliPort || process.env.PORT || 3000;

function getCachedPackageJson() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
  );
}

function resolveProjectPath(slug) {
  if (cliProjectPath) {
    const tomlPath = path.join(cliProjectPath, 'project.toml');
    if (fs.existsSync(tomlPath)) {
      return cliProjectPath;
    }
  }

  let current = process.cwd();
  const root = path.parse(current).root;
  let depth = 0;

  while (current !== root && depth < 5) {
    const tomlPath = path.join(current, 'project.toml');
    if (fs.existsSync(tomlPath)) {
      return current;
    }
    current = path.dirname(current);
    depth++;
  }

  return null;
}

function resolveProjectFromToml(slug) {
  return resolveProjectPath(slug);
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

async function validatePath(projectPath, subdir, userPath) {
  const basePath = path.resolve(projectPath, subdir);
  const resolved = path.resolve(basePath, userPath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

async function getProjectFiles(projectPath) {
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
      if (file.match(/\.(png|jpg|jpeg)$/i)) {
        const imageObj = {
          file: file,
          version: Date.now(),
        };

        const baseName = path.basename(file).replace(/\.(png|jpg|jpeg)$/i, '');
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
      if (file.match(/\.(wav|ogg|flac)$/i)) {
        const name = file.replace(/\.(wav|ogg|flac)$/i, '').replace(/\//g, '-');
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
      if (file.match(/\.(mp3|ogg|flac)$/i)) {
        const name = file.replace(/\.(mp3|ogg|flac)$/i, '').replace(/\//g, '-');
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

let activeWatcher = null;

async function watchProject(projectPath, slug) {
  if (activeWatcher) return;

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
    } catch (err) {
      console.error(`[Server] Error reading ${filePath}:`, err);
    }
  });

  activeWatcher = watcher;
  watchSprites(projectPath, slug);
}

async function handleSpriteChange(projectPath, slug, event, filePath) {
  try {
    await config.syncSprites(projectPath);
    const spriteProps = config.getSpriteProperties(filePath, projectPath);
    const fileName = path.basename(filePath).replace(/\.(png|jpg|jpeg)$/i, '');

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

async function watchSprites(projectPath, slug) {
  if (projectSpriteWatchers.has(slug)) return;

  const spritesDir = path.join(projectPath, 'sprites');
  if (!fs.existsSync(spritesDir)) return;

  const watcher = chokidar.watch(spritesDir, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', (filePath) => handleSpriteChange(projectPath, slug, 'add', filePath));
  watcher.on('unlink', (filePath) => handleSpriteChange(projectPath, slug, 'unlink', filePath));
  watcher.on('change', (filePath) => handleSpriteChange(projectPath, slug, 'change', filePath));

  projectSpriteWatchers.set(slug, watcher);
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
    const projectPath = resolveProjectFromToml(project);
    if (projectPath) {
      watchProject(projectPath, project);
    }
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

app.get('/api/project/:name', async (req, res) => {
  const slug = req.params.name;
  const projectPath = resolveProjectFromToml(slug);

  if (!projectPath) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let projectConfig;
  try {
    projectConfig = await config.read(projectPath);
  } catch (e) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = await getProjectFiles(projectPath);
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

app.get('/api/project/:slug/path', (req, res) => {
  if (cliProjectPath) {
    res.json({ path: cliProjectPath });
  } else {
    const projectPath = resolveProjectFromToml(req.params.slug);
    if (projectPath) {
      res.json({ path: projectPath });
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  }
});

app.get('/api/file/:project/*', async (req, res) => {
  const { project } = req.params;
  const file = req.params[0];
  const projectPath = resolveProjectFromToml(project);
  if (!projectPath) {
    return res.status(403).send('Access denied');
  }
  const filePath = await validatePath(projectPath, 'ms', file);
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

app.get('/api/sprite/:project/*', async (req, res) => {
  const { project } = req.params;
  const spritePath = req.params[0];
  const projectPath = resolveProjectFromToml(project);
  if (!projectPath) {
    return res.status(403).send('Access denied');
  }
  const filePath = await validatePath(projectPath, 'sprites', spritePath);
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
  const projectPath = resolveProjectFromToml(project);
  if (!projectPath) {
    return res.status(403).send('Access denied');
  }
  const filePath = await validatePath(projectPath, 'maps', mapPath);
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
  const projectPath = resolveProjectFromToml(project);
  if (!projectPath) {
    return res.status(403).send('Access denied');
  }
  let filePath = await validatePath(projectPath, 'sounds', soundPath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    const ext = soundPath.split('.').pop();
    if (ext !== 'wav' && ext !== 'ogg' && ext !== 'flac') {
      const basePath = soundPath.replace(/\.(wav|ogg|flac)$/i, '');
      for (const tryExt of ['wav', 'ogg', 'flac']) {
        const tryPath = await validatePath(
          projectPath,
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
  const projectPath = resolveProjectFromToml(project);
  if (!projectPath) {
    return res.status(403).send('Access denied');
  }
  let filePath = await validatePath(projectPath, 'music', musicPath);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    const ext = musicPath.split('.').pop();
    if (ext !== 'mp3' && ext !== 'ogg' && ext !== 'flac') {
      const basePath = musicPath.replace(/\.(mp3|ogg|flac)$/i, '');
      for (const tryExt of ['mp3', 'ogg', 'flac']) {
        const tryPath = await validatePath(projectPath, 'music', basePath + '.' + tryExt);
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
  const projectPath = resolveProjectFromToml(project);
  if (!projectPath) {
    return res.status(403).send('Access denied');
  }
  const filePath = await validatePath(projectPath, 'assets', assetPath);
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
    const projectPath = resolveProjectFromToml(name);
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
    const projectPath = resolveProjectFromToml(name);
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
    const projectPath = resolveProjectFromToml(name);
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

  let tempZip = null;
  let tempDir = null;

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
    tempZip = path.join(__dirname, `temp_update_${Date.now()}.zip`);

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

    tempDir = path.join(__dirname, `temp_extract_${Date.now()}`);
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
    const count = await trash.emptyExpiredTrash();
    if (count > 0) {
      console.log(`[Trash] Permanently deleted ${count} expired project(s)`);
    }
  } catch (e) {
    console.error('[Trash] Cleanup failed:', e.message);
  }
})();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🟢 microRunner running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server.');
});

let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  const shutdownMarker = path.join(__dirname, '.shutdown-' + Date.now());
  
  try {
    fs.writeFileSync(shutdownMarker, 'shutdown');
  } catch (e) {}

  console.log('\nStopping server...');
  process.stdout.write('\x1B[0m');

  wss.clients.forEach(client => client.close());

  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
  projectSpriteWatchers.forEach(watcher => watcher.close());
  projectSpriteWatchers.clear();

  server.close(() => {
    console.log('🔴 Server stopped.');
    try {
      if (fs.existsSync(shutdownMarker)) fs.unlinkSync(shutdownMarker);
    } catch (e) {}
    process.exit(0);
  });

  setTimeout(() => {
    console.log('Forcing shutdown...');
    try {
      if (fs.existsSync(shutdownMarker)) fs.unlinkSync(shutdownMarker);
    } catch (e) {}
    process.exit(1);
  }, 2000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
