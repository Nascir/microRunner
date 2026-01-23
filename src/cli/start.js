const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const open = require('open');
const config = require('../project/config');
const { PROJECT_ROOT } = require('../constants');

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
    const serverPath = path.join(PROJECT_ROOT, 'server.js');
    const args = [serverPath, `--project-path=${cwd}`, `--port=${port}`];

    const child = spawn(nodePath, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      process.exit(code);
    });

    let sigintReceived = false;

    process.on('SIGINT', () => {
      if (!sigintReceived) {
        sigintReceived = true;
        child.kill('SIGINT');
      }

      setTimeout(() => {
        const files = fs.readdirSync(PROJECT_ROOT).filter(f => f.startsWith('.shutdown-'));
        if (files.length > 0) {
          try {
            for (const f of files) {
              fs.unlinkSync(path.join(PROJECT_ROOT, f));
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

module.exports = { start };
