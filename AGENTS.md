# AGENTS.md - microRunner

Guidelines for AI agents working on this codebase.

## Project Overview

microRunner is a **CLI-based** local development environment for microStudio games.

- **CLI**: Node.js executable (`microrunner.js`) with commands: `init`, `import`, `start`, `export`, `backup`, `version`, `help`
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
microrunner export         # Export project to microStudio compatible ZIP
microrunner backup         # Create a backup of the project
microrunner version        # Show version
microrunner help           # Show help
```

## File Organization

```
microrunner/
├── audit/                   # Security audit reports
├── dev/                     # Development artifacts
├── eslint.config.js         # ESLint configuration
├── microrunner.js           # CLI entry point
├── nodemon.json             # Nodemon configuration
├── server.js                # Main server entry point
├── package.json             # npm configuration
├── THIRD-PARTY.txt          # Third-party licenses
├── LICENSE-microStudio      # microStudio runtime license
├── static/
│   ├── favicon.ico          # Site favicon
│   ├── theme.json           # UI theme configuration
│   ├── index.html           # Homepage (minimal, badges only)
│   ├── microrunner.html     # Game runner with terminal
│   ├── fonts/            # GUI fonts (Inter, Hack) + BitCell
│   ├── template/         # Template files for new projects
│   ├── lib/              # External libraries
│   │   └── font-awesome/ # Font Awesome icons for UI
│   ├── css/
│   │   ├── fonts.css     # @font-face (Inter, Hack)
│   │   ├── style.css     # Main UI styles
│   │   └── terminal.css  # Terminal component styles
│   └── js/
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
    ├── cli/                # CLI commands and routing
    │   ├── index.js        # Main CLI router
    │   ├── init.js         # init command
    │   ├── start.js        # start command
    │   ├── import.js       # import command
    │   ├── export.js       # export command
    │   ├── backup.js       # backup command
    │   ├── help.js         # help command
    │   └── version.js      # version command
    └── project/            # Project management modules
        ├── config.js       # Project TOML config
        ├── backup.js       # Backup/restore functionality
        ├── export.js       # Export to microStudio format
        ├── import.js       # Import from ZIP
        └── files.js        # File collection utilities
```

## Architecture

### CLI (`microrunner.js`)

| Command | Description |
|---------|-------------|
| `microrunner` or `microrunner help` | Show help |
| `microrunner init` | Initialize new project in empty folder (interactive - asks for name/slug) |
| `microrunner import <file.zip>` | Import project from microStudio ZIP file |
| `microrunner start` | Scan sprites, start server, open game runner at `/:slug` |
| `microrunner export` | Export project to microStudio compatible ZIP (saved to `export/{slug}.zip`) |
| `microrunner backup` | Create project backup (saved to `backup/{slug}_{timestamp}_backup.zip`) |
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

**Export behavior:**
- Creates ZIP compatible with microStudio import
- Saves to `export/{slug}.zip` in project directory
- Generates `project.json` with Unix timestamps (`date_created`, `last_modified`)
- Includes all project files: `ms/`, `sprites/`, `maps/`, `sounds/`, `music/`, `assets/`, `doc/`
- Creates empty thumbnail folders: `sounds_th/`, `music_th/`, `assets_th/`

**Backup behavior:**
- Creates backup ZIP in `backup/{slug}_{YYYYMMDD}_{HHMMSS}_backup.zip`
- Uses internal microRunner format with ISO timestamp dates
- Includes all project files

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
| `/:project` | GET | Serve game runner (microrunner.html) |
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

### Import/Export

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/import-project` | POST | Import project from ZIP |
| `/api/import-project/preview` | POST | Preview imported config |

### WebSocket

| URL | Purpose |
|-----|---------|
| `ws://localhost:PORT/ws?project=SLUG` | Hot reload and logging |

## Config Module (`src/project/config.js`)

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
| `toMicroStudioJson(config, filesInfo)` | Convert to microStudio format (Unix timestamps) | Object |
| `fromProjectJson(json)` | Import from microStudio | Config object |

### Caching

- Config cache: 30s TTL via `tomlConfigCache` Map
- Sprite properties: 30s cache
- MTIME cache: 5s TTL

## Backup Module (`src/project/backup.js`)

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `createBackup(project, options)` | Create timestamped backup | `{ fileName, fullPath, timestamp }` |
| `listBackups(project)` | List all backups | Array |
| `deleteBackup(project, file)` | Delete backup | - |
| `getBackupPath(project, file)` | Get full backup path | String |
| `restoreProject(project, backup, options)` | Restore from backup | `{ success, config }` |
| `getProjectPath(project)` | Get project path (searches for project.toml) | String |

## Export Module (`src/project/export.js`)

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `createExport(projectPath)` | Export project to ZIP | `{ filePath }` |

### Export Format

```
{slug}.zip
├── project.json        # microStudio project config (generated from project.toml)
├── ms/                 # Source files (*.ms)
├── sprites/            # Images (png, jpg, jpeg)
├── maps/               # Maps (json)
├── sounds/             # Audio (wav, mp3, ogg, flac)
├── music/              # Music (wav, mp3, ogg, flac)
├── assets/             # 3D models, fonts, wasm, json
├── doc/                # Documentation (md)
├── sounds_th/          # Empty thumbnail folder
├── music_th/           # Empty thumbnail folder
└── assets_th/          # Empty thumbnail folder
```

## Import Module (`src/project/import.js`)

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `importProject(zipPath, options)` | Import project from ZIP | `{ success, slug, name, path, warning }` |
| `previewProject(zipPath)` | Preview imported config | Project config preview |
| `safeExtractZip(zipPath, destDir)` | Extract ZIP safely | `{ entries, projectJson }` |

## Files Module (`src/project/files.js`)

### Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `collect(projectPath)` | Collect all project files by category | Object with arrays |
| `collectWithSizes(projectPath)` | Collect files with sizes | Object with arrays (includes size) |

### File Categories

- `sources` - `*.ms` files
- `sprites` - `*.png`, `*.jpg`, `*.jpeg`
- `maps` - `*.json`
- `sounds` - `*.wav`, `*.ogg`, `*.flac`
- `music` - `*.mp3`, `*.ogg`, `*.flac`
- `assets` - `*.glb`, `*.obj`, `*.ttf`, `*.wasm`, etc.
- `docs` - `*.md`

### File Patterns

File patterns are defined in `src/constants.js`:

```javascript
SPRITES = /\.(png|jpg|jpeg)$/i;
SOUNDS = /\.(wav|ogg|flac)$/i;
MUSIC = /\.(mp3|ogg|flac)$/i;
ASSETS = /\.(glb|obj|jpg|ttf|wasm|txt|csv|json)$/i;
SOURCES = /\.ms$/;
MAPS = /\.json$/;
DOCS = /\.md$/;
```

### Archive Structure

```
project_backup.zip
├── project.toml         # microRunner project config
├── ms/                  # Source files (*.ms)
├── sprites/             # Images (png, jpg, gif)
├── maps/                # Maps (json)
├── sounds/              # Audio (wav, mp3, ogg, flac)
├── music/               # Music (wav, mp3, ogg, flac)
├── assets/              # 3D models, fonts, wasm, json
└── doc/                 # Documentation (md)
```

## Adding New Features

1. **New CLI command**: Add to `src/cli/index.js` switch statement, create handler in `src/cli/`
2. **New API endpoint**: Add route in `server.js`, use `validatePath()` for file access
3. **New runtime function**: Add to `global` object in `startReady()` method in `runtime.js`
4. **New screen API**: Add method to Screen class in `screen.js`
5. **New backend module**: Create in `src/project/`, export functions, import where needed
6. **Project configuration**: Update `createConfig()` and `project.toml` schema

## Useful References

- **microStudio Repository**: https://github.com/pmgl/microstudio
- **Font Documentation**: `docs/fonts.md`
- **microStudio Docs**: https://microstudio.dev/documentation/
- **Font Awesome**: https://fontawesome.com/icons

## Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| MTIME_CACHE_TTL | 5000 | File modification time cache (ms) |
| CONFIG_CACHE_TTL | 30000 | Project config cache (ms) |
| FPS_UPDATE_INTERVAL | 1000 | FPS display update (ms) |
| MAX_TERMINAL_LINES | 10000 | Terminal output limit |
| CURSOR_HIDE_TIMEOUT_MS | 4000 | Hide cursor after inactivity |
| Backup filename format | `{slug}_{YYYYMMDD}_{HHMMSS}_{suffix}.zip` | - |
| Export filename format | `{slug}.zip` | - |

## Constants Module (`src/constants.js`)

Exports project-wide constants used throughout the application:

| Constant | Value | Purpose |
|----------|-------|---------|
| `PROJECT_ROOT` | path | Root directory of microRunner |
| `PROJECT_DIRS` | `['ms', 'sprites', 'maps', 'sounds', 'music', 'assets', 'doc']` | Project subdirectories |
| `THUMBNAIL_DIRS` | `['sounds_th', 'music_th', 'assets_th']` | Thumbnail directories |
| `SPRITES` | `/\.(png|jpg|jpeg)$/i` | Sprite file pattern |
| `SOUNDS` | `/\.(wav|ogg|flac)$/i` | Sound file pattern |
| `MUSIC` | `/\.(mp3|ogg|flac)$/i` | Music file pattern |
| `ASSETS` | `/\.(glb|obj|jpg|ttf|wasm|txt|csv|json)$/i` | Asset file pattern |
| `SOURCES` | `/\.ms$/` | Source file pattern |
| `MAPS` | `/\.json$/` | Map file pattern |
| `DOCS` | `/\.md$/` | Documentation file pattern |
| `VERSION` | From `package.json` | Current version string |

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

### Export Project
1. User runs `microrunner export` in project folder
2. CLI creates `export/` directory if needed
3. CLI collects all project files
4. CLI generates `project.json` with Unix timestamps
5. CLI creates ZIP with all project files
6. CLI saves to `export/{slug}.zip`

### Creating Backup
1. User runs `microrunner backup` in project folder
2. CLI creates `backup/` directory if needed
3. CLI collects all project files
4. CLI adds `project.toml` directly to ZIP
5. CLI creates ZIP with all project files
6. CLI saves to `backup/{slug}_{YYYYMMDD}_{HHMMSS}_backup.zip`

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
