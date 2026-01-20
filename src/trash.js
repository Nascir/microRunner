const fs = require('fs');
const path = require('path');

const TRASH_RETENTION_DAYS = 30;

function getTrashPath() {
  const trashPath = path.join(__dirname, '..', 'trash');
  if (!fs.existsSync(trashPath)) {
    fs.mkdirSync(trashPath, { recursive: true });
  }
  return trashPath;
}

function generateUniqueTrashName(baseName) {
  const trashPath = getTrashPath();
  const baseFolder = path.join(trashPath, baseName);
  if (!fs.existsSync(baseFolder)) {
    return baseName;
  }
  let counter = 1;
  do {
    const candidate = `${baseName}-${counter}`;
    const candidatePath = path.join(trashPath, candidate);
    if (!fs.existsSync(candidatePath)) {
      return candidate;
    }
    counter++;
  } while (true);
}

function moveToTrash(projectPath, slug) {
  const trashPath = getTrashPath();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const baseName = `${slug}_${timestamp}`;
  const uniqueName = generateUniqueTrashName(baseName);
  const destPath = path.join(trashPath, uniqueName);

  fs.renameSync(projectPath, destPath);

  return {
    trashPath: destPath,
    deletedAt: Date.now(),
  };
}

function emptyExpiredTrash() {
  const trashPath = getTrashPath();
  if (!fs.existsSync(trashPath)) {
    return 0;
  }

  const cutoffTime = Date.now() - (TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const entries = fs.readdirSync(trashPath, { withFileTypes: true });
  let deletedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(trashPath, entry.name);
    const stats = fs.statSync(fullPath);

    if (stats.mtimeMs < cutoffTime) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      deletedCount++;
    }
  }

  return deletedCount;
}

module.exports = {
  getTrashPath,
  generateUniqueTrashName,
  moveToTrash,
  emptyExpiredTrash,
};
