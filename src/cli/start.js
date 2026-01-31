const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const open = require('open');
const { apps } = require('open');
const config = require('../project/config');
const { PROJECT_ROOT } = require('../constants');

async function start(chromeFlag = false) {
  const cwd = process.cwd();
  const tomlPath = path.join(cwd, 'project.toml');

  if (!fs.existsSync(tomlPath)) {
    const entries = fs.readdirSync(cwd);
    const nonHiddenEntries = entries.filter((e) => !e.startsWith('.'));

    console.error('\n⚠️  Cannot start project');

    if (nonHiddenEntries.length === 0) {
      console.error('💡  Run "microrunner init" first to initialize a project.\n');
    } else {
      console.error('💡  This folder is not a microRunner project. Check that you\'re in the correct folder.\n');
    }

    process.exit(1);
  }

  const projectConfig = await config.read(cwd);
  const slug = projectConfig.meta.slug;

  process.stdout.write('\x1Bc');
  console.log('🎮 microRunner is launching...');
  console.log('👀 Checking for sprite changes...');
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
    const serverPath = path.join(PROJECT_ROOT, 'server.js');
    const args = [serverPath, `--project-path=${cwd}`, `--port=${port}`];

    const child = spawn(nodePath, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (sigintReceived) {
        console.log('🔴 Server stopped.');
      }
      process.exit(code);
    });

    let sigintReceived = false;

    process.on('SIGINT', () => {
      if (!sigintReceived) {
        sigintReceived = true;
        console.log('\rStopping server...');
        child.kill('SIGINT');
      }

      setTimeout(() => {
        const files = fs.readdirSync(PROJECT_ROOT).filter(f => f.startsWith('.shutdown-'));
        if (files.length > 0) {
          try {
            for (const f of files) {
              fs.unlinkSync(path.join(PROJECT_ROOT, f));
            }
          } catch {}
        }
      }, 500);
    });

    setTimeout(async () => {
      const url = `http://localhost:${port}/${slug}`;
      try {
        if (chromeFlag) {
          await open.default(url, { app: { name: apps.chrome } });
        } else {
          await open.default(url);
        }
      } catch (e) {
        console.error(`Failed to open browser: ${e.message}`);
      }
    }, 1000);
  });
}

module.exports = { start };
