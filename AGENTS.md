# AGENTS.md - microRunner

Guidelines for AI agents working on this codebase.

## Project Overview

microRunner is a **CLI-based** local development environment for microStudio games.

- **CLI**: Node.js executable (`cli.js`) with commands: `init`, `import`, `start`, `version`, `help`
- **Server**: Node.js/Express + WebSocket for hot reload
- **Frontend**: Vanilla JavaScript + microStudio Runtime
- **Compiler**: microScript v2 (copied from upstream microStudio)
- **Projects**: Self-contained (each has its own `project.toml`), no global registry

## Build Commands

```bash
npm start        # Production server (port 3000)
npm run dev      # Development server with auto-restart
npm run lint     # Run ESLint on all JS files
npm install      # Install dependencies

# CLI commands (from any directory with project.toml)
microrunner init           # Initialize new project in empty folder
microrunner import <file>  # Import project from microStudio ZIP
microrunner start          # Scan sprites and start the server (auto-opens game runner)
microrunner version        # Show version
microrunner help           # Show help
```

## File Organization

```
microrunner/
├── cli.js                # CLI entry point (init, import, start, version, help)
├── server.js             # Main server entry point
├── package.json          # npm configuration
├── restart.js            # Auto-restart script
├── logs/                 # Log files (auto-created)
│   └── restart.log       # Auto-restart logs
├── static/
│   ├── index.html        # Homepage (minimal, badges only)
│   ├── game.html         # Game runner with terminal
│   ├── fonts/            # GUI fonts (Inter, Hack) + BitCell
│   ├── template/         # Template files for new projects
│   ├── lib/              # External libraries
│   │   └── font-awesome/ # Font Awesome icons for UI
│   ├── css/
│   │   ├── fonts.css     # @font-face (Inter, Hack)
│   │   ├── style.css     # Main UI styles
│   │   ├── terminal.css  # Terminal component styles
│   │   └── theme.css     # Theme variables (--color-*)
│   └── js/
│       ├── terminal/             # Terminal component
│       │   └── terminal.js       # Terminal implementation
│       ├── util/                 # Utilities
│       │   └── canvas2d.js       # Canvas 2D utilities
│       ├── runtime/              # microStudio Runtime (adapted)
│       │   ├── runtime.js        # Main Runtime class, game loop
│       │   ├── screen.js         # 2D rendering, input handling
│       │   ├── microvm.js        # microScript VM, storage
│       │   ├── watcher.js        # Variable watching for debugging
│       │   ├── player.js         # Runtime controller, message passing
│       │   ├── sprite.js         # Sprite animation handling
│       │   ├── map.js            # Tilemap rendering
│       │   ├── msimage.js        # Image handling
│       │   ├── game.js           # Game state management
│       │   ├── timemachine.js    # Time travel debugging
│       │   ├── system.js         # System API
│       │   ├── storage.js        # Storage API
│       │   ├── random.js         # Random utilities
│       │   ├── gamepad.js        # Gamepad input
│       │   ├── keyboard.js       # Keyboard input
│       │   ├── assetmanager.js   # Asset loading (fonts, models, wasm)
│       │   └── audio/
│       │       ├── audio.js      # WebAudio API wrapper
│       │       ├── beeper.js     # audio.beep() implementation
│       │       ├── music.js      # Music playback
│       │       └── sound.js      # Sound playback
│       └── languages/microscript/v2/
│           ├── compiler.js       # microScript compiler
│           ├── tokenizer.js      # Lexer
│           ├── token.js          # Token definition
│           ├── parser.js         # Parser
│           ├── processor.js      # Code processor
│           ├── runner.js         # Runner
│           ├── routine.js        # Routines
│           ├── program.js        # Program
│           └── transpiler.js     # Transpiler
└── src/
    ├── config.js          # Project TOML config (no registry)
    ├── backup.js          # Backup/restore + import/export
    ├── trash.js           # Deleted project management (30-day retention)
    ├── update.js          # Self-update functionality
    └── note.js            # Project notes (Markdown files)
```

## Architecture

### CLI (`cli.js`)

| Command | Description |
|---------|-------------|
| `microrunner` or `microrunner help` | Show help |
| `microrunner init` | Initialize new project in empty folder (interactive - asks for name/slug) |
| `microrunner import <file.zip>` | Import project from microStudio ZIP file |
| `microrunner start` | Scan sprites, start server, open game runner at `/:slug` |
| `microrunner version` | Show version |

**Init behavior:**
- Checks if folder is empty
- If not empty, shows error and exits
- Asks for project name (default: folder name)
- Asks for slug (default: auto-generated)
- Creates directory structure
- Copies template files (`icon.png`, `main.ms`)
- Creates `project.toml`

**Import behavior:**
- Takes ZIP file path as argument
- Imports project to current directory or specified path
- Handles both microStudio ZIP and microRunner backup formats
- Auto-generates unique slug if needed

**Start behavior:**
- Searches for `project.toml` in current folder
- Reads `slug` from config
- Finds available port (starts at 3000)
- Spawns `server.js --project-path=<path> --port=<port>`
- Opens browser to `http://localhost:${port}/${slug}`

### Server (`server.js`)
- Express server with chokidar file watchers
- WebSocket server for hot reload and logging
- Path validation middleware for security
- MTIME caching (5s TTL) for modification time tracking
- Config caching (30s TTL) for project.toml parsing
- `--project-path` argument for project location
- `--port` argument for server port
- Graceful shutdown handling (SIGTERM, SIGINT)
- Shutdown marker for clean process termination

### Runtime (`static/js/runtime/runtime.js`)
- **Game Loop**: `requestAnimationFrame` based, 60fps default
- **Update/Draw Cycle**: `update()` -> `draw()` pattern per frame
- **Hot Reload**: File watchers trigger code updates via WebSocket
- **Input Handling**: Keyboard, gamepad, mouse, touch
- **API Exposure**: screen, audio, keyboard, gamepad, sprites, sounds, music, maps, assets, asset_manager, storage, system, game, timemachine, random

### MicroVM (`static/js/runtime/microvm.js`)
- microScript v2 interpreter
- Array prototype extensions (`insert`, `remove`, `contains`, `find`, `filter`, `map`, `sort`, `push`, `pop`, `shift`, `unshift`, `slice`, `splice`)
- Math functions (`sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sqrt`, `pow`, `abs`, `floor`, `ceil`, `round`, `random`, `min`, `max`, `log`, `exp`)
- LocalStorage-based persistence (`storage.set`, `storage.get`, `storage.list`, `storage.remove`, `storage.clear`)
- Warning system: undefined variables, API overwrites, assignment conditions
- Error tracking with file/line/column

### Audio (`static/js/runtime/audio/audio.js`)
- WebAudio API with ScriptProcessor
- Beeper for `audio.beep()` - sequence of tones with frequency/duration
- Sound/Music playback with volume, pitch, pan, loop control
- Audio worklet for real-time synthesis

### Compiler (`static/js/languages/microscript/v2/compiler.js`)
- microScript v2 compiler (source from upstream microStudio)
- Tokenizer for lexing
- Parser for AST generation
- Code generation for VM execution

## API Endpoints

### Project

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:project` | GET | Serve game runner (game.html) |
| `/` | GET | Serve homepage (index.html) |
| `/api/project/:name` | GET | Get project config and files |
| `/api/project/:slug/path` | GET | Get project path |

### Sprites/Media

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sprite/:project/*` | GET | Serve sprite images (png, jpg, jpeg) |
| `/api/map/:project/*` | GET | Serve map JSON files |
| `/api/sound/:project/*` | GET | Serve sound files (wav, ogg, flac) |
| `/api/music/:project/*` | GET | Serve music files (mp3, ogg, flac) |
| `/api/assets/:project/*` | GET | Serve asset files |

### File Access

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/file/:project/*` | GET | Get source code files (.ms) |

### Backup/Restore

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/project/:name/backup` | POST | Create backup |
| `/api/project/:name/export` | GET | Export as microStudio ZIP |
| `/api/project/:name/backups` | GET | List all backups |
| `/api/project/:name/backups/:file` | DELETE | Delete backup |
| `/api/project/:name/backups/:file/download` | GET | Download backup |
| `/api/project/:name/backups/:file/note` | GET/PUT/DELETE | Backup notes CRUD |
| `/api/project/:name/backups/upload` | POST | Upload backup ZIP |
| `/api/project/:name/restore` | POST | Restore from backup |
| `/api/project/:name/restore-upload` | POST | Restore from uploaded ZIP |

### Import/Export

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/import-project` | POST | Import project from ZIP |
| `/api/import-project/preview` | POST | Preview imported config |

### Notes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/project/:name/note` | GET | Get project note content |
| `/api/project/:name/note` | PUT | Save project note |
| `/api/project/:name/note` | DELETE | Delete project note |

### Utilities

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/version` | GET | Check for updates |
| `/api/update/download` | GET | Download and install update |

### WebSocket

| URL | Purpose |
|-----|---------|
| `ws://localhost:PORT/ws?project=SLUG` | Hot reload and logging |

## Config Module (`src/config.js`)

### TOML Configuration Structure

```javascript
{
  microrunnerVersion: "1.0-beta-5",
  meta: {
    name: "Project Name",
    slug: "project-slug",
    created: "ISO timestamp",
    lastModified: "ISO timestamp"
  },
  settings: {
    graphics: "m1",
    orientation: "any|portrait|landscape",
    aspect: "free|1x1|4x3|16x9|2x1|>1x1|>4x3|>16x9|>2x1",
    language: "microscript_v2"
  },
  sprites: {
    direction: "vertical|horizontal",
    "sprite.png": { frames: 1 }
  }
}
```

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `read(projectPath)` | Parse project.toml | Config object (async) |
| `write(projectPath, config)` | Write project.toml | - |
| `createConfig(name, slug, options)` | Create new config | Config object |
| `syncSprites(projectPath)` | Scan sprites dir, auto-detect frames | - |
| `getSpriteProperties(spriteName, projectPath)` | Get sprite frames/fps | Object |
| `detectSpriteFrames(spritePath, direction)` | Detect animation frames | Number |
| `touch(projectPath)` | Update lastModified | - |
| `toProjectJson(config)` | Convert to microStudio format | Object |
| `fromProjectJson(json)` | Import from microStudio | Config object |

### Caching

- Config cache: 30s TTL via `tomlConfigCache` Map
- Sprite properties: 30s cache
- MTIME cache: 5s TTL

## Backup Module (`src/backup.js`)

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `createBackup(project, options)` | Create timestamped backup | `{ fileName, fullPath, timestamp }` |
| `createExport(project)` | Export as microStudio ZIP | `{ fileName, filePath }` |
| `listBackups(project)` | List all backups | Array |
| `deleteBackup(project, file)` | Delete backup | - |
| `getBackupPath(project, file)` | Get full backup path | String |
| `getBackupNote(project, file)` | Get backup note | String |
| `saveBackupNote(project, file, note)` | Save backup note | - |
| `deleteBackupNote(project, file)` | Delete note | - |
| `restoreProject(project, backup, options)` | Restore from backup | `{ success, config }` |
| `restoreProjectFromUpload(project, zip, options)` | Restore from ZIP | `{ success, config }` |
| `importProjectFromArchive(zipPath, options)` | Import new project | `{ success, slug, name, path }` |
| `previewProjectFromArchive(zipPath)` | Preview import | Project config preview |
| `uploadBackupToArchive(project, zip)` | Upload backup ZIP | - |
| `duplicateProject(project, options)` | Duplicate project | `{ success, slug, name, path }` |
| `getDuplicatePreview(project)` | Preview duplicate | Suggested config |
| `getProjectPath(project)` | Get project path (searches for project.toml) | String |

### Archive Structure

```
project_backup.zip
├── project.json          # microStudio format metadata
├── ms/                   # Source files (*.ms)
├── sprites/              # Images (png, jpg, gif)
├── maps/                 # Maps (json)
├── sounds/               # Audio (wav, mp3, ogg, flac)
├── music/                # Music (wav, mp3, ogg, flac)
├── assets/               # 3D models, fonts, wasm, json
└── doc/                  # Documentation (md)
```

### Backup Notes
- Stored as `.note.json` alongside backup ZIP
- CRUD via `/api/project/:name/backups/:file/note`

## Trash Module (`src/trash.js`)

Deleted projects are moved to the `trash/` folder in the microRunner directory and permanently deleted after 30 days.

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `getTrashPath()` | Get/create trash folder path | String |
| `generateUniqueTrashName(baseName)` | Find unique name (slug, slug-1, slug-2...) | String |
| `moveToTrash(projectPath, slug)` | Move project to trash with timestamp suffix | `{ trashPath, deletedAt }` |
| `emptyExpiredTrash()` | Delete projects older than 30 days | Number |

### Trash Folder Structure

```
microrunner/trash/
├── my-game_20260120_143000/
│   ├── project.toml
│   ├── ms/
│   ├── sprites/
│   └── ...
├── my-game-1_20260120_143015/
└── ...
```

### Behavior

- Deleted projects renamed to `{slug}_{YYYYMMDD}_{HHMMSS}` format
- Folder name conflicts resolved with `-1`, `-2` suffix
- Automatic cleanup at server startup removes expired projects
- Trash folder preserved during auto-updates (`excludePatterns` includes `'trash'`)
- User manages trash manually (copy/move folders as needed)

## Note Module (`src/note.js`)

Project notes stored as Markdown files alongside project files.

### File Location

```
{projectPath}/
├── project.toml
├── note.md              ← Project note (Markdown)
├── ms/
├── sprites/
└── ...
```

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `getNotePath(projectPath)` | Get note file path | String |
| `readNote(projectPath)` | Read note content | String |
| `writeNote(projectPath, content)` | Save note content | - |
| `deleteNote(projectPath)` | Delete note file | - |
| `noteExists(projectPath)` | Check if note exists | Boolean |

## Common Workflows

### Project Initialization
1. User navigates to empty project folder
2. Runs `microrunner init`
3. CLI checks if folder is empty (error if not)
4. CLI asks for project name (default: folder name)
5. CLI asks for slug (default: auto-generated from name)
6. Creates directory structure: `ms/`, `sprites/`, `assets/`, `maps/`, `music/`, `sounds/`
7. Copies template files: `icon.png`, `main.ms`
8. Creates `project.toml` with config
9. Runs `config.syncSprites()` to detect sprite frames

### Project Import
1. User downloads microStudio project ZIP
2. Runs `microrunner import project.zip`
3. CLI extracts ZIP to current folder
4. Parses `project.json` metadata
5. Converts to TOML format
6. Generates unique slug if needed
7. Copies all project files preserving structure
8. Shows success message with path

### Starting Development Server
1. User runs `microrunner start` in project folder
2. CLI scans `sprites/` directory and syncs with `project.toml`
3. CLI reads `project.toml` to get slug
4. CLI finds available port (3000+)
5. CLI spawns `server.js --project-path=<cwd> --port=<port>`
6. CLI opens browser to `http://localhost:${port}/${slug}`

### Hot Reload
1. User edits `.ms` file in external IDE
2. Server `chokidar` detects change in `ms/` directory
3. Server broadcasts `update` message via WebSocket
4. Client receives message with file path and content
5. Client calls `runtime.updateSource(file, code)`
6. VM re-compiles, game continues without restart

### Sprite Loading
1. Server scans `sprites/` directory recursively
2. Detects frame count from PNG dimensions (vertical/horizontal)
3. Updates `project.toml` sprites section
4. Client loads via `/api/sprite/:project/:file`
5. Sprite animation uses frame count from config

### Import Flow (ZIP)
1. Upload ZIP to `/api/import-project`
2. Extract to temporary directory
3. Parse `project.json` metadata
4. Preview via `/api/import-project/preview`
5. Convert to TOML format with `fromProjectJson()`
6. Copy files preserving case
7. Generate unique slug if needed
8. Show success modal

### Backup Flow
1. Collect all project files
2. Create `project.json` from TOML via `toProjectJson()`
3. Add to ZIP with directory structure
4. Save to `projectPath/archive/`
5. Create optional note file (`.note.json`)
6. Return download URL

### Project Deletion
1. User confirms deletion in Delete modal
2. Server calls `trash.moveToTrash(projectPath, slug)`
3. Project folder renamed to `{slug}_{YYYYMMDD}_{HHMMSS}`
4. Moved to `microrunner/trash/` folder
5. On server restart: `trash.emptyExpiredTrash()` removes folders older than 30 days

## Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| MTIME_CACHE_TTL | 5000 | File modification time cache (ms) |
| CONFIG_CACHE_TTL | 30000 | Project config cache (ms) |
| FPS_UPDATE_INTERVAL | 1000 | FPS display update (ms) |
| MAX_TERMINAL_LINES | 10000 | Terminal output limit |
| CURSOR_HIDE_TIMEOUT_MS | 4000 | Hide cursor after inactivity |
| Backup filename format | `{slug}_{YYYYMMDD}_{HHMMSS}_{suffix}.zip` | - |
| TRASH_RETENTION_DAYS | 30 | Trash retention period (days) |

### Restart Script (`restart.js`)

Auto-restart script for automatic server restart after updates.

**Features:**
- Platform detection (Windows: PowerShell, macOS/Linux: sh)
- Automatic `npm install && npm start` execution
- Logging to `logs/restart.log` with timestamps
- UTF-8 encoding support on Windows (`chcp 65001`)
- Error handling and verification of npm install success

**Platform-specific behavior:**

| Platform | Command | Parameters |
|----------|---------|------------|
| **Windows** | `powershell` | `-NoProfile -ExecutionPolicy Bypass` |
| **macOS/Linux** | `sh -c` | Detached process |

**Log file format:**
```
[ISO-timestamp] message
```

**Error logging:**
- `ERROR:` prefix for stderr output
- `SPAWN ERROR:` for process spawn errors
- `FATAL:` for critical errors

### Auto-Update Behavior

- Auto-update flow:
  1. User clicks "Download Update" in UI
  2. Server downloads ZIP from GitHub
  3. Server extracts and installs files
  4. Server automatically restarts via `restart.js`
  5. UI shows "Lost connection" during restart (expected behavior)
  6. UI reconnects automatically when server is back

- `excludePatterns` in server.js protects these folders/files during updates:
  - `node_modules` - Dependencies
  - `logs` - Log files
  - `trash` - Deleted projects (preserved for 30 days)
  - `restart.js` - IS updated (NOT in excludePatterns)

- On server restart: `trash.emptyExpiredTrash()` permanently deletes expired trashed projects

- Logs: `logs/restart.log` contains auto-restart history with timestamps

- Dev mode detection: If server was started via `npm run dev` (nodemon), auto-restart is skipped and user is prompted to restart manually

- Auto-restart script (`restart.js`):
  - Detects platform (Windows: PowerShell, macOS/Linux: sh)
  - Runs `npm install && npm start` automatically
  - Logs all output to `logs/restart.log`
  - Handles UTF-8 encoding on Windows (`chcp 65001`)
  - Verifies `npm install` success via `$LASTEXITCODE` (Windows) or exit code (Unix)

### Server Graceful Shutdown

- **Shutdown Marker**: `.shutdown-{timestamp}` files signal clean shutdown
- **Signals Handled**: SIGTERM, SIGINT
- **Cleanup Sequence**:
  1. Set shuttingDown flag
  2. Create shutdown marker
  3. Close all WebSocket clients
  4. Close file watchers
  5. Close HTTP server
  6. Remove shutdown marker
  7. Exit process

## Code Style

- **Language**: English for all code, comments, console messages, UI text
- **Formatting**: 2 spaces, single quotes, semicolons, 100 char max line, trailing commas
- **Naming**:
  - Variables/functions: `camelCase`
  - Classes: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - CSS classes/files: `kebab-case`
  - Project slugs: `kebab-case`
- **JavaScript**: ES6+ (`const`, `let`, arrow functions, async/await)
- **Node.js**: Use `require()`, `fs.readFileSync` for simple file reads
- **Error Handling**: Always use `try/catch` for file I/O
- **Security**: Escape user input in HTML (`escapeHtml()` function)

## Runtime API

### Screen API (`screen.*`)

**Drawing:**
- `screen.clear(color)` - Clear canvas
- `screen.fillRect(x, y, width, height, color)` - Filled rectangle
- `screen.drawRect(x, y, width, height, color)` - Rectangle outline
- `screen.drawLine(x1, y1, x2, y2, color)` - Line
- `screen.drawPolygon(points, color)` - Polygon outline
- `screen.fillPolygon(points, color)` - Filled polygon
- `screen.drawArc(x, y, radius, startAngle, endAngle, color)` - Arc outline
- `screen.fillArc(x, y, radius, startAngle, endAngle, color)` - Filled arc

**Sprites:**
- `screen.drawSprite(sprite, x, y, scale)` - Draw sprite
- `screen.drawSpritePart(sprite, x, y, part, scale)` - Draw sprite frame
- `screen.drawMap(map, x, y, scale)` - Draw tilemap

**Text:**
- `screen.drawText(text, x, y, size, color)` - Draw text
- `screen.drawTextOutline(text, x, y, size, color)` - Text outline
- `screen.textWidth(text, size)` - Measure text width
- `screen.setFont(fontName)` - Set current font

**Transforms:**
- `screen.setTranslation(x, y)` - Set translation
- `screen.setScale(x, y)` - Set scale
- `screen.setRotation(angle)` - Set rotation
- `screen.setDrawAnchor(x, y)` - Set draw anchor (0-1)

**Input:**
- `screen.isInsideCanvas()` - Check if click inside canvas
- Touch/mouse events handled automatically

### Audio API (`audio.*`)

- `audio.play(sound)` - Play sound effect
- `audio.playMusic(music)` - Play music track
- `audio.beep(frequency, duration)` - Simple tone
- `audio.beepSequence(sequence)` - Multiple tones
- `audio.stopMusic()` - Stop music
- `audio.setVolume(volume)` - Set master volume (0-1)
- Sound/music have volume, pitch, pan, loop properties

### Input APIs

**Keyboard:**
- `keyboard.isPressed(key)` - Check if key pressed
- `keyboard.presses(key)` - Key press counter

**Gamepad:**
- `gamepad.isPressed(button)` - Check gamepad button
- `gamepad.getAxis(axis)` - Get axis value (-1 to 1)

### Storage API (`storage.*`)

- `storage.set(key, value)` - Store value (JSON serialized)
- `storage.get(key)` - Retrieve value
- `storage.list()` - List all keys
- `storage.remove(key)` - Delete key
- `storage.clear()` - Clear all
- Uses browser localStorage

### Game API (`game.*`)

- `game.status` - Current game status (running, paused)
- `game.projectName` - Name of current project
- `game.reset()` - Reset game state
- Game state management and lifecycle

### Time Machine API (`timemachine.*`)

- Time travel debugging feature
- Record and replay game states
- Snapshot management
- State restoration

### Random API (`random.*`)

- `random()` - Random float 0-1
- `randomInt(min, max)` - Random integer in range
- Seeded random number generation

### System API (`system.*`)

- `system.javascript(code)` - Execute JavaScript from microScript
- `system.openURL(url)` - Open URL in browser
- `system.setUpdateRate(fps)` - Set game update rate
- `system.exit()` - Close game runner

### Asset APIs

**Sprites:**
- `sprites[spriteName]` - Sprite object with frames, fps
- `sprites[spriteName].setFrame(frame)` - Set animation frame

**Sounds:**
- `sounds[soundName]` - Sound object

**Music:**
- `music[musicName]` - Music object

**Maps:**
- `maps[mapName]` - Map object with width, height, data

**Assets:**
- `assets[assetName]` - Raw asset data
- `asset_manager.loadFont(name)` - Load font
- `asset_manager.loadSound(name)` - Load sound
- `asset_manager.loadMusic(name)` - Load music
- `asset_manager.loadSprite(name)` - Load sprite
- `asset_manager.loadMap(name)` - Load map
- `asset_manager.loadJSON(name)` - Load JSON
- `asset_manager.loadModel(name)` - Load 3D model
- `asset_manager.loadWASM(name)` - Load WASM

## Theme System

microRunner uses CSS variables for theming. See `static/css/theme.css`.

**Core Variables:**
- `--color-bg` - Background color
- `--color-fg` - Foreground/text color
- `--color-accent` - Accent color
- `--color-border` - Border color
- `--color-error` - Error color
- `--color-warning` - Warning color
- `--color-success` - Success color

**Terminal Variables:**
- `--term-bg` - Terminal background
- `--term-fg` - Terminal text
- `--term-error` - Error messages
- `--term-warn` - Warning messages
- `--term-info` - Info messages

## Slug Functionality

microRunner uses URL-friendly slugs (kebab-case) for project identification.

### Validation Rules

- Regex: `/^[a-z0-9-]+$/`
- Lowercase only
- Dashes for spaces
- No special characters

## Homepage (`index.html`)

Minimal homepage with:
- Title: "microRunner"
- Subtitle: "Local microScript development environment" with GitHub badge for microStudio
- Version badge
- Footer with GitHub link to microRunner

## Game Runner (`game.html`)

Game runner displays:
- Project name (from config)
- Control bar: Play/Pause, Restart
- Status: Running/Paused
- Terminal toggle (shows logs, errors, system messages)
- Project path (bottom right, with `~` shorthand for home directory)

## Terminal Component

Built-in terminal for debugging and monitoring:

**Features:**
- Real-time log streaming from server
- Error and warning display
- Clear terminal output
- Auto-scroll to latest messages
- Maximum 10000 lines

**Controls:**
- Toggle visibility button
- Clear output
- Copy logs

**Log Types:**
- `info` - General information
- `warn` - Warnings
- `error` - Errors
- `debug` - Debug messages

## Font Loading

microRunner uses a unified approach for loading fonts. See `docs/fonts.md` for detailed documentation.

### Built-in Fonts

| Font | Location | Setup Required |
|------|----------|----------------|
| **BitCell** | `static/fonts/BitCell.ttf` | No - built-in to runtime |
| **Inter, Hack** | `static/fonts/` | No - UI fonts only |
| **Other fonts** | `assets/` | Yes - requires `asset_manager.loadFont()` |

### Unsupported microStudio Fonts

microStudio has 47 built-in fonts NOT available in microRunner. When used, a warning is shown:

```
⚠️ Font "ModernDos" is a built-in microStudio font.
Download "ModernDos.ttf" from microStudio and add it to assets/.
```

- Full list in `docs/fonts.md`
- `BUILTIN_FONTS` array in `screen.js`
- `loadFont()` shows warning once per font

### Case Sensitivity
- Font names are case-sensitive
- Use exact name matching font file
- `asset_manager.loadFont()` preserves original case
- `screen.loadFont()` and `screen.isFontReady()` use same case

## UI Icons

microRunner uses Font Awesome for UI icons (vs no icons in microStudio):

**Available Icon Sets:**
- Solid (`fa-solid-*`)
- Regular (`fa-regular-*`)
- Brands (`fa-brands-*`)

**Usage in HTML:**
```html
<i class="fas fa-icon-name"></i>
```

**Common Icons Used:**
- Play/Pause controls
- File operations
- Navigation
- Social links

## Security

- **Path traversal**: Always use `validatePath()` on file-serving endpoints
- **XSS prevention**: Escape user input in HTML (`escapeHtml()` function)
- **Error responses**: Return 403 for access denied, 404 for missing files
- **Local only**: Server designed for local development, not internet-facing

## Key Differences from microStudio

When syncing from upstream microStudio, preserve these modifications:

### Screen Class (`static/js/runtime/screen.js`)
- Keep `isInsideCanvas()` method
- Keep canvas parameter in constructor
- Keep `resize()` call in constructor
- Keep `setDrawRotation` in `getInterface()`
- Remove `runtime.listener.log()` from `drawSprite()` and `drawSpritePart()`

### Runtime Class (`static/js/runtime/runtime.js`)
- Keep canvas + options parameters in constructor
- Keep `projectName` property
- Keep API endpoint URLs (`/api/sprite/`, `/api/map/`, `/api/sound/`, `/api/music/`)
- Keep empty resources check (`checkStartReady()`)
- Keep `ms_libs || []` fallback

### Server (`server.js`)
- Sprite scanning uses `{ recursive: true }`
- Sprite broadcast uses full normalized path with `.png`
- Projects at `/{slug}` (not `/run/{slug}`)
- Root `/` serves simplified homepage
- Reserved routes: `/api`, `/static`, `/favicon.ico`
- File watchers use `ignoreInitial: true`
- Uses `--project-path` argument instead of registry
- Graceful shutdown handling
- Shutdown marker files

### Font Handling
- Font names case-sensitive (upstream may differ)
- Only BitCell built-in (upstream has 48 built-ins)
- BitCell not copied to project assets (runtime handles it)
- Asset references preserve case in export/backup/import

### UI Enhancements (NOT in microStudio)
- **Font Awesome icons** for all UI elements
- **Terminal component** for real-time logging
- **Time Machine** for debugging (record/replay states)
- **Game state management** via `game.*` API
- **Random utilities** via `random.*` API
- **Enhanced storage** via `storage.*` API
- **System API** for browser integration

## Adding New Features

1. **New CLI command**: Add to `cli.js` switch statement
2. **New API endpoint**: Add route in `server.js`, use `validatePath()` for file access
3. **New runtime function**: Add to `global` object in `startReady()` method in `runtime.js`
4. **New screen API**: Add method to Screen class in `screen.js`
5. **New backend module**: Create in `src/`, export functions, import in `server.js`
6. **Project configuration**: Update `createConfig()` and `project.toml` schema

## Useful References

- **microStudio Repository**: https://github.com/pmgl/microstudio
- **Font Documentation**: `docs/fonts.md`
- **microStudio Docs**: https://microstudio.dev/documentation/
- **Font Awesome**: https://fontawesome.com/icons
