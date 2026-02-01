const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));

function showVersion() {
  console.log('\n📦  microRunner v' + pkg.version + '\n');
}

module.exports = { showVersion };
