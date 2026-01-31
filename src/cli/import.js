const fs = require('fs');
const path = require('path');
const { importProject } = require('../project/import');

async function importCommand() {
  const zipPath = process.argv[3];

  if (!zipPath) {
    console.error('Usage: microrunner import <file.zip>\n');
    process.exit(1);
  }

  if (!fs.existsSync(zipPath)) {
    console.error('Error: File not found: ' + zipPath + '\n');
    process.exit(1);
  }

  try {
    const result = await importProject(zipPath, { cwd: process.cwd() });

    if (result.warning) {
      console.warn(result.warning);
    }

    console.log('✅  Project "' + result.name + '" imported successfully!');
    console.log('📁  Location: ' + result.path + '\n');
    console.log('💡  Next steps:');
    console.log('   • cd ' + path.basename(result.path));
    console.log('   • microrunner start\n');
  } catch (e) {
    console.error('\nError: ' + e.message + '\n');
    process.exit(1);
  }
}

module.exports = { importCommand };
