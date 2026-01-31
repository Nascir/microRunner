# AGENTS.md - microRunner

Local microScript development environment - a standalone runtime for microStudio projects.

## Commands

```bash
# Server
npm start                    # Production server (port 3000)
npm run dev                  # Development server with auto-restart (nodemon)

# Linting & Quality
npm run lint                 # Run ESLint on all src/ files
npx eslint src/cli/index.js  # Lint specific file
npx eslint src/ --fix        # Auto-fix linting issues

# Testing
node microrunner.js dev/project-test/  # Run with test project
# Open http://localhost:3000 in browser and check console
```

## Code Style (ESLint)

| Rule | Value |
|------|-------|
| Indentation | 2 spaces |
| Quotes | Single (`'...'`) |
| Semicolons | Always required |
| Line endings | LF (Unix) |
| Trailing spaces | Forbidden |
| EOF newline | Required |
| Unused vars | Warn |

**Ignored:** `node_modules/`, `static/js/runtime/`, `static/js/languages/`, `static/lib/`

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `projectPath` |
| Constants | SCREAM_CASE | `MTIME_CACHE_TTL` |
| Functions | camelCase | `getProjectFiles()` |
| Classes | PascalCase | `Runtime`, `Player` |
| Files | kebab-case | `backup.js` |

## Imports & Module Structure

**Backend (Node.js) - CommonJS:**
```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');

function helperFunction() { /* ... */ }
async function mainFunction() { /* ... */ }
module.exports = { mainFunction, helperFunction };
```

**Frontend (Browser) - IIFE/Global:**
```javascript
this.Runtime = class Runtime {
  constructor() { /* ... */ }
};
```

## Error Handling

```javascript
async function getProjectConfig(projectPath) {
  try {
    const config = await configModule.read(projectPath);
    return config;
  } catch (err) {
    console.error('[Config] Error reading ' + projectPath + ':', err);
    throw err;
  }
}
```

**Rules:**
- Use `try/catch` for async operations
- Log errors with context: `console.error('[Module] Error:', err)`
- No empty catch blocks
- Handle promise rejections: `.catch(err => console.error(...))`
- Use `console.warn()` for warnings, `console.error()` for errors

## Project Structure

```
microrunner/
├── server.js                    # Express server entry point
├── microrunner.js               # CLI entry point
├── src/                         # Backend source (linted)
│   ├── cli/                     # CLI commands
│   └── project/                 # Project management modules
├── static/
│   ├── js/runtime/              # Game runtime (NOT linted)
│   ├── js/languages/            # microScript compiler (NOT linted)
│   └── css/
└── src/templates/               # Project templates (not publicly served)
```

## Critical Patterns

### Path Validation (Security)
```javascript
async function validatePath(projectPath, subdir, userPath) {
  const basePath = path.resolve(projectPath, subdir);
  const resolved = path.resolve(basePath, userPath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}
```

### WebSocket Broadcasting
```javascript
function broadcastToProject(project, message) {
  const clients = getWSClients(project);
  const msg = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
```

### Adding Runtime APIs (runtime.js)
Add new APIs in `startReady()` method:
```javascript
this.vm.context.global.screen = this.screen.getInterface();
this.vm.context.global.keyboard = this.keyboard.keyboard;
this.vm.context.global.touch = this.touch;
this.vm.context.global.mouse = this.mouse;
this.vm.context.global.system = System;
this.vm.context.global.storage = new Storage();
this.vm.context.global.audio = this.audio.getInterface();
this.vm.context.global.asset_manager = this.asset_manager.getInterface();
```

## Common Tasks

| Task | File | Notes |
|------|------|-------|
| New CLI command | `src/cli/index.js` | Add to switch, create handler |
| New API endpoint | `server.js` | Use `validatePath()` |
| New runtime API | `runtime.js` | Add to `global` in `startReady()` |
| File patterns | `src/constants.js` | Update regex patterns |
| microScript compiler | `static/js/languages/microscript/v2/` | parser, compiler, processor |

## microScript v2 Compatibility

Reference files in `dev/microstudio-master/`:
- `static/js/runtime/` - Original microStudio runtime
- `static/js/languages/microscript/v2/` - Original compiler

**Rules:**
- All microScript syntax must match microStudio exactly
- Verify changes with `dev/project-test/` project
- Check `if` expression behavior (conditionals as expressions)
