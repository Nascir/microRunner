const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');
const { PROJECT_DIRS, THUMBNAIL_DIRS, VERSION } = require('../constants');

function safeExtractZip(zipPath, destDir) {
  if (!fs.existsSync(zipPath)) {
    throw new Error('ZIP file not found');
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const projectJsonEntry = entries.find(e => e.entryName === 'project.json');
  if (!projectJsonEntry) {
    throw new Error('Invalid archive: missing project.json');
  }

  try {
    JSON.parse(projectJsonEntry.getData().toString('utf-8'));
  } catch (e) {
    throw new Error('Invalid project.json: cannot parse');
  }

  for (const dir of [...PROJECT_DIRS, ...THUMBNAIL_DIRS]) {
    const dirPath = path.join(destDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let entryPath = entry.entryName;

    if (entryPath.startsWith('ms/') && entryPath.endsWith('.ms')) {
      const msPath = entryPath.substring(3);
      if (msPath.startsWith('_') && msPath.endsWith('.ms')) {
        entryPath = `ms/${msPath.substring(1)}`;
      }
    }

    const fullPath = path.join(destDir, entryPath);
    const relative = path.relative(destDir, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Malicious path detected in ZIP: ' + entryPath);
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, entry.getData());
  }

  return {
    entries: entries,
    projectJson: JSON.parse(fs.readFileSync(path.join(destDir, 'project.json'), 'utf-8')),
  };
}

async function importProject(zipPath, options = {}) {
  if (!fs.existsSync(zipPath)) {
    throw new Error('Uploaded file not found');
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const projectJsonEntry = entries.find(e => e.entryName === 'project.json');
  if (!projectJsonEntry) {
    throw new Error('Invalid archive: missing project.json');
  }

  const projectJson = JSON.parse(projectJsonEntry.getData().toString('utf-8'));
  let warning = null;
  if (projectJson.language && projectJson.language.startsWith('microscript_v1')) {
    warning = 'This project uses microScript v1, which is not fully supported by microRunner. The game may not work correctly.';
  }

  let projectPath;
  if (options.customPath) {
    projectPath = options.customPath;
  } else {
    const baseSlug = projectJson.slug || projectJson.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const cwd = options.cwd || process.cwd();
    projectPath = path.join(cwd, baseSlug);
    let counter = 1;
    while (fs.existsSync(projectPath)) {
      projectPath = path.join(cwd, `${baseSlug}-${counter}`);
      counter++;
    }
  }

  fs.mkdirSync(projectPath, { recursive: true });

  const allDirs = [...PROJECT_DIRS, ...THUMBNAIL_DIRS];
  for (const dir of allDirs) {
    const dirPath = path.join(projectPath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let entryPath = entry.entryName;

    if (entryPath.startsWith('ms/') && entryPath.endsWith('.ms')) {
      const msPath = entryPath.substring(3);
      if (msPath.startsWith('_') && msPath.endsWith('.ms')) {
        entryPath = `ms/${msPath.substring(1)}`;
      }
    }

    const fullPath = path.join(projectPath, entryPath);
    const relative = path.relative(projectPath, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Malicious path detected in ZIP: ' + entryPath);
    }
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, entry.getData());
  }

  const tomlConfig = config.fromProjectJson(projectJson, { microrunnerVersion: VERSION });

  if (options.name) tomlConfig.meta.name = options.name;
  if (options.slug) tomlConfig.meta.slug = options.slug;
  if (options.orientation) tomlConfig.settings.orientation = options.orientation;
  if (options.aspect) tomlConfig.settings.aspect = options.aspect;
  if (options.spriteDirection) tomlConfig.sprites.direction = options.spriteDirection;

  await config.write(projectPath, tomlConfig);
  await config.touch(projectPath);

  return {
    success: true,
    slug: tomlConfig.meta.slug,
    name: tomlConfig.meta.name,
    path: projectPath,
    warning: warning,
  };
}

async function previewProject(zipPath) {
  if (!fs.existsSync(zipPath)) {
    throw new Error('Uploaded file not found');
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const projectJsonEntry = entries.find(e => e.entryName === 'project.json');
  if (!projectJsonEntry) {
    throw new Error('Invalid archive: missing project.json');
  }

  const projectJson = JSON.parse(projectJsonEntry.getData().toString('utf-8'));
  const baseSlug = projectJson.slug || projectJson.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const tomlConfig = config.fromProjectJson(projectJson);

  return {
    name: projectJson.title,
    slug: tomlConfig.meta.slug,
    orientation: projectJson.orientation || 'any',
    aspect: projectJson.aspect || 'free',
    spriteDirection: tomlConfig.sprites?.direction || 'vertical',
    warning: projectJson.language && projectJson.language.startsWith('microscript_v1')
      ? 'This project uses microScript v1, which is not fully supported by microRunner.'
      : null,
  };
}

module.exports = {
  importProject,
  previewProject,
  safeExtractZip,
};
