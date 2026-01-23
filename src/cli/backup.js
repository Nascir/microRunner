const { createBackup } = require('../project/backup');

async function backupCommand() {
  const cwd = process.cwd();
  const tomlPath = require('path').join(cwd, 'project.toml');

  if (!require('fs').existsSync(tomlPath)) {
    console.error(`Error: project.toml not found in ${cwd}`);
    console.error('Run "microrunner init" first to initialize a project.\n');
    process.exit(1);
  }

  try {
    const result = await createBackup(cwd);
    console.log(`\nBackup created: ${result.fullPath}\n`);
  } catch (e) {
    console.error(`\nError: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { backupCommand };
