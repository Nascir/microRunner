const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));

function showVersion() {
  console.log(`microRunner v${pkg.version}`);
}

module.exports = { showVersion };
