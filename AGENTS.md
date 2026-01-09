# AGENTS.md - microRunner

This file provides guidelines for AI agents working on this codebase.

## Project Overview

microRunner is a local development environment for microStudio games. It consists of:
- **Server**: Node.js/Express with WebSocket support for hot reload
- **Frontend**: Vanilla JavaScript with full microStudio Runtime for game execution
- **Compiler**: microScript v2 compiler files (copied from upstream microStudio)

## Directory Structure (Temporary Dev Info)

| Directory | Purpose |
|-----------|---------|
| `/Users/slawomir/Documents/runner/microrunner` | **THIS PROJECT** - microRunner local dev server |
| `/Users/slawomir/Documents/runner/microstudio` | Reference codebase - for checking/debugging how microStudio works |
| `/Users/slawomir/Documents/runner/microstudio_wiki` | API documentation and guides for microStudio features |
| `/Users/slawomir/Documents/runner/archive_example` | ZIP archive example exported from microStudio (reference for project format) |

### Key Notes
- Projects are stored in `./projects/` (relative to microrunner)
- Use `microstudio` repo for API reference and understanding upstream behavior
- Use `archive_example` when unsure about project file structure

## Build, Lint, and Test Commands

```bash
# Start production server (port 3000)
npm start

# Start development server with auto-restart on file changes
npm run dev
# When server is running, type "rs" and Enter to restart without stopping

# Install dependencies
npm install

# Restart server during development
# Option 1: Ctrl+C to stop, then npm run dev
# Option 2: Type "rs" and press Enter (nodemon restarts automatically)
```

There are no formal tests or linting configured.

## API Endpoints

### GET /api/projects
Returns list of all projects with their configuration.

### POST /api/projects
Create a new project.
```javascript
// Request body
{
  name: "My Game",
  slug: "my-game",           // Optional, auto-generated from name
  orientation: "any",        // Optional, default: "any"
  aspect: "free"             // Optional, default: "free"
}
// Response
{ success: true, slug: "my-game" }
```

### GET /api/project/:name
Returns project configuration and files.

### PUT /api/project/:name/config
Update project configuration. Can rename project folder if slug changes.
```javascript
// Request body
{
  name: "My Game",
  slug: "my-game-renamed",   // Changing this renames the folder
  orientation: "landscape",
  aspect: "16x9"
}
// Response
{ success: true, slug: "my-game-renamed" }
```

### DELETE /api/project/:name
Delete a project and its folder permanently.
```javascript
// Response
{ success: true }
// Error: { error: "Project not found" }
```

### POST /api/project/:name/duplicate
Duplicate an existing project. Creates a new project folder with the same content (files, sprites, maps, etc.) and copies backups.
```javascript
// Response
{
  success: true,
  slug: "my-game-1",
  name: "My Game-1"
}
```

### GET /api/file/:project/:file
Get source file content.

### GET /api/sprite/:project/*
Get sprite file.

### GET /api/map/:project/*
Get map file.

### GET /api/sound/:project/*
Get sound file.

### GET /api/music/:project/*
Get music file.

### GET /api/project/:name/export
Export project as a ZIP file in microStudio format for backup or importing to microStudio.
```javascript
// Response: Binary ZIP file with Content-Disposition: attachment
// File name format: {slug}_export.zip
```

### GET /api/assets/:project/*
Get asset files (3D models, images, fonts, WASM modules) from project's assets/ directory.
```javascript
// Supports: .glb, .obj, .jpg, .png, .ttf, .wasm, and other asset formats
```

### POST /api/project/:name/backup
Create a backup ZIP archive of the project. Backup is saved to `archive/{project}/` directory.
```javascript
// Response
{ success: true, fileName: "demo_20260103-120000_backup.zip", timestamp: 1735900800000 }
```

### GET /api/project/:name/backups
Returns list of available backups for the project.
```javascript
// Response
[
  { fileName: "demo_20260103-120000_backup.zip", size: 1080, created: "2026-01-03T12:00:00.000Z" },
  { fileName: "demo_20260102-090000_backup.zip", size: 980, created: "2026-01-02T09:00:00.000Z" }
]
```

### DELETE /api/project/:name/backups/:file
Delete a backup file.
```javascript
// Response
{ success: true }
```

### GET /api/project/:name/backups/:file/download
Download a backup ZIP file.

### POST /api/project/:name/restore
Restore project from a backup ZIP. Can optionally create a pre-restore backup first.
```javascript
// Request body
{
  backupFile: "demo_20260103-120000_backup.zip",
  createPreRestoreBackup: true  // Optional, default: false
}
// Response
{ success: true, config: { name: "Demo Project", slug: "demo", ... } }
```

### POST /api/project/:name/restore-upload
Restore project from an uploaded ZIP file. Automatically creates pre-restore backup.
```javascript
// Form data: file field name is "backup"
// Response
{ success: true }
```

### POST /api/import-project
Import a project from a microStudio ZIP export. Creates a new project in microRunner.
```javascript
// Form data: file field name is "file"
// Response
{
  success: true,
  project: {
    name: "Imported Project",
    slug: "imported-project",
    orientation: "any",
    aspect: "free"
  }
}
// Error: { error: "Invalid ZIP format" }
```

### POST /api/project/:name/backups/upload
Upload a backup ZIP file to the project's archive directory.
```javascript
// Form data: file field name is "backup"
// Response
{ success: true, fileName: "uploaded_backup.zip" }
```

### GET /api/project/:name/backups/:file/note
Get the note associated with a backup file.
```javascript
// Response
{ note: "Before adding physics engine" }
```

### PUT /api/project/:name/backups/:file/note
Save a note for a backup file.
```javascript
// Request body
{ note: "My backup note text" }
// Response
{ success: true }
```

### DELETE /api/project/:name/backups/:file/note
Delete the note for a backup file.
```javascript
// Response
{ success: true }
```

### GET /run/:project
Serves the game runner page for the specified project.

## Code Style Guidelines

### Language
- Use **English** for all frontend and backend code
- This includes: variable names, function names, comments, console.log messages, error messages, UI text, API responses
- This ensures consistency and helps with international collaboration

### General Formatting
- Use 2 spaces for indentation (no tabs)
- Use single quotes for strings: `'string'` not `"string"`
- Use semicolons at end of statements
- Max line length: 100 characters
- Use trailing commas in multi-line objects/arrays

### JavaScript (Frontend)
- Use ES6+ features: `const`, `let`, arrow functions, async/await
- Use `camelCase` for variables and function names
- Use `PascalCase` for class names
- Use `SCREAMING_SNAKE_CASE` for constants
- Declare one variable per statement
- Use descriptive names: `projectClients` not `pc`

```javascript
// Good - reads project.json first, then config.json
const getProjectConfig = (project) => {
  const projectPath = path.join(PROJECTS_DIR, project);
  const projectJsonPath = path.join(projectPath, 'project.json');
  const configPath = path.join(projectPath, 'config.json');

  if (fs.existsSync(projectJsonPath)) {
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
      return {
        name: projectJson.title,
        slug: projectJson.slug,
        orientation: projectJson.orientation,
        aspect: projectJson.aspect,
        graphics: projectJson.graphics?.toLowerCase() || 'm1',
        public: true
      };
    } catch (e) {
      console.warn('Failed to parse project.json for', project, e);
    }
  }

  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  return {
    name: project,
    slug: project,
    graphics: 'm1',
    orientation: 'any',
    aspect: 'free',
    public: true
  };
};

// Bad - only reads config.json, ignores project.json
const getProjectConfig = (project) => {
  const configPath = path.join(PROJECTS_DIR, project, 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return { name: project, slug: project };
};
```

### Node.js (Server)
- Use `const` and `let` (no `var`)
- Use `require()` for Node modules, ES modules not yet configured
- Handle async operations with `async/await` where appropriate
- Use `fs.readFileSync` for simple file reads (server-side, not hot path)
- Use `try/catch` for error handling around file I/O

```javascript
// Good
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.error('Failed to parse config:', e);
}

// Bad (no error handling)
config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
```

### HTML/CSS
- Use lowercase for HTML tags and attributes
- Use descriptive class names with kebab-case: `.game-wrapper`, `.terminal-pane`
- CSS in dedicated `.css` files, avoid inline styles except for quick prototyping
- Always escape user input when inserting into HTML templates to prevent XSS

```javascript
// Frontend HTML escaping
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Good - escaped user input
element.innerHTML = `<span>${escapeHtml(userContent)}</span>`;

// Bad - direct interpolation
element.innerHTML = `<span>${userContent}</span>`;
```

### Imports and Dependencies

**Server (server.js):**
```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const backup = require('./src/backup.js');
```

**Frontend:** Scripts loaded via `<script src="...">` in HTML (not ES modules). Dependencies loaded dynamically via `document.createElement('script')` for the compiler/runtime.

**Do not add new npm dependencies** without discussing first. The project aims to stay minimal.

**Current Dependencies:**
```json
{
  "adm-zip": "^0.5.10",
  "express": "^4.18.2",
  "express-fileupload": "^1.4.3",
  "ws": "^8.14.2",
  "chokidar": "^3.5.3"
}
```

**Dev Dependencies:**
```json
{
  "nodemon": "^3.1.11"
}
```

### Error Handling

- **Server**: Log errors to console with context. Return appropriate HTTP status codes (404 for not found, 403 for access denied, 500 for server errors)
- **Frontend**: Pass errors to `onError` callback for terminal display
- **WebSocket**: Handle connection errors gracefully, attempt reconnection after 2 seconds

```javascript
// Server error pattern with path traversal protection
function validatePath(project, subdir, userPath) {
  const basePath = path.resolve(PROJECTS_DIR, project, subdir);
  const resolved = path.resolve(basePath, userPath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

app.get('/api/file/:project/*', (req, res) => {
  const { project } = req.params;
  const file = req.params[0];
  const filePath = validatePath(project, 'ms', file);
  if (!filePath) {
    return res.status(403).send('Access denied');
  }
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  } else {
    res.status(404).send('File not found');
  }
});
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Variables | camelCase | `projectClients`, `lastTime` |
| Functions | camelCase | `getProjects()`, `createDemoProject()` |
| Classes | PascalCase | `Runtime`, `MicroVM` |
| Constants | SCREAMING_SNAKE_CASE | `PORT = 3000` |
| CSS classes | kebab-case | `.terminal-pane`, `.game-wrapper` |
| File paths | kebab-case | `game.html`, `terminal.js` |
| Project slugs | kebab-case | `demo-project` |

### File Organization

```
microrunner/
├── server.js           # Main server entry point
├── package.json        # npm configuration
├── projects/           # Project files (games, configs, sprites, maps, sounds, music)
├── archive/            # Backup storage directory
│   └── {project-slug}/
│       ├── {slug}_{timestamp}_backup.zip
│       └── {slug}_{timestamp}_backup.note.json  # Backup note file
├── static/
│   ├── index.html      # Project browser UI
│   ├── game.html       # Game runner with terminal
│   ├── favicon.ico     # Site favicon
│   ├── theme.json      # UI theme configuration
│   ├── css/
│   │   ├── style.css   # Project browser styles
│   │   └── terminal.css
│   └── js/
│       ├── backup.js   # Backup modal UI logic
│       ├── terminal/   # Terminal display component
│       │   └── terminal.js
│       ├── runtime/    # Full microStudio Runtime (copied from upstream)
│       │   ├── runtime.js      # Main Runtime class
│       │   ├── screen.js       # Screen API (40+ methods)
│       │   ├── microvm.js      # Virtual machine
│       │   ├── sprite.js       # Sprite loading/management
│       │   ├── map.js          # Tile map support
│       │   ├── keyboard.js     # Keyboard with press/release
│       │   ├── gamepad.js      # Gamepad API
│       │   ├── timemachine.js  # TimeMachine for threading
│       │   ├── assetmanager.js # Asset loading
│       │   ├── msimage.js      # Image manipulation
│       │   ├── random.js       # Random number generator
│       │   ├── storage.js      # localStorage wrapper
│       │   ├── system.js       # System object stubs
│       │   ├── watcher.js      # File watcher for hot reload
│       │   └── audio/          # Audio subsystem
│       │       ├── audio.js    # AudioCore
│       │       ├── sound.js    # Sound playback
│       │       ├── music.js    # Music playback
│       │       └── beeper.js   # Beeper/synth sounds
│       └── languages/  # microScript compiler files
│           └── microscript/
│               └── v2/
│                   ├── compiler.js
│                   ├── parser.js
│                   ├── tokenizer.js
│                   ├── runner.js
│                   └── ...
└── src/                # Utility modules
    └── backup.js   # Backup/restore logic module
```

### WebSocket Protocol

Messages are JSON objects with type field:

```javascript
// File update (sent to browser when .ms file changes)
{ type: "update", file: "main", code: "...", version: 123 }

// Terminal log (sent to server for logging)
{ type: "log", data: "Hello from microStudio!" }

// Error (sent to server)
{ type: "error", data: "ReferenceError: x is not defined" }

// Project list updated (sent to all connected clients when project list changes)
{ type: "projectListUpdated" }
```

### Hot Reload Behavior

- Use chokidar to watch `./projects/*/ms/` directory
- On file change: broadcast update to all connected WebSocket clients for that project
- Browser receives update and calls `runtime.updateSource(file, code)`
- Game continues running with new code (no restart)

### Execution Control Buttons

The game runner (`static/game.html`) includes execution control buttons:

| Button | Action | UI Visibility |
|--------|--------|---------------|
| Play | `runtime.resume()` | When paused |
| Pause | `runtime.stop()` | When running |
| Step Forward | `runtime.stepForward()` | When paused |
| Restart | Full reload via `initGame()` | Always |

**Status Indicator:** Shows RUNNING (green) or PAUSED (yellow) state.

**Runtime Methods Used:**
- `runtime.stop()` - Sets `stopped = true`, cancels audio beeps
- `runtime.resume()` - Clears `stopped`, restarts `requestAnimationFrame` loop
- `runtime.stepForward()` - Executes single `update()` + `draw()` cycle when paused

**UI Update Pattern:**
```javascript
function updateControlUI() {
  const isPaused = runtime.stopped;
  document.getElementById('btn-play').style.display = isPaused ? 'flex' : 'none';
  document.getElementById('btn-pause').style.display = isPaused ? 'none' : 'flex';
  document.getElementById('btn-step').style.display = isPaused ? 'flex' : 'none';
  // Update status indicator text/class
}
```

### microStudio Runtime

microRunner uses a modified version of the microStudio Runtime and microScript 2.0 compiler, adapted for local development server use.

Key adaptations include:
- Hot reload support via WebSocket
- Loop timeout warnings displayed in terminal
- Multi-project architecture support
- Offline capability

When microStudio releases new versions, copy updated files to `static/js/` and re-apply necessary modifications.

### Adding New Features

1. **New API endpoint**: Add route in `server.js`
2. **New runtime function**: Add to `global` object in `startReady()` method in runtime.js
3. **New screen API**: Add method to Screen class in `screen.js`
4. **New project configuration**: Update `getProjectConfig()` and config.json schema

### Project Configuration

Projects can have both `config.json` and `project.json` files in their root directory. The `project.json` takes priority if it exists (preserved from microStudio imports).

**config.json schema:**
- `name: "Project Name"` - Display name
- `slug: "project-slug"` - Folder name (URL-friendly identifier)
- `orientation: "any"` - Screen orientation (any | portrait | landscape)
- `aspect: "free"` - Aspect ratio constraint (free | 1x1 | 4x3 | 16x9 | 2x1 | >1x1 | >4x3 | >16x9 | >2x1)
- `graphics: "m1"` - Graphics mode
  - `spriteDirection: "vertical"` - Sprite sheet direction (vertical | horizontal)
- `public: true` - Public access flag
- `lastUpdated: timestamp` - Last modification time (auto-generated by server)

**project.json schema (microStudio format):**
- `title` - Display name
- `slug` - Folder name
- `orientation` - Screen orientation
- `aspect` - Aspect ratio
- `graphics` - Graphics mode (M1, M2, etc.)
  - `spriteDirection` - Sprite sheet direction (vertical | horizontal)
- `language: "microscript_v2"` - Must be microScript v2
- `files` - Sprite and source file properties (including animation settings)

**Priority:** `project.json` > `config.json` > defaults

**Free aspect ratio behavior:** Canvas fills the entire display frame edge-to-edge. The screen uses a normalized coordinate system where the smallest dimension is always 200 units (-100 to +100). The largest dimension scales proportionally based on aspect ratio (e.g., ~178 for 16:9, 200 for 2:1). This ensures a 25x25 square always renders as a square, regardless of frame size.

### Color Theme (Tokyo Night)

The UI uses the **Tokyo Night** color palette with custom orange accents:

**Accent color:** `#E47E4D` (warm orange)

**Color palette (in `static/theme.json`):**
| Key | Value | Purpose |
|-----|-------|---------|
| `accent` | `#E47E4D` | Primary accent (links, buttons, highlights) |
| `accentDim` | `rgba(228, 126, 77, 0.15)` | Accent with low opacity |
| `accentBorder` | `rgba(228, 126, 77, 0.3)` | Accent border color |
| `background` | `#1a1b26` | Main page background |
| `cardBg` | `#16161e` | Card/surface background |
| `darkBg` | `#0f0f14` | Dark elevated surfaces |
| `border` | `#101014` | Border color |
| `textPrimary` | `#a9b1d6` | Primary text |
| `textSecondary` | `#787c99` | Secondary/muted text |
| `textMuted` | `#565f89` | More muted text |
| `textDim` | `#666` | Extra muted text (used in project card footers) |
| `portrait` | `#E47E4D` | Portrait orientation indicator color |
| `landscape` | `#E47E4D` | Landscape orientation indicator color |
| `square` | `#E47E4D` | Square orientation indicator color |
| `terminalBg` | `#16161e` | Terminal background |
| `terminalText` | `#9ece6a` | Terminal normal output (green) |
| `terminalError` | `#f7768e` | Terminal error text (red) |
| `terminalSystem` | `#7aa2f7` | Terminal system messages (blue) |
| `warning` | `#e0af68` | Warning color (yellow/orange) |
| `danger` | `#ff6b6b` | Danger/delete color (red) |

**CSS Variables:**
- All colors are exposed as CSS custom properties: `--color-*`
- `style.css` contains fallback values (should match `theme.json`)
- Both HTML files load theme via `loadTheme()` function that applies CSS variables

**When modifying colors:**
1. Update `static/theme.json` with new color values
2. Update corresponding fallback values in `static/css/style.css`
3. Avoid hardcoded colors in HTML or inline styles - use CSS variables

**Example:**
```css
/* Good - uses CSS variable */
color: var(--color-accent);

/* Bad - hardcoded color */
color: #E47E4D;
```

### Project Management Features

**Project Card Actions (always visible on each project):**
- **Export icon (📤)** - Exports project as ZIP file in microStudio format
- **Duplicate icon (📄)** - Creates a copy of the project (name/slug increments automatically)
- **Gear icon (⚙️)** - Opens configuration modal to edit name, folder name, orientation, aspect ratio
- **Archive icon (📦)** - Opens backup modal to create/restore/delete backups
- **Trash icon (🗑️)** - Opens delete confirmation modal

**Project Card Layout:**
- Title row: [ICON] Project's name with settings/archive/delete icons on the same line
- Icon: `sprites/icon.png` displayed to the left of the project name (same height as text)
- Details row: Orientation, Aspect Ratio, Path (folder location)
- Footer: "Click to run →" (left) + "Last updated: [date] [time]" (right)
- Full-width single column layout (flex column)

**Create Project:**
- Click "Create Project" button in header
- Modal with: Name, Folder Name (auto-generated), Orientation, Aspect Ratio
- Orientation and aspect ratio dropdowns use UPPERCASE values (e.g., "ANY", "FREE", "16X9")
- Aspect ratio options: FREE, 1X1, 4X3, 16X9, 2X1, >1X1, >4X3, >16X9, >2X1 (9 options)
- Server creates: folder, `ms/` directory, `sprites/` directory, `config.json`, `main.ms` with starter code
- If folder name exists, auto-increments (e.g., `my-game` → `my-game-1`)

**Configuration Changes:**
- Changing folder name renames the project folder
- Warning displayed when folder name is modified
- Server restart required for renamed projects to work properly

**Backup and Restore:**
- Click archive icon (📦) on project card to open backup modal
- Create new backup: Click "Create New Backup" button to generate ZIP file in `archive/{project}/`
- Backup filename format: `{slug}_{YYYYMMDD-HHMMSS}_backup.zip`
- Download backup: Click download icon on backup item
- Restore backup: Click restore icon, shows confirmation dialog with pre-restore backup info
- Automatic pre-restore backup: When restoring, current project is backed up first with suffix `_pre_restore`
- Load from archive (in config modal): Upload ZIP file to restore project, auto-creates pre-restore backup
- Backup notes: Click note icon (📝) to expand backup item and add/edit notes
- Notes are stored as `{backup}.note.json` files alongside the ZIP archive

**Backup ZIP Format:**
Backups are microStudio-compatible and can be imported to microStudio:
```
{filename}_backup.zip
├── project.json           # Project metadata
├── ms/
│   └── *.ms              # Source files
├── sprites/
│   └── *.png             # Sprite images
├── maps/
│   └── *.json            # Tile maps
├── sounds/
│   └── *.{wav,mp3,ogg}   # Sound files
├── music/
│   └── *.{wav,mp3,ogg}   # Music files
├── assets/
│   └── *.{glb,obj,jpg}   # Asset files
└── doc/
    └── *.md              # Documentation
```

**Backup Note File Format:**
Notes are stored as JSON files alongside the ZIP archive:
```
archive/{project}/
├── {slug}_{timestamp}_backup.zip
└── {slug}_{timestamp}_backup.note.json  # Backup note
```
```json
{
  "note": "My backup note text",
  "updated": 1736111111111
}
```

**Delete Project:**
- Confirmation modal with warning message
- Permanently deletes folder and all files
- Cannot be undone

### Sprite Animation Support

microRunner supports animated sprites (sprite sheets) with automatic frame detection.

#### Sprite Sheet Direction

microRunner supports two sprite sheet layouts, configured per-project in Settings:

- **VERTICAL** (default): Frames stacked vertically (top to bottom)
- **HORIZONTAL**: Frames stacked horizontally (left to right)

This setting is stored in `config.json`:
```json
{
  "name": "My Game",
  "slug": "my-game",
  "spriteDirection": "vertical",
  ...
}
```

#### Sprite Properties

Sprite frame count is configured in `project.json` (microStudio-compatible format):

```json
{
  "files": {
    "sprites/sprite.png": {
      "properties": { "frames": 2 }
    }
  }
}
```

**Fields:**
- `frames` - number of animation frames (default: auto-detected)
- `fps` - **not stored in project.json** - use `sprite.setFPS()` in code

#### Auto-detection

If no `frames` property is configured, frames are detected automatically:

- **VERTICAL**: `frames = height / width` (e.g., 64×128 = 2 frames)
- **HORIZONTAL**: `frames = width / height` (e.g., 128×64 = 2 frames)
- Default FPS: 5

#### Changing FPS at Runtime

Use `sprite.setFPS(fps)` in your microScript code:
```javascript
init = function()
  mySprite = sprites.anim
  mySprite.setFPS(20)  // Change animation speed
  // Hot reload of .ms file will apply the new FPS
end
```

#### Import Behavior

When importing a microStudio ZIP export:
1. `project.json` is preserved in the project directory (for microStudio compatibility)
2. `spriteDirection` is preserved from imported `project.json`

#### Adding/Editing Sprite Animations

**Method 1:** Configure in project Settings (gear icon) - set sprite sheet direction

**Method 2:** Edit `project.json` directly for frames:
```json
{
  "files": {
    "new_sprite.png": {
      "properties": { "frames": 4 }
    }
  }
}
```

**Method 3:** Change FPS in code:
```javascript
sprites.mySprite.setFPS(10)
```

**Method 4:** Import a project from microStudio ZIP export
- All sprite properties and direction are automatically preserved

### microScript Runtime Compatibility

The project uses the **full microStudio Runtime** (copied from upstream microstudio repo). All API features are available:

**Screen API (40+ methods):**
- Drawing: `fillRect`, `drawRect`, `fillRoundRect`, `drawRoundRect`, `fillRound`, `drawRound`
- Sprites: `drawSprite`, `drawSpritePart`, `drawMap`
- Text: `drawText`, `drawTextOutline`, `textWidth`, `setFont`, `loadFont`, `isFontReady`
- Lines: `drawLine`, `drawPolygon`, `fillPolygon`, `drawPolyline`
- Arcs: `drawArc`, `fillArc`, `drawQuadCurve`, `drawBezierCurve`
- Transforms: `setTranslation`, `setScale`, `setRotation`
- Effects: `setAlpha`, `setBlending`, `setLinearGradient`, `setRadialGradient`
- And more...

**Input APIs:**
- `keyboard` (basic + `press.*` + `release.*`)
- `mouse` (x, y, pressed, left, middle, right, wheel, press, release)
- `touch` (touching, x, y, press, release, touches)
- `gamepad` (buttons, sticks, press, release)

**Audio APIs:**
- `audio.playSound(name)`
- `audio.playMusic(name)`
- `audio.beep()`
- `audio.cancelBeeps()`

**Other APIs:**
- `sprites` object
- `maps` object
- `storage.set/get`
- `system.time()`, `system.inputs`, `system.language`, `system.say()`, `system.prompt()`
- `asset_manager` methods
- `Image` class, `Map` class, `Sound` class

### Browser Compatibility

- Modern browsers only (ES6 support required)
- WebSocket API required
- Canvas 2D API required
- No IE11 or legacy browser support

### Security Notes

- Path traversal protection on all file-serving endpoints via `validatePath()` function
- All user-generated content in HTML is escaped via `escapeHtml()` function
- Invalid config.json files are logged with warning instead of silently failing
- 403 returned for access denied, 404 for missing files (no information leakage)
- Local development only, not designed for internet-facing deployment

---

## Changelog

### 2026-01-08

#### Sprite Animation - Auto-detection (Feature)

Added automatic sprite frame detection and configuration:

- **Auto-detect frames from PNG dimensions**: When a sprite is added, the server reads PNG dimensions and automatically calculates frame count:
  - Vertical sprite sheets: `frames = height / width`
  - Horizontal sprite sheets: `frames = width / height`
- **Auto-update project.json**: New `handleSpriteChange()` function updates `project.json` with detected frame counts
- **Server startup scanning**: New `scanProjectSprites()` function scans all existing sprites when server starts
- **Sprite watcher**: Chokidar watches `sprites/` directory and auto-updates on add/change
- **Nodemon configuration**: Added `nodemon.json` to prevent restart loops when sprites change

**Example:**
```
Sprite: 64×128 PNG
→ Detected: 2 frames (vertical)
→ project.json updated: { "properties": { "frames": 2 } }
```

**Implementation:**
- `server.js:315-405` - `handleSpriteChange()` function
- `server.js:407-503` - `scanProjectSprites()` function
- `server.js:533-551` - Sprite watcher using chokidar
- `server.js:557-567` - Startup scanner in `watchAllProjects()`
- `nodemon.json` - Ignore sprite and json file changes

