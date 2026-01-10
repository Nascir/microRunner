const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
const VERSION = pkg.version;

let tomlModule = null;

async function getToml() {
  if (!tomlModule) {
    tomlModule = await import('smol-toml');
  }
  return tomlModule;
}

function detectSpriteFrames(spritePath, spriteDirection) {
  try {
    const buffer = fs.readFileSync(spritePath);
    
    if (buffer.length < 24) return 1;
    
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      return 1;
    }
    
    let width = 0;
    let height = 0;
    
    for (let i = 0; i < buffer.length - 8; i++) {
      if (buffer[i] === 0x49 && buffer[i+1] === 0x48 && buffer[i+2] === 0x44 && buffer[i+3] === 0x52) {
        width = buffer.readUInt32BE(i + 4);
        height = buffer.readUInt32BE(i + 8);
        break;
      }
    }
    
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
    stringify(config)
  );
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
    if (fs.statSync(fullPath).isFile() && entry.match(/\.(png|jpg|jpeg|gif)$/i)) {
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

function getSpriteProperties(spriteName, projectPath) {
  const tomlPath = path.join(projectPath, 'project.toml');
  if (!fs.existsSync(tomlPath)) return null;

  const content = fs.readFileSync(tomlPath, 'utf-8');

  const pattern = new RegExp(`\\[sprites\\."${spriteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]\\s*frames\\s*=\\s*(\\d+)`, 'i');
  const match = content.match(pattern);

  return match ? { frames: parseInt(match[1], 10) } : null;
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
    files
  };
}

function fromProjectJson(json) {
  const sprites = { direction: json.spriteDirection || 'vertical' };
  for (const [key, value] of Object.entries(json.files || {})) {
    if (key.startsWith('sprites/')) {
      const name = key.replace('sprites/', '');
      sprites[name] = { frames: value.properties?.frames || 1 };
    }
  }

  return {
    microrunnerVersion: VERSION,
    meta: {
      name: json.title || json.slug,
      slug: json.slug,
      created: (typeof json.date_created === 'number'
        ? new Date(json.date_created).toISOString().slice(0, 19) + 'Z'
        : json.date_created) || new Date().toISOString().slice(0, 19) + 'Z',
      lastModified: (typeof json.last_modified === 'number'
        ? new Date(json.last_modified).toISOString().slice(0, 19) + 'Z'
        : json.last_modified) || new Date().toISOString().slice(0, 19) + 'Z'
    },
    settings: {
      graphics: json.graphics?.toLowerCase() || 'm1',
      orientation: json.orientation || 'any',
      aspect: json.aspect || 'free',
      language: json.language || 'microscript_v2'
    },
    sprites
  };
}

function createConfig(name, slug, options = {}) {
  const spriteFrames = options.spriteFrames || {};
  const sprites = {
    direction: options.spriteDirection || 'vertical'
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
      lastModified: new Date().toISOString().slice(0, 19) + 'Z'
    },
    settings: {
      graphics: options.graphics || 'm1',
      orientation: options.orientation || 'any',
      aspect: options.aspect || 'free',
      language: 'microscript_v2'
    },
    sprites
  };
}

module.exports = { read, write, toProjectJson, fromProjectJson, createConfig, syncSprites, getSpriteProperties, detectSpriteFrames, touch };
