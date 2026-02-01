const fs = require('fs');
const path = require('path');
const { VERSION } = require('../constants');

// Synchronous TOML module load at startup for better performance
let tomlModule = null;
let tomlModuleLoading = null;

async function getToml() {
  if (tomlModule) return tomlModule;

  if (!tomlModuleLoading) {
    tomlModuleLoading = import('smol-toml');
  }

  tomlModule = await tomlModuleLoading;
  return tomlModule;
}

function getDocumentsPath() {
  const homedir = require('os').homedir();
  return path.join(homedir, 'Documents');
}

function generateDefaultProjectPath(baseName) {
  const documentsPath = getDocumentsPath();
  const baseFolder = path.join(documentsPath, baseName);
  if (!fs.existsSync(baseFolder)) {
    return baseFolder;
  }
  let counter = 1;
  let projectPath;

  do {
    projectPath = path.join(documentsPath, `${baseName}-${counter}`);
    counter++;
  } while (fs.existsSync(projectPath));

  return projectPath;
}

function generateUniqueFolderName(baseName) {
  const documentsPath = getDocumentsPath();
  const baseFolder = path.join(documentsPath, baseName);
  if (!fs.existsSync(baseFolder)) {
    return baseName;
  }
  let counter = 1;

  do {
    const candidate = `${baseName}-${counter}`;
    const candidatePath = path.join(documentsPath, candidate);
    if (!fs.existsSync(candidatePath)) {
      return candidate;
    }
    counter++;
  } while (true);
}

function detectSpriteFrames(spritePath, spriteDirection) {
  try {
    const fd = fs.openSync(spritePath, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    if (buffer.length < 24) return 1;

    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      return 1;
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    if (width === 0 || height === 0) return 1;

    if (spriteDirection === 'vertical') {
      return Math.round(height / width);
    } else {
      return Math.round(width / height);
    }
  } catch (e) {
    console.warn(`[Config] Failed to detect frames for ${spritePath}:`, e);
    return 1;
  }
}

async function read(projectPath) {
  const { parse } = await getToml();
  return parse(fs.readFileSync(path.join(projectPath, 'project.toml'), 'utf-8'));
}

async function write(projectPath, config) {
  const { stringify } = await getToml();
  fs.writeFileSync(
    path.join(projectPath, 'project.toml'),
    stringify(config),
  );
  invalidateConfigCache(projectPath);
}

async function syncSprites(projectPath) {
  const spritesDir = path.join(projectPath, 'sprites');
  if (!fs.existsSync(spritesDir)) {
    return;
  }

  const config = await read(projectPath);
  if (!config.sprites) {
    config.sprites = { direction: 'vertical' };
  }

  const existingSpriteFiles = new Set();
  const entries = fs.readdirSync(spritesDir, { recursive: true });

  for (const entry of entries) {
    const fullPath = path.join(spritesDir, entry);
    if (fs.statSync(fullPath).isFile() && entry.match(/\.(png|jpg|jpeg)$/i)) {
      existingSpriteFiles.add(entry);

      const currentFrames = config.sprites[entry]?.frames;
      if (currentFrames) {
        config.sprites[entry] = { frames: currentFrames };
      } else {
        const detectedFrames = detectSpriteFrames(fullPath, config.sprites.direction);
        config.sprites[entry] = { frames: detectedFrames };
      }
    }
  }

  for (const key of Object.keys(config.sprites)) {
    if (key !== 'direction' && !existingSpriteFiles.has(key)) {
      delete config.sprites[key];
    }
  }

  config.meta.lastModified = new Date().toISOString().slice(0, 19) + 'Z';
  await write(projectPath, config);

  return config.sprites;
}

async function touch(projectPath) {
  try {
    const cfg = await read(projectPath);
    cfg.meta.lastModified = new Date().toISOString().slice(0, 19) + 'Z';
    await write(projectPath, cfg);
  } catch (e) {
    console.warn('[Config] Failed to update lastModified:', e);
  }
}

let tomlConfigCache = new Map();
const CONFIG_CACHE_TTL = 30000;

function invalidateConfigCache(projectPath) {
  tomlConfigCache.delete(projectPath);
}

function getSpriteProperties(spriteName, projectPath) {
  const tomlPath = path.join(projectPath, 'project.toml');
  if (!fs.existsSync(tomlPath)) return null;

  const now = Date.now();
  let cached = tomlConfigCache.get(projectPath);

  if (!cached || now - cached.timestamp > CONFIG_CACHE_TTL) {
    const content = fs.readFileSync(tomlPath, 'utf-8');
    const { parse } = require('smol-toml');
    cached = { config: parse(content), timestamp: now };
    tomlConfigCache.set(projectPath, cached);
  }

  let spriteConfig = cached.config.sprites?.[spriteName];

  if (!spriteConfig) {
    const baseName = path.basename(spriteName);
    spriteConfig = cached.config.sprites?.[baseName];
  }

  return spriteConfig ? { frames: spriteConfig.frames } : null;
}

function toProjectJson(config) {
  const files = {};
  for (const [key, value] of Object.entries(config.sprites || {})) {
    if (key !== 'direction') {
      files[`sprites/${key}`] = { properties: { frames: value.frames } };
    }
  }

  return {
    owner: 'local',
    title: config.meta.name,
    slug: config.meta.slug,
    orientation: config.settings.orientation,
    aspect: config.settings.aspect,
    spriteDirection: config.sprites.direction,
    graphics: config.settings.graphics?.toUpperCase() || 'M1',
    language: config.settings.language,
    controls: ['touch', 'mouse'],
    platforms: ['computer', 'phone', 'tablet'],
    type: 'app',
    tags: [],
    networking: false,
    libs: [],
    date_created: config.meta.created,
    last_modified: config.meta.lastModified,
    first_published: 0,
    description: '',
    files,
  };
}

function toMicroStudioJson(config, filesInfo = {}) {
  const files = {};

  for (const [key, value] of Object.entries(config.sprites || {})) {
    if (key !== 'direction') {
      const fileInfo = filesInfo.sprites?.find(f => f.name === key) || {};
      files[`sprites/${key}`] = {
        version: 1,
        size: fileInfo.size || 0,
        properties: { frames: value.frames, fps: 5 },
      };
    }
  }

  for (const file of filesInfo.sources || []) {
    files[`ms/${file.name}`] = {
      version: 1,
      size: file.size || 0,
      properties: {},
    };
  }

  for (const file of filesInfo.maps || []) {
    files[`maps/${file.name}`] = {
      version: 1,
      size: file.size || 0,
      properties: {},
    };
  }

  for (const file of filesInfo.sounds || []) {
    files[`sounds/${file.name}`] = {
      version: 1,
      size: file.size || 0,
      properties: {},
    };
  }

  for (const file of filesInfo.music || []) {
    files[`music/${file.name}`] = {
      version: 1,
      size: file.size || 0,
      properties: {},
    };
  }

  for (const file of filesInfo.assets || []) {
    files[`assets/${file.name}`] = {
      version: 1,
      size: file.size || 0,
      properties: {},
    };
  }

  for (const file of filesInfo.docs || []) {
    files[`doc/${file.name}`] = {
      version: 1,
      size: file.size || 0,
      properties: {},
    };
  }

  return {
    owner: 'local',
    title: config.meta.name,
    slug: config.meta.slug,
    orientation: config.settings.orientation,
    aspect: config.settings.aspect,
    spriteDirection: config.sprites.direction,
    graphics: config.settings.graphics?.toUpperCase() || 'M1',
    language: config.settings.language,
    controls: ['touch', 'mouse'],
    platforms: ['computer', 'phone', 'tablet'],
    type: 'app',
    tags: [],
    networking: false,
    libs: [],
    date_created: Date.now(),
    last_modified: Date.now(),
    first_published: 0,
    description: '',
    files,
  };
}

function fromProjectJson(json, options = {}) {
  const sprites = { direction: json.spriteDirection || 'vertical' };
  for (const [key, value] of Object.entries(json.files || {})) {
    if (key.startsWith('sprites/')) {
      const name = key.replace('sprites/', '');
      sprites[name] = { frames: value.properties?.frames || 1 };
    }
  }

  return {
    microrunnerVersion: options.microrunnerVersion || null,
    meta: {
      name: json.title || json.slug,
      slug: json.slug,
      created: (typeof json.date_created === 'number'
        ? new Date(json.date_created).toISOString().slice(0, 19) + 'Z'
        : json.date_created) || new Date().toISOString().slice(0, 19) + 'Z',
      lastModified: (typeof json.last_modified === 'number'
        ? new Date(json.last_modified).toISOString().slice(0, 19) + 'Z'
        : json.last_modified) || new Date().toISOString().slice(0, 19) + 'Z',
    },
    settings: {
      graphics: json.graphics?.toLowerCase() || 'm1',
      orientation: json.orientation || 'any',
      aspect: json.aspect || 'free',
      language: json.language || 'microscript_v2',
    },
    sprites,
  };
}

function createConfig(name, slug, options = {}) {
  const spriteFrames = options.spriteFrames || {};
  const sprites = {
    direction: options.spriteDirection || 'vertical',
  };
  for (const [fileName, frames] of Object.entries(spriteFrames)) {
    sprites[fileName] = { frames };
  }

  return {
    microrunnerVersion: VERSION,
    meta: {
      name,
      slug,
      created: new Date().toISOString().slice(0, 19) + 'Z',
      lastModified: new Date().toISOString().slice(0, 19) + 'Z',
    },
    settings: {
      graphics: options.graphics || 'm1',
      orientation: options.orientation || 'any',
      aspect: options.aspect || 'free',
      language: 'microscript_v2',
    },
    sprites,
  };
}

module.exports = {
  read,
  write,
  toProjectJson,
  toMicroStudioJson,
  fromProjectJson,
  createConfig,
  syncSprites,
  getSpriteProperties,
  detectSpriteFrames,
  touch,
  generateDefaultProjectPath,
  generateUniqueFolderName,
  getDocumentsPath,
};
