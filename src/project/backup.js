const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');
const { collect } = require('./files');
const { VERSION } = require('../constants');

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toTimeString().split(' ')[0].replace(/:/g, '');
}

function getProjectArchiveDir(projectPath) {
  return path.join(projectPath, 'backup');
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

async function createBackup(project, options = {}) {
  let projectPath;
  try {
    projectPath = await getProjectPath(project);
  } catch {
    throw new Error('Project not found');
  }

  const projectConfig = await config.read(projectPath);
  const slug = projectConfig.meta.slug;

  const timestamp = formatDate(Date.now()) + '-' + formatTime(Date.now());
  const suffix = options.suffix || 'backup';
  const backupFileName = `${slug}_${timestamp}_${suffix}.zip`;
  const archiveDir = getProjectArchiveDir(projectPath);
  const backupPath = path.join(archiveDir, backupFileName);

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const files = collect(projectPath);

  const zip = new AdmZip();

  const tomlPath = path.join(projectPath, 'project.toml');
  if (fs.existsSync(tomlPath)) {
    zip.addLocalFile(tomlPath);
  } else {
    const projectJson = config.toProjectJson(projectConfig);
    zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));
  }

  for (const file of files.sources) {
    zip.addLocalFile(file.fullPath, 'ms', file.name);
  }
  for (const file of files.sprites) {
    zip.addLocalFile(file.fullPath, 'sprites', file.name);
  }
  for (const file of files.maps) {
    zip.addLocalFile(file.fullPath, 'maps', file.name);
  }
  for (const file of files.sounds) {
    zip.addLocalFile(file.fullPath, 'sounds', file.name);
  }
  for (const file of files.music) {
    zip.addLocalFile(file.fullPath, 'music', file.name);
  }
  for (const file of files.assets) {
    zip.addLocalFile(file.fullPath, 'assets', file.name);
  }
  for (const file of files.docs) {
    zip.addLocalFile(file.fullPath, 'doc', file.name);
  }

  zip.writeZip(backupPath);

  return {
    fileName: backupFileName,
    fullPath: backupPath,
    timestamp: Date.now(),
  };
}

function listBackups(project) {
  return new Promise(async (resolve) => {
    let projectPath;
    try {
      projectPath = await getProjectPath(project);
    } catch {
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
    } catch {
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

async function restoreProject(project, backupFile, options = {}) {
  try {
    let projectPath;
    try {
      projectPath = getProjectPath(project);
    } catch {
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

    const { safeExtractZip } = require('./import');
    const tempDir = path.join(path.dirname(projectPath), `temp_restore_${project}_${Date.now()}`);

    try {
      safeExtractZip(backupPath, tempDir);
    } catch (e) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw new Error('Invalid backup: ' + e.message);
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

module.exports = {
  createBackup,
  listBackups,
  deleteBackup,
  restoreProject,
  getProjectPath,
  getProjectArchiveDir,
};
