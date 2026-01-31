const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const config = require('./src/project/config.js');

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

function resolveProjectPath() {
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

function resolveProjectFromToml() {
  return resolveProjectPath();
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const projectSpriteWatchers = new Map();
const projectWsClients = new Map();
let sessionStarted = false;

function printSessionSeparator(slug) {
  const line = '─'.repeat(50);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log('\n' + line);
  console.log(`🚀 Session started: ${now}`);
  console.log(`🟢 Project at http://localhost:${PORT}/${slug}`);
  console.log('⏹️  Press Ctrl+C to stop the server.');
  console.log(line + '\n');
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
              const detectedFrames = config.detectSpriteFrames(
                pngPath,
                spriteDirection,
              );
              imageObj.properties = { frames: detectedFrames, fps: 5 };
            } catch {
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

  watcher.on('add', (filePath) =>
    handleSpriteChange(projectPath, slug, 'add', filePath),
  );
  watcher.on('unlink', (filePath) =>
    handleSpriteChange(projectPath, slug, 'unlink', filePath),
  );
  watcher.on('change', (filePath) =>
    handleSpriteChange(projectPath, slug, 'change', filePath),
  );

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
  return Array.from(clients).filter(
    (client) => client.readyState === WebSocket.OPEN,
  );
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const project = url.searchParams.get('project');
  ws.project = project;

  if (project) {
    const projectPath = resolveProjectFromToml();
    if (projectPath) {
      watchProject(projectPath, project);
    }
    if (!projectWsClients.has(project)) {
      projectWsClients.set(project, new Set());
    }
    projectWsClients.get(project).add(ws);

    if (!sessionStarted) {
      sessionStarted = true;
      printSessionSeparator(project);
    }
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'log') {
        console.log(msg.data);
      } else if (msg.type === 'error') {
        console.error(msg.data);
      } else if (msg.type === 'restart') {
        process.stdout.write('\x1Bc');
        printSessionSeparator(ws.project);
      }
    } catch {}
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
  const projectPath = resolveProjectFromToml();

  if (!projectPath) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let projectConfig;
  try {
    projectConfig = await config.read(projectPath);
  } catch {
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
    const projectPath = resolveProjectFromToml();
    if (projectPath) {
      res.json({ path: projectPath });
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  }
});

app.get('/api/file/:project/*', async (req, res) => {
  const file = req.params[0];
  const projectPath = resolveProjectFromToml();
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
  const spritePath = req.params[0];
  const projectPath = resolveProjectFromToml();
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
  const mapPath = req.params[0];
  const projectPath = resolveProjectFromToml();
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
  const soundPath = req.params[0];
  const projectPath = resolveProjectFromToml();
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
  const musicPath = req.params[0];
  const projectPath = resolveProjectFromToml();
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
        const tryPath = await validatePath(
          projectPath,
          'music',
          basePath + '.' + tryExt,
        );
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send('Music not found');
  }
});

app.get('/api/assets/:project/*', async (req, res) => {
  const assetPath = req.params[0];
  const projectPath = resolveProjectFromToml();
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

app.get('/:project', (req, res) => {
  const project = req.params.project;
  if (
    project === 'api' ||
    project === 'static' ||
    project.startsWith('api.') ||
    project === 'favicon.ico'
  ) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'static', 'microrunner.html'));
});

server.listen(PORT, '127.0.0.1', () => {});

let shuttingDown = false;

function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  const shutdownMarker = path.join(__dirname, '.shutdown-' + Date.now());

  try {
    fs.writeFileSync(shutdownMarker, 'shutdown');
  } catch {}

  wss.clients.forEach((client) => client.close());

  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
  projectSpriteWatchers.forEach((watcher) => watcher.close());
  projectSpriteWatchers.clear();

  server.close(() => {
    try {
      if (fs.existsSync(shutdownMarker)) fs.unlinkSync(shutdownMarker);
    } catch {}
    process.exit(0);
  });

  setTimeout(() => {
    console.log('Forcing shutdown...');
    try {
      if (fs.existsSync(shutdownMarker)) fs.unlinkSync(shutdownMarker);
    } catch {}
    process.exit(1);
  }, 2000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
