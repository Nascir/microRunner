const { createBackup } = require('../project/backup');

async function backupCommand() {
  const cwd = process.cwd();
  const tomlPath = require('path').join(cwd, 'project.toml');

  if (!require('fs').existsSync(tomlPath)) {
    const entries = require('fs').readdirSync(cwd);
    const nonHiddenEntries = entries.filter((e) => !e.startsWith('.'));

    console.error('\n⚠️  Cannot create backup\n');

    if (nonHiddenEntries.length === 0) {
      console.error('💡  Run "microrunner init" first to initialize a project.\n');
    } else {
      console.error('💡  This folder is not a microRunner project. Check that you\'re in the correct folder.\n');
    }

    process.exit(1);
  }

  try {
    const result = await createBackup(cwd);
    console.log('\n💾  Backup created!');
    console.log('📁  ' + result.fullPath + '\n\n');
  } catch (e) {
    console.error(`\nError: ${e.message}\n`);
    process.exit(1);
  }
}

module.exports = { backupCommand };
