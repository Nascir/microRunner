const fs = require('fs');
const path = require('path');
const {
  SPRITES, SOUNDS, MUSIC, ASSETS, SOURCES, MAPS, DOCS,
} = require('../constants');

function collect(projectPath) {
  const files = {
    sources: [],
    sprites: [],
    maps: [],
    sounds: [],
    music: [],
    assets: [],
    docs: [],
  };

  const msDir = path.join(projectPath, 'ms');
  if (fs.existsSync(msDir)) {
    const entries = fs.readdirSync(msDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(msDir, entry);
      if (fs.statSync(fullPath).isFile() && SOURCES.test(entry)) {
        files.sources.push({ name: entry, fullPath });
      }
    }
  }

  const spritesDir = path.join(projectPath, 'sprites');
  if (fs.existsSync(spritesDir)) {
    const entries = fs.readdirSync(spritesDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(spritesDir, entry);
      if (fs.statSync(fullPath).isFile() && SPRITES.test(entry)) {
        files.sprites.push({ name: entry, fullPath });
      }
    }
  }

  const mapsDir = path.join(projectPath, 'maps');
  if (fs.existsSync(mapsDir)) {
    const entries = fs.readdirSync(mapsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(mapsDir, entry);
      if (fs.statSync(fullPath).isFile() && MAPS.test(entry)) {
        files.maps.push({ name: entry, fullPath });
      }
    }
  }

  const soundsDir = path.join(projectPath, 'sounds');
  if (fs.existsSync(soundsDir)) {
    const entries = fs.readdirSync(soundsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(soundsDir, entry);
      if (fs.statSync(fullPath).isFile() && SOUNDS.test(entry)) {
        files.sounds.push({ name: entry, fullPath });
      }
    }
  }

  const musicDir = path.join(projectPath, 'music');
  if (fs.existsSync(musicDir)) {
    const entries = fs.readdirSync(musicDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(musicDir, entry);
      if (fs.statSync(fullPath).isFile() && MUSIC.test(entry)) {
        files.music.push({ name: entry, fullPath });
      }
    }
  }

  const assetsDir = path.join(projectPath, 'assets');
  if (fs.existsSync(assetsDir)) {
    const entries = fs.readdirSync(assetsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(assetsDir, entry);
      if (fs.statSync(fullPath).isFile() && ASSETS.test(entry)) {
        files.assets.push({ name: entry, fullPath });
      }
    }
  }

  const docDir = path.join(projectPath, 'doc');
  if (fs.existsSync(docDir)) {
    const entries = fs.readdirSync(docDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(docDir, entry);
      if (fs.statSync(fullPath).isFile() && DOCS.test(entry)) {
        files.docs.push({ name: entry, fullPath });
      }
    }
  }

  return files;
}

function collectWithSizes(projectPath) {
  const files = collect(projectPath);

  const addSize = (arr) => {
    return arr.map(item => ({
      ...item,
      size: fs.statSync(item.fullPath).size,
    }));
  };

  return {
    sources: addSize(files.sources),
    sprites: addSize(files.sprites),
    maps: addSize(files.maps),
    sounds: addSize(files.sounds),
    music: addSize(files.music),
    assets: addSize(files.assets),
    docs: addSize(files.docs),
  };
}

module.exports = {
  collect,
  collectWithSizes,
  SPRITES,
  SOUNDS,
  MUSIC,
  ASSETS,
  SOURCES,
  MAPS,
  DOCS,
};
