const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');
const { PROJECT_DIRS } = require('../constants');

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

  const zip = new AdmZip();

  const tomlPath = path.join(projectPath, 'project.toml');
  if (fs.existsSync(tomlPath)) {
    zip.addLocalFile(tomlPath);
  } else {
    const projectJson = config.toProjectJson(projectConfig);
    zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));
  }

  for (const dir of PROJECT_DIRS) {
    const fullPath = path.join(projectPath, dir);
    if (fs.existsSync(fullPath)) {
      zip.addLocalFolder(fullPath, dir);
    }
    zip.addFile(dir + '/', Buffer.from(''));
  }

  zip.writeZip(backupPath);

  return {
    fileName: backupFileName,
    fullPath: backupPath,
    timestamp: Date.now(),
  };
}

module.exports = {
  createBackup,
  getProjectPath,
  getProjectArchiveDir,
};
