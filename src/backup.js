const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');

const PROJECTS_DIR = path.join(__dirname, '../projects');
const ARCHIVE_DIR = path.join(__dirname, '../archive');

const DIRS = ['ms', 'sprites', 'maps', 'sounds', 'music', 'assets', 'doc'];
const THUMBNAIL_DIRS = ['sounds_th', 'music_th', 'assets_th'];

function ensureArchiveDir() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toTimeString().split(' ')[0].replace(/:/g, '');
}

function collectProjectFiles(project) {
  const projectPath = path.join(PROJECTS_DIR, project);
  const files = {
    sources: [],
    images: [],
    maps: [],
    sounds: [],
    music: [],
    assets: [],
    docs: []
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
          content: fs.readFileSync(fullPath)
        });
      }
    }
  }

  const spritesDir = path.join(projectPath, 'sprites');
  if (fs.existsSync(spritesDir)) {
    const entries = fs.readdirSync(spritesDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(spritesDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(png|jpg|jpeg|gif)$/i)) {
        files.images.push({
          archivePath: `sprites/${entry}`,
          fullPath: fullPath,
          content: fs.readFileSync(fullPath)
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
          content: fs.readFileSync(fullPath)
        });
      }
    }
  }

  const soundsDir = path.join(projectPath, 'sounds');
  if (fs.existsSync(soundsDir)) {
    const entries = fs.readdirSync(soundsDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(soundsDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(wav|mp3|ogg|flac)$/i)) {
        files.sounds.push({
          archivePath: `sounds/${entry}`,
          fullPath: fullPath,
          content: fs.readFileSync(fullPath)
        });
      }
    }
  }

  const musicDir = path.join(projectPath, 'music');
  if (fs.existsSync(musicDir)) {
    const entries = fs.readdirSync(musicDir, { recursive: true });
    for (const entry of entries) {
      const fullPath = path.join(musicDir, entry);
      if (fs.statSync(fullPath).isFile() && entry.match(/\.(wav|mp3|ogg|flac)$/i)) {
        files.music.push({
          archivePath: `music/${entry}`,
          fullPath: fullPath,
          content: fs.readFileSync(fullPath)
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
          content: fs.readFileSync(fullPath)
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
          content: fs.readFileSync(fullPath)
        });
      }
    }
  }

  return files;
}

async function createBackup(project, options = {}) {
  return new Promise((resolve, reject) => {
    ensureArchiveDir();

    const projectPath = path.join(PROJECTS_DIR, project);
    if (!fs.existsSync(projectPath)) {
      return reject(new Error('Project not found'));
    }

    const timestamp = formatDate(Date.now()) + '-' + formatTime(Date.now());
    const suffix = options.suffix || 'backup';
    const backupFileName = `${project}_${timestamp}_${suffix}.zip`;
    const backupDir = path.join(ARCHIVE_DIR, project);
    const backupPath = path.join(backupDir, backupFileName);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    config.read(projectPath).then((projectConfig) => {
      const files = collectProjectFiles(project);
      const projectJson = config.toProjectJson(projectConfig);

      const zip = new AdmZip();
      zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));

      for (const file of files.sources) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.images) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.maps) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.sounds) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.music) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.assets) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.docs) {
        zip.addFile(file.archivePath, file.content);
      }

      zip.writeZip(backupPath);

      resolve({
        fileName: backupFileName,
        fullPath: backupPath,
        timestamp: Date.now()
      });
    }).catch(reject);
  });
}

async function createExport(project) {
  return new Promise((resolve, reject) => {
    const projectPath = path.join(PROJECTS_DIR, project);
    if (!fs.existsSync(projectPath)) {
      return reject(new Error('Project not found'));
    }

    const timestamp = formatDate(Date.now()) + '-' + formatTime(Date.now());
    const fileName = `${project}_${timestamp}_export.zip`;
    const exportPath = path.join(__dirname, '../../temp_' + fileName);

    config.read(projectPath).then(async (projectConfig) => {
      const files = collectProjectFiles(project);
      const projectJson = config.toProjectJson(projectConfig);

      const zip = new AdmZip();
      zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));

      for (const file of files.sources) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.images) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.maps) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.sounds) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.music) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.assets) {
        zip.addFile(file.archivePath, file.content);
      }
      for (const file of files.docs) {
        zip.addFile(file.archivePath, file.content);
      }

      zip.writeZip(exportPath);

      resolve({
        fileName: fileName,
        filePath: exportPath
      });
    }).catch(reject);
  });
}

function listBackups(project) {
  ensureArchiveDir();

  const backupDir = path.join(ARCHIVE_DIR, project);
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const entries = fs.readdirSync(backupDir);
  const backups = [];

  for (const entry of entries) {
    if (entry.endsWith('.zip')) {
      const fullPath = path.join(backupDir, entry);
      const stats = fs.statSync(fullPath);
      backups.push({
        fileName: entry,
        size: stats.size,
        created: stats.mtime
      });
    }
  }

  backups.sort((a, b) => new Date(b.created) - new Date(a.created));
  return backups;
}

function deleteBackup(project, fileName) {
  const backupDir = path.join(ARCHIVE_DIR, project);
  const backupPath = path.join(backupDir, fileName);

  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup not found');
  }

  fs.unlinkSync(backupPath);
  return true;
}

function deleteAllBackups(project) {
  const backupDir = path.join(ARCHIVE_DIR, project);
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}

function getBackupPath(project, fileName) {
  return path.join(ARCHIVE_DIR, project, fileName);
}

function getBackupNotePath(project, backupFileName) {
  const noteFileName = backupFileName.replace('.zip', '.note.json');
  return path.join(ARCHIVE_DIR, project, noteFileName);
}

function getBackupNote(project, backupFileName) {
  const notePath = getBackupNotePath(project, backupFileName);
  if (fs.existsSync(notePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(notePath, 'utf-8'));
      return data.note || '';
    } catch (e) {
      return '';
    }
  }
  return '';
}

function saveBackupNote(project, backupFileName, noteContent) {
  const notePath = getBackupNotePath(project, backupFileName);
  const noteDir = path.dirname(notePath);
  if (!fs.existsSync(noteDir)) {
    fs.mkdirSync(noteDir, { recursive: true });
  }
  fs.writeFileSync(notePath, JSON.stringify({ note: noteContent, updated: Date.now() }, null, 2));
  return true;
}

function deleteBackupNote(project, backupFileName) {
  const notePath = getBackupNotePath(project, backupFileName);
  if (fs.existsSync(notePath)) {
    fs.unlinkSync(notePath);
    return true;
  }
  return false;
}

async function restoreProjectFromUpload(project, zipPath, options = {}) {
  try {
    ensureArchiveDir();

    if (!fs.existsSync(zipPath)) {
      throw new Error('Uploaded file not found');
    }

    if (options.createPreRestoreBackup) {
      const projectPath = path.join(PROJECTS_DIR, project);
      if (fs.existsSync(projectPath)) {
        await createBackup(project, { suffix: 'pre_restore' });
      }
    }

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const projectJsonEntry = entries.find(e => e.entryName === 'project.json');
    if (!projectJsonEntry) {
      throw new Error('Invalid archive: missing project.json');
    }

    const projectJson = JSON.parse(projectJsonEntry.getData().toString('utf-8'));

    const projectPath = path.join(PROJECTS_DIR, project);
    fs.rmSync(projectPath, { recursive: true, force: true });
    fs.mkdirSync(projectPath, { recursive: true });

    for (const dir of [...DIRS, ...THUMBNAIL_DIRS]) {
      fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
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

    const tomlConfig = config.fromProjectJson(projectJson);
    await config.write(projectPath, tomlConfig);

    return {
      success: true,
      config: {
        name: tomlConfig.meta.name,
        slug: tomlConfig.meta.slug,
        orientation: tomlConfig.settings.orientation,
        aspect: tomlConfig.settings.aspect,
        graphics: tomlConfig.settings.graphics,
        spriteDirection: tomlConfig.sprites.direction
      }
    };
  } catch (e) {
    throw e;
  }
}

function uploadBackupToArchive(project, zipPath) {
  return new Promise((resolve, reject) => {
    try {
      ensureArchiveDir();

      const projectDir = path.join(ARCHIVE_DIR, project);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const fileName = path.basename(zipPath);
      const destPath = path.join(projectDir, fileName);

      fs.copyFileSync(zipPath, destPath);

      resolve({
        success: true,
        fileName: fileName
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function restoreProject(project, backupFile, options = {}) {
  try {
    ensureArchiveDir();

    const backupPath = path.join(ARCHIVE_DIR, project, backupFile);
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    if (options.createPreRestoreBackup) {
      const projectPath = path.join(PROJECTS_DIR, project);
      if (fs.existsSync(projectPath)) {
        await createBackup(project, { suffix: 'pre_restore' });
      }
    }

    const zip = new AdmZip(backupPath);
    const entries = zip.getEntries();

    const projectJsonEntry = entries.find(e => e.entryName === 'project.json');
    if (!projectJsonEntry) {
      throw new Error('Invalid backup: missing project.json');
    }

    const projectJson = JSON.parse(projectJsonEntry.getData().toString('utf-8'));

    const projectPath = path.join(PROJECTS_DIR, project);
    fs.rmSync(projectPath, { recursive: true, force: true });
    fs.mkdirSync(projectPath, { recursive: true });

    for (const dir of [...DIRS, ...THUMBNAIL_DIRS]) {
      fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    }

    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName === 'project.json') continue;

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

    const tomlConfig = config.fromProjectJson(projectJson);
    await config.write(projectPath, tomlConfig);

    return {
      success: true,
      config: {
        name: tomlConfig.meta.name,
        slug: tomlConfig.meta.slug,
        orientation: tomlConfig.settings.orientation,
        aspect: tomlConfig.settings.aspect,
        graphics: tomlConfig.settings.graphics,
        spriteDirection: tomlConfig.sprites.direction
      }
    };
  } catch (e) {
    throw e;
  }
}

async function importProjectFromArchive(zipPath) {
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
    const baseSlug = projectJson.slug || projectJson.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let projectSlug = baseSlug;
    let counter = 1;

    while (fs.existsSync(path.join(PROJECTS_DIR, projectSlug))) {
      projectSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const projectPath = path.join(PROJECTS_DIR, projectSlug);
    fs.mkdirSync(projectPath, { recursive: true });

    for (const dir of [...DIRS, ...THUMBNAIL_DIRS]) {
      fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
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

    const tomlConfig = config.fromProjectJson(projectJson);
    await config.write(projectPath, tomlConfig);

    return {
      success: true,
      slug: projectSlug,
      name: tomlConfig.meta.name,
      warning: warning
    };
  } catch (e) {
    throw e;
  }
}

async function duplicateProject(project) {
  const projectPath = path.join(PROJECTS_DIR, project);
  if (!fs.existsSync(projectPath)) {
    throw new Error('Project not found');
  }

  const projectConfig = await config.read(projectPath);
  const baseSlug = projectConfig.meta.slug || project;
  let newSlug = `${baseSlug}-1`;
  let counter = 1;

  while (fs.existsSync(path.join(PROJECTS_DIR, newSlug))) {
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }

  const newProjectPath = path.join(PROJECTS_DIR, newSlug);
  fs.cpSync(projectPath, newProjectPath, { recursive: true });

  const newConfig = await config.read(newProjectPath);
  newConfig.meta.name = `${projectConfig.meta.name}-${counter}`;
  newConfig.meta.slug = newSlug;
  await config.write(newProjectPath, newConfig);

  const sourceArchiveDir = path.join(ARCHIVE_DIR, project);
  const destArchiveDir = path.join(ARCHIVE_DIR, newSlug);
  if (fs.existsSync(sourceArchiveDir)) {
    fs.cpSync(sourceArchiveDir, destArchiveDir, { recursive: true });
  }

  return {
    success: true,
    slug: newSlug,
    name: newConfig.meta.name
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
  uploadBackupToArchive,
  ensureArchiveDir,
  duplicateProject
};
