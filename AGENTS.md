# AGENTS.md - microRunner

## Build & Test Commands

```bash
npm start          # Production server (port 3000)
npm run dev        # Development server with auto-restart
npm run lint       # Run ESLint on all JS files

# Lint specific file
npx eslint src/cli/index.js

# Auto-fix linting issues
npx eslint . --ext .js --fix
```

## Testing

**Manual testing only** - Load microScript files in browser, check console.

**Test location:** `/Users/slawomir/Developer/Testing/ms/`
- `main.ms` - Comprehensive microScript v2 compatibility tests
- `this-test.ms` - Tests for `this` behavior

## Code Style (ESLint Enforced)

| Rule | Value |
|------|-------|
| Indentation | 2 spaces |
| Quotes | Single (`'...'`) |
| Semicolons | Always required |
| Line endings | LF (Unix) |
| Trailing commas | Multiline only |

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `projectPath` |
| Constants | SCREAMING_SNAKE_CASE | `MTIME_CACHE_TTL` |
| Functions | camelCase | `getProjectFiles()` |
| Classes | PascalCase | `Runtime`, `Player` |
| Files | kebab-case | `backup.js` |

## Imports & Module Structure

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');

function helperFunction() { /* ... */ }

async function mainFunction() { /* ... */ }

module.exports = { mainFunction, helperFunction };
```

## Error Handling

```javascript
async function getProjectConfig(projectPath) {
  try {
    const config = await configModule.read(projectPath);
    return config;
  } catch (err) {
    console.error(`[Config] Error reading ${projectPath}:`, err);
    throw err;
  }
}
```

- Use `try/catch` for async operations
- Log errors with context: `console.error('[Module] Error:', err)`
- No empty catch blocks
- Always handle promise rejections: `.catch(err => console.error(...))`

## Project Structure

```
src/
├── cli/          # CLI commands (index.js, start.js, import.js)
└── project/      # Backend modules (config.js, backup.js, export.js)

static/
├── js/
│   ├── runtime/       # Game runtime (runtime.js, screen.js, microvm.js)
│   └── languages/     # microScript v2 (parser, tokenizer, compiler, processor)
├── css/               # Stylesheets
└── *.html             # HTML pages
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

### Terminal Clear
```javascript
process.stdout.write('\x1Bc');
console.log('🎮 microRunner is launching...');
```

## Hot Reload Flow

1. File changes in `ms/` directory
2. `chokidar` detects change → broadcasts `{ type: 'update', file, code }`
3. Client receives via WebSocket → `runtime.updateSource(file, code)`
4. VM re-compiles, game continues without restart

## Common Tasks

| Task | File | Notes |
|------|------|-------|
| New CLI command | `src/cli/index.js` | Add to switch, create handler |
| New API endpoint | `server.js` | Use `validatePath()` |
| New runtime API | `static/js/runtime/runtime.js` | Add to `global` in `startReady()` |
| File patterns | `src/constants.js` | Update regex patterns |
| microScript compiler | `static/js/languages/microscript/v2/` | parser.js, compiler.js, processor.js |

## Codebase Overview

- **Server**: Express + WebSocket (ws) for real-time updates
- **Runtime**: Custom microScript v2 VM in `static/js/runtime/`
- **Hot Reload**: File watcher triggers recompilation via WebSocket
- **Assets**: Images, sounds, maps served via API endpoints
- **Project Config**: `project.toml` with sprites, settings, metadata

## microScript v2 Compatibility

The compiler is derived from microStudio and supports:
- Conditionals as expressions: `x = if cond then "a" else "b" end`
- All standard operations, loops, functions, classes
- The `if` construct uses stack-based VM - last statement value is returned

When modifying the compiler:
- Test changes with `main.ms` test suite
- Verify `if` expression behavior still works
- Check both statement and expression forms of `if`
