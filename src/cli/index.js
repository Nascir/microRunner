const { init } = require('./init');
const { start } = require('./start');
const { importCommand } = require('./import');
const { exportCommand } = require('./export');
const { backupCommand } = require('./backup');
const { showHelp } = require('./help');
const { showVersion } = require('./version');

async function main() {
  const command = process.argv[2];

  switch (command) {
  case 'init':
    await init();
    break;
  case 'start':
    await start(process.argv[3] === '--chrome');
    break;
  case 'import':
    await importCommand();
    break;
  case 'export':
    await exportCommand();
    break;
  case 'backup':
    await backupCommand();
    break;
  case 'version':
    showVersion();
    break;
  case undefined:
    showHelp();
    break;
  default:
    console.log('Unknown command: ' + command + '\n');
    showHelp();
    process.exit(1);
  }
}

module.exports = { main };
