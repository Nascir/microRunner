const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const platform = process.platform;
const cwd = __dirname;
const logDir = path.join(cwd, 'logs');
const logPath = path.join(logDir, 'restart.log');

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    console.error('Cannot create logs directory');
  }
}

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (e) {
  }
  console.log(msg);
}

log('🔄 Restarting microRunner server...');

try {
  if (platform === 'win32') {
    const psScript = `
      chcp 65001 >$null
      Set-Location -Path "${cwd}"
      npm install
      if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed"
        exit 1
      }
      npm start
    `;
    const child = spawn('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psScript
    ], {
      stdio: 'pipe',
      detached: true,
      windowsHide: true
    });
    child.stdout.on('data', (d) => log(d.toString().trim()));
    child.stderr.on('data', (d) => log('ERROR: ' + d.toString().trim()));
    child.on('error', (e) => log('SPAWN ERROR: ' + e.message));
    child.unref();
    log('✅ Server restart initiated on Windows');
  } else {
    const shScript = `cd "${cwd}" && npm install && npm start`;
    const child = spawn('sh', ['-c', shScript], {
      stdio: 'pipe',
      detached: true
    });
    child.stdout.on('data', (d) => log(d.toString().trim()));
    child.stderr.on('data', (d) => log('ERROR: ' + d.toString().trim()));
    child.on('error', (e) => log('SPAWN ERROR: ' + e.message));
    child.unref();
    log('✅ Server restart initiated on Unix-like system');
  }
} catch (e) {
  log('FATAL: ' + e.message);
}

process.exit(0);
