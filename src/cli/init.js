const path = require('path');
const fs = require('fs');
const readline = require('readline');
const config = require('../project/config');
const { PROJECT_ROOT, PROJECT_DIRS } = require('../constants');

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function init() {
  const cwd = process.cwd();
  const folderName = path.basename(cwd);

  const entries = fs.readdirSync(cwd);
  const nonHiddenEntries = entries.filter(e => !e.startsWith('.'));

  if (nonHiddenEntries.length > 0) {
    console.error('\nError: The current folder is not empty.');
    console.error('Found ' + nonHiddenEntries.length + ' file(s):');
    nonHiddenEntries.forEach(e => console.error('  - ' + e));
    console.error('\nRun "microrunner init" only in empty folders.\n');
    process.exit(1);
  }

  console.log('\nCreating project in ' + cwd + '\n');

  const name = await askQuestion('Project name (' + folderName + '): ') || folderName;
  const slugInput = await askQuestion('Slug (URL-friendly name, e.g., my-game): ');
  const slug = slugInput || folderName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  console.log('\nCreating project "' + name + '" with slug "' + slug + '"...\n');

  PROJECT_DIRS.forEach(dir => fs.mkdirSync(path.join(cwd, dir), { recursive: true }));

  const templatePath = path.join(PROJECT_ROOT, 'src', 'templates');
  if (fs.existsSync(path.join(templatePath, 'icon.png'))) {
    fs.copyFileSync(path.join(templatePath, 'icon.png'), path.join(cwd, 'sprites', 'icon.png'));
  }
  if (fs.existsSync(path.join(templatePath, 'main.ms'))) {
    fs.copyFileSync(path.join(templatePath, 'main.ms'), path.join(cwd, 'ms', 'main.ms'));
  }

  const projectConfig = config.createConfig(name, slug);
  config.write(cwd, projectConfig);

  await config.syncSprites(cwd);

  console.log('Project initialized successfully!\n');
  console.log('Run "microrunner start" to start the server.\n');
}

module.exports = { init };
