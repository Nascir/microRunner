const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const config = require('./config');
const { collectWithSizes } = require('./files');
const { THUMBNAIL_DIRS } = require('../constants');

async function createExport(projectPath) {
  const projectConfig = await config.read(projectPath);
  const slug = projectConfig.meta.slug;

  const exportDir = path.join(projectPath, 'export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  const exportPath = path.join(exportDir, `${slug}.zip`);

  const filesInfo = collectWithSizes(projectPath);

  const zip = new AdmZip();

  const projectJson = config.toMicroStudioJson(projectConfig, filesInfo);
  zip.addFile('project.json', Buffer.from(JSON.stringify(projectJson, null, 2)));

  for (const file of filesInfo.sources) {
    zip.addLocalFile(file.fullPath, 'ms', file.name);
  }
  for (const file of filesInfo.sprites) {
    zip.addLocalFile(file.fullPath, 'sprites', file.name);
  }
  for (const file of filesInfo.maps) {
    zip.addLocalFile(file.fullPath, 'maps', file.name);
  }
  for (const file of filesInfo.sounds) {
    zip.addLocalFile(file.fullPath, 'sounds', file.name);
  }
  for (const file of filesInfo.music) {
    zip.addLocalFile(file.fullPath, 'music', file.name);
  }
  for (const file of filesInfo.assets) {
    zip.addLocalFile(file.fullPath, 'assets', file.name);
  }
  for (const file of filesInfo.docs) {
    zip.addLocalFile(file.fullPath, 'doc', file.name);
  }

  for (const dir of THUMBNAIL_DIRS) {
    const thumbDir = path.join(projectPath, dir);
    if (fs.existsSync(thumbDir)) {
      zip.addLocalFolder(thumbDir, dir);
    }
  }

  zip.writeZip(exportPath);

  return { filePath: exportPath };
}

module.exports = {
  createExport,
};
