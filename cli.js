#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const readline = require('readline');
const open = require('open');
const config = require('./src/config.js');
const backup = require('./src/backup.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

function showHelp() {
  console.log(`microRunner - Local microScript development environment

Usage: microrunner <command>

Commands:
  init     Initialize a new project in current folder
  import   Import a project from microStudio ZIP file
  start    Scan sprites and start the server
  version  Show version
  help     Show this help

Examples:
  cd ~/projects/my-game
  microrunner init
  microrunner start
 `);
}

function showVersion() {
  console.log(`microRunner v${pkg.version}`);
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
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
    console.error(`\n❌ Error: The current folder is not empty.`);
    console.error(`Found ${nonHiddenEntries.length} file(s):`);
    nonHiddenEntries.forEach(e => console.error(`  - ${e}`));
    console.error(`\nRun "microrunner init" only in empty folders.\n`);
    process.exit(1);
  }

  console.log(`\nCreating project in ${cwd}\n`);

  const name = await askQuestion(`Project name (${folderName}): `) || folderName;
  const slugInput = await askQuestion(`Slug (URL-friendly name, e.g., my-game): `);
  const slug = slugInput || folderName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  console.log(`\nCreating project "${name}" with slug "${slug}"...\n`);

  const subdirs = ['ms', 'sprites', 'assets', 'maps', 'music', 'sounds'];
  subdirs.forEach(dir => fs.mkdirSync(path.join(cwd, dir), { recursive: true }));

  const templatePath = path.join(__dirname, 'static', 'template');
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

async function start() {
  const cwd = process.cwd();
  const tomlPath = path.join(cwd, 'project.toml');

  if (!fs.existsSync(tomlPath)) {
    console.error(`Error: project.toml not found in ${cwd}`);
    console.error('Run "microrunner init" first to initialize a project.\n');
    process.exit(1);
  }

  const projectConfig = await config.read(cwd);
  const slug = projectConfig.meta.slug;

  console.log('Checking for sprite changes...');
  await config.syncSprites(cwd);

  const startPort = 3000;
  const maxPort = startPort + 100;

  function findAvailablePort(port, callback) {
    const server = http.createServer();
    server.listen(port, '127.0.0.1', () => {
      server.close(() => callback(port));
    });
    server.on('error', () => {
      if (port < maxPort) {
        findAvailablePort(port + 1, callback);
      } else {
        console.error('Error: No available ports');
        process.exit(1);
      }
    });
  }

  findAvailablePort(startPort, (port) => {
    const nodePath = process.execPath;
    const serverPath = path.join(__dirname, 'server.js');
    const args = [serverPath, `--project-path=${cwd}`, `--port=${port}`];

    const child = spawn(nodePath, args, {
      cwd: __dirname,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('exit', (code) => {
      process.exit(code);
    });

    let sigintReceived = false;
    const shutdownMarker = path.join(__dirname, '.shutdown-');

    process.on('SIGINT', () => {
      if (!sigintReceived) {
        sigintReceived = true;
        child.kill('SIGINT');
      }
      
      setTimeout(() => {
        const files = fs.readdirSync(__dirname).filter(f => f.startsWith('.shutdown-'));
        if (files.length > 0) {
          try {
            for (const f of files) {
              fs.unlinkSync(path.join(__dirname, f));
            }
          } catch (e) {}
        }
      }, 500);
    });

    setTimeout(async () => {
      const url = `http://localhost:${port}/${slug}`;
      try {
        await open.default(url);
      } catch (e) {
        console.error(`Failed to open browser: ${e.message}`);
      }
    }, 1000);
  });
}

async function importCommand() {
  const zipPath = process.argv[3];

  if (!zipPath) {
    console.error('Usage: microrunner import <file.zip>\n');
    process.exit(1);
  }

  if (!fs.existsSync(zipPath)) {
    console.error(`Error: File not found: ${zipPath}\n`);
    process.exit(1);
  }

  try {
    const result = await backup.importProjectFromArchive(zipPath, { cwd: process.cwd() });

    if (result.warning) {
      console.warn(`\n⚠️  ${result.warning}\n`);
    }

    console.log(`\nProject "${result.name}" imported successfully!`);
    console.log(`Location: ${result.path}`);
    console.log(`\nTo get started:`);
    console.log(`  cd "${result.path}"`);
    console.log(`  microrunner start\n`);
  } catch (e) {
    console.error(`\nError: ${e.message}\n`);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'init':
      await init();
      break;
    case 'import':
      await importCommand();
      break;
    case 'start':
      await start();
      break;
    case 'version':
      showVersion();
      break;
    case 'help':
      showHelp();
      break;
    case undefined:
      showHelp();
      break;
    default:
      console.log(`Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

main();
