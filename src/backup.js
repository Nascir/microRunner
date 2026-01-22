const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
const VERSION = pkg.version;

const DIRS = ['ms', 'sprites', 'maps', 'sounds', 'music', 'assets', 'doc'];
const THUMBNAIL_DIRS = ['sounds_th', 'music_th', 'assets_th'];

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toTimeString().split(' ')[0].replace(/:/g, '');
}

function getProjectArchiveDir(projectPath) {
  return path.join(projectPath, 'archive');
}

async function findProjectPath(startPath) {
  let current = path.resolve(startPath);
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

async function getProjectPath(slug) {
  const projectPath = await findProjectPath(slug);
  if (!projectPath) {
    throw new Error('Project not found');
  }
  return projectPath;
}

function collectProjectFiles(projectPath) {
  const files = {
    sources: [],
    images: [],
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
      if (fs.statSync(fullPath).isFile() && entry.endsWith('.ms')) {
        files.sources.push({
          archivePath: `ms/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  const spritesDir = path.join(projectPath, 'sprites');
  if (fs.existsSync(spritesDir)) {
    const entries = fs.readdirSync(spritesDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(spritesDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(png|jpg|jpeg)$/i)) {
        files.images.push({
          archivePath: `sprites/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  const mapsDir = path.join(projectPath, 'maps');
  if (fs.existsSync(mapsDir)) {
    const entries = fs.readdirSync(mapsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(mapsDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.endsWith('.json')) {
        files.maps.push({
          archivePath: `maps/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  const soundsDir = path.join(projectPath, 'sounds');
  if (fs.existsSync(soundsDir)) {
    const entries = fs.readdirSync(soundsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(soundsDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(wav|ogg|flac)$/i)) {
        files.sounds.push({
          archivePath: `sounds/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  const musicDir = path.join(projectPath, 'music');
  if (fs.existsSync(musicDir)) {
    const entries = fs.readdirSync(musicDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(musicDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(mp3|ogg|flac)$/i)) {
        files.music.push({
          archivePath: `music/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  const assetsDir = path.join(projectPath, 'assets');
  if (fs.existsSync(assetsDir)) {
    const entries = fs.readdirSync(assetsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(assetsDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(glb|obj|jpg|ttf|wasm|txt|csv|json)$/i)) {
        files.assets.push({
          archivePath: `assets/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  const docDir = path.join(projectPath, 'doc');
  if (fs.existsSync(docDir)) {
    const entries = fs.readdirSync(docDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(docDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.endsWith('.md')) {
        files.docs.push({
          archivePath: `doc/${entry}`,
          fullPath: fullPath,
        });
      }
    }
  }

  return files;
}

async function createBackup(project, options = {}) {
  let projectPath;
  try {
    projectPath = await getProjectPath(project);
  } catch (e) {
    throw new Error('Project not found');
  }

  const timestamp = formatDate(Date.now()) + '-' + formatTime(Date.now());
  const suffix = options.suffix || 'backup';
  const backupFileName = `${project}_${timestamp}_${suffix}.zip`;
  const archiveDir = getProjectArchiveDir(projectPath);
  const backupPath = path.join(archiveDir, backupFileName);

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const projectConfig = await config.read(projectPath);
  const files = collectProjectFiles(projectPath);
  const projectJson = config.toProjectJson(projectConfig);

  const zip = new AdmZip();
  zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));

  for (const file of files.sources) {
    zip.addLocalFile(file.fullPath, 'ms');
  }
  for (const file of files.images) {
    zip.addLocalFile(file.fullPath, 'sprites');
  }
  for (const file of files.maps) {
    zip.addLocalFile(file.fullPath, 'maps');
  }
  for (const file of files.sounds) {
    zip.addLocalFile(file.fullPath, 'sounds');
  }
  for (const file of files.music) {
    zip.addLocalFile(file.fullPath, 'music');
  }
  for (const file of files.assets) {
    zip.addLocalFile(file.fullPath, 'assets');
  }
  for (const file of files.docs) {
    zip.addLocalFile(file.fullPath, 'doc');
  }

  zip.writeZip(backupPath);

  return {
    fileName: backupFileName,
    fullPath: backupPath,
    timestamp: Date.now(),
  };
}

async function createExport(project) {
  let projectPath;
  try {
    projectPath = await getProjectPath(project);
  } catch (e) {
    throw new Error('Project not found');
  }

  const timestamp = formatDate(Date.now()) + '-' + formatTime(Date.now());
  const fileName = `${project}_${timestamp}_export.zip`;
  const exportPath = path.join(__dirname, '../../temp_' + fileName);

  const projectConfig = await config.read(projectPath);
  const files = collectProjectFiles(projectPath);
  const projectJson = config.toProjectJson(projectConfig);

  const zip = new AdmZip();
  zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));

  for (const file of files.sources) {
    zip.addLocalFile(file.fullPath, 'ms');
  }
  for (const file of files.images) {
    zip.addLocalFile(file.fullPath, 'sprites');
  }
  for (const file of files.maps) {
    zip.addLocalFile(file.fullPath, 'maps');
  }
  for (const file of files.sounds) {
    zip.addLocalFile(file.fullPath, 'sounds');
  }
  for (const file of files.music) {
    zip.addLocalFile(file.fullPath, 'music');
  }
  for (const file of files.assets) {
    zip.addLocalFile(file.fullPath, 'assets');
  }
  for (const file of files.docs) {
    zip.addLocalFile(file.fullPath, 'doc');
  }

  zip.writeZip(exportPath);

  return {
    fileName: fileName,
    filePath: exportPath,
  };
}

function listBackups(project) {
  return new Promise(async (resolve, reject) => {
    let projectPath;
    try {
      projectPath = await getProjectPath(project);
    } catch (e) {
      return resolve([]);
    }

    const archiveDir = getProjectArchiveDir(projectPath);
    if (!fs.existsSync(archiveDir)) {
      return resolve([]);
    }

    const entries = fs.readdirSync(archiveDir);
    const backups = [];

    for (const entry of entries) {
      if (entry.endsWith('.zip')) {
        const fullPath = path.join(archiveDir, entry);
        const stats = fs.statSync(fullPath);
        backups.push({
          fileName: entry,
          size: stats.size,
          created: stats.mtime,
        });
      }
    }

    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    resolve(backups);
  });
}

function deleteBackup(project, fileName) {
  return new Promise(async (resolve, reject) => {
    let projectPath;
    try {
      projectPath = await getProjectPath(project);
    } catch (e) {
      return reject(new Error('Project not found'));
    }

    const archiveDir = getProjectArchiveDir(projectPath);
    const backupPath = path.join(archiveDir, fileName);

    if (!fs.existsSync(backupPath)) {
      return reject(new Error('Backup not found'));
    }

    fs.unlinkSync(backupPath);
    resolve(true);
  });
}

function deleteAllBackups(project) {
  return new Promise(async (resolve, reject) => {
    let projectPath;
    try {
      projectPath = await getProjectPath(project);
    } catch (e) {
      return resolve();
    }

    const archiveDir = getProjectArchiveDir(projectPath);
    if (fs.existsSync(archiveDir)) {
      fs.rmSync(archiveDir, { recursive: true, force: true });
    }
    resolve();
  });
}

function getBackupPath(project, fileName) {
  return new Promise(async (resolve, reject) => {
    let projectPath;
    try {
      projectPath = await getProjectPath(project);
    } catch (e) {
      return reject(new Error('Project not found'));
    }

    const archiveDir = getProjectArchiveDir(projectPath);
    resolve(path.join(archiveDir, fileName));
  });
}

function getBackupNotePath(project, backupFileName) {
  return new Promise(async (resolve, reject) => {
    let projectPath;
    try {
      projectPath = await getProjectPath(project);
    } catch (e) {
      return reject(new Error('Project not found'));
    }

    const noteFileName = backupFileName.replace('.zip', '.note.json');
    const archiveDir = getProjectArchiveDir(projectPath);
    resolve(path.join(archiveDir, noteFileName));
  });
}

function getBackupNote(project, backupFileName) {
  return new Promise(async (resolve, reject) => {
    let notePath;
    try {
      notePath = await getBackupNotePath(project, backupFileName);
    } catch (e) {
      return resolve('');
    }

    if (fs.existsSync(notePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(notePath, 'utf-8'));
        resolve(data.note || '');
      } catch (e) {
        resolve('');
      }
    }
    resolve('');
  });
}

function saveBackupNote(project, backupFileName, noteContent) {
  return new Promise(async (resolve, reject) => {
    let notePath;
    try {
      notePath = await getBackupNotePath(project, backupFileName);
    } catch (e) {
      return reject(e);
    }

    const noteDir = path.dirname(notePath);
    if (!fs.existsSync(noteDir)) {
      fs.mkdirSync(noteDir, { recursive: true });
    }
    fs.writeFileSync(notePath, JSON.stringify({ note: noteContent, updated: Date.now() }, null, 2));
    resolve(true);
  });
}

function deleteBackupNote(project, backupFileName) {
  return new Promise(async (resolve, reject) => {
    let notePath;
    try {
      notePath = getBackupNotePath(project, backupFileName);
    } catch (e) {
      return resolve(false);
    }

    if (fs.existsSync(notePath)) {
      fs.unlinkSync(notePath);
      resolve(true);
    }
    resolve(false);
  });
}

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

  for (const dir of [...DIRS, ...THUMBNAIL_DIRS]) {
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

async function restoreProjectFromUpload(project, zipPath, options = {}) {
  try {
    let projectPath;
    try {
      projectPath = getProjectPath(project);
    } catch (e) {
      throw new Error('Project not found in registry');
    }

    const tempDir = path.join(path.dirname(projectPath), `temp_restore_${project}_${Date.now()}`);

    if (options.createPreRestoreBackup) {
      if (fs.existsSync(projectPath)) {
        await createBackup(project, { suffix: 'pre_restore' });
      }
    }

    try {
      safeExtractZip(zipPath, tempDir);
    } catch (e) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw new Error('Invalid or corrupt archive: ' + e.message);
    }

    const tempProjectJsonPath = path.join(tempDir, 'project.json');
    const projectJson = JSON.parse(fs.readFileSync(tempProjectJsonPath, 'utf-8'));
    const tomlConfig = config.fromProjectJson(projectJson, { microrunnerVersion: VERSION });

    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    fs.renameSync(tempDir, projectPath);

    await config.write(projectPath, tomlConfig);

    return {
      success: true,
      config: {
        name: tomlConfig.meta.name,
        slug: tomlConfig.meta.slug,
        orientation: tomlConfig.settings.orientation,
        aspect: tomlConfig.settings.aspect,
        graphics: tomlConfig.settings.graphics,
        spriteDirection: tomlConfig.sprites.direction,
      },
    };
  } catch (e) {
    throw e;
  }
}

function uploadBackupToArchive(project, zipPath) {
  return new Promise(async (resolve, reject) => {
    try {
      let projectPath;
      try {
        projectPath = await getProjectPath(project);
      } catch (e) {
        return reject(new Error('Project not found in registry'));
      }

      const archiveDir = getProjectArchiveDir(projectPath);
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const fileName = path.basename(zipPath);
      const destPath = path.join(archiveDir, fileName);

      fs.copyFileSync(zipPath, destPath);

      resolve({
        success: true,
        fileName: fileName,
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function restoreProject(project, backupFile, options = {}) {
  try {
    let projectPath;
    try {
      projectPath = getProjectPath(project);
    } catch (e) {
      throw new Error('Project not found in registry');
    }

    let archiveDir = getProjectArchiveDir(projectPath);
    const backupPath = path.join(archiveDir, backupFile);
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    if (options.createPreRestoreBackup) {
      if (fs.existsSync(projectPath)) {
        await createBackup(project, { suffix: 'pre_restore' });
        archiveDir = getProjectArchiveDir(projectPath);
      }
    }

    const tempDir = path.join(path.dirname(projectPath), `temp_restore_${project}_${Date.now()}`);

    try {
      safeExtractZip(backupPath, tempDir);
    } catch (e) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw new Error('Invalid or backup: ' + e.message);
    }

    const tempProjectJsonPath = path.join(tempDir, 'project.json');
    const projectJson = JSON.parse(fs.readFileSync(tempProjectJsonPath, 'utf-8'));
    const tomlConfig = config.fromProjectJson(projectJson, { microrunnerVersion: VERSION });

    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    fs.renameSync(tempDir, projectPath);

    await config.write(projectPath, tomlConfig);

    return {
      success: true,
      config: {
        name: tomlConfig.meta.name,
        slug: tomlConfig.meta.slug,
        orientation: tomlConfig.settings.orientation,
        aspect: tomlConfig.settings.aspect,
        graphics: tomlConfig.settings.graphics,
        spriteDirection: tomlConfig.sprites.direction,
      },
    };
  } catch (e) {
    throw e;
  }
}

async function previewProjectFromArchive(zipPath) {
  try {
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
    const suggestedPath = await config.generateDefaultProjectPath(baseSlug);

    const tomlConfig = config.fromProjectJson(projectJson);

    return {
      name: projectJson.title,
      slug: tomlConfig.meta.slug,
      orientation: projectJson.orientation || 'any',
      aspect: projectJson.aspect || 'free',
      spriteDirection: tomlConfig.sprites?.direction || 'vertical',
      suggestedPath: suggestedPath,
      warning: projectJson.language && projectJson.language.startsWith('microscript_v1')
        ? 'This project uses microScript v1, which is not fully supported by microRunner.'
        : null,
    };
  } catch (e) {
    throw e;
  }
}

async function importProjectFromArchive(zipPath, options = {}) {
  try {
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

    const allDirs = [...DIRS, ...THUMBNAIL_DIRS];
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
  } catch (e) {
    throw e;
  }
}

async function duplicateProject(project, options = {}) {
  let projectPath;
  try {
    projectPath = await getProjectPath(project);
  } catch (e) {
    throw new Error('Project not found');
  }

  const projectConfig = await config.read(projectPath);
  const baseSlug = projectConfig.meta.slug || project;

  let newProjectPath = options.path || await config.generateDefaultProjectPath(baseSlug);
  let newSlug = path.basename(newProjectPath);

  if (!options.path) {
    let counter = 1;
    while (fs.existsSync(newProjectPath)) {
      counter++;
      newProjectPath = await config.generateDefaultProjectPath(`${baseSlug}-${counter}`);
      newSlug = path.basename(newProjectPath);
    }
  }

  fs.cpSync(projectPath, newProjectPath, { recursive: true });

  const newConfig = await config.read(newProjectPath);
  newConfig.meta.name = options.name || `${projectConfig.meta.name}-1`;
  newConfig.meta.slug = newSlug;
  if (options.orientation) newConfig.settings.orientation = options.orientation;
  if (options.aspect) newConfig.settings.aspect = options.aspect;
  if (options.spriteDirection) newConfig.sprites.direction = options.spriteDirection;
  await config.write(newProjectPath, newConfig);

  await config.addProject(newSlug, newProjectPath);

  return {
    success: true,
    slug: newSlug,
    name: newConfig.meta.name,
    path: newProjectPath,
  };
}

async function getDuplicatePreview(project) {
  let projectPath;
  try {
    projectPath = await getProjectPath(project);
  } catch (e) {
    throw new Error('Project not found');
  }

  const projectConfig = await config.read(projectPath);
  const baseSlug = projectConfig.meta.slug || project;

  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;
  let newProjectPath = await config.generateDefaultProjectPath(baseSlug);

  while (fs.existsSync(newProjectPath)) {
    counter++;
    newProjectPath = await config.generateDefaultProjectPath(`${baseSlug}-${counter}`);
    newSlug = path.basename(newProjectPath);
  }

  return {
    name: projectConfig.meta.name,
    slug: projectConfig.meta.slug,
    suggestedName: `${projectConfig.meta.name}-${counter}`,
    suggestedPath: newProjectPath,
    orientation: projectConfig.settings.orientation || 'any',
    aspect: projectConfig.settings.aspect || 'free',
    spriteDirection: projectConfig.sprites?.direction || 'vertical',
  };
}

module.exports = {
  createBackup,
  createExport,
  listBackups,
  deleteBackup,
  deleteAllBackups,
  getBackupPath,
  getBackupNotePath,
  getBackupNote,
  saveBackupNote,
  deleteBackupNote,
  restoreProject,
  restoreProjectFromUpload,
  importProjectFromArchive,
  previewProjectFromArchive,
  uploadBackupToArchive,
  duplicateProject,
  getDuplicatePreview,
  getProjectPath,
};
