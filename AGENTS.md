# AGENTS.md - microRunner

Guidelines for AI agents working on this codebase.

## Project Overview

microRunner is a local development environment for microStudio games.

- **Server**: Node.js/Express + WebSocket for hot reload
- **Frontend**: Vanilla JavaScript + microStudio Runtime
- **Compiler**: microScript v2 (copied from upstream microStudio)
- **Projects**: Stored outside microRunner folder (user-specified location)

## Build Commands

```bash
npm start        # Production server (port 3000)
npm run dev      # Development server with auto-restart
npm install      # Install dependencies
```

Type "rs" and Enter to restart server during development.

## File Organization

```
microrunner/
├── server.js              # Main entry point, all API endpoints
├── package.json           # npm configuration
├── projects.toml          # Project registry
├── static/
│   ├── index.html         # Project browser UI
│   ├── game.html          # Game runner with terminal
│   ├── fonts/             # GUI fonts (Inter, Hack) + BitCell
│   ├── template/          # Template files for new projects
│   ├── css/
│   │   ├── fonts.css      # @font-face (Inter, Hack)
│   │   ├── style.css      # Main UI styles
│   │   ├── terminal.css   # Terminal component styles
│   │   └── theme.css      # Theme variables (--color-*)
│   └── js/
│       ├── backup.js              # Backup modal UI
│       ├── terminal/              # Terminal component
│       │   ├── terminal.js        # Terminal class, history, commands
│       │   └── console.js         # Console interception
│       ├── runtime/               # microStudio Runtime (adapted)
│       │   ├── runtime.js         # Main Runtime class, game loop
│       │   ├── screen.js          # 2D rendering, input handling
│       │   ├── microvm.js         # microScript VM, storage
│       │   ├── watcher.js         # Variable watching for debugging
│       │   ├── player.js          # Runtime controller, message passing
│       │   ├── sprite.js          # Sprite animation handling
│       │   ├── map.js             # Tilemap rendering
│       │   ├── assetmanager.js    # Asset loading (fonts, models, wasm)
│       │   └── audio/
│       │       ├── audio.js       # WebAudio API wrapper
│       │       └── beeper.js      # audio.beep() implementation
│       └── languages/microscript/v2/
│           ├── compiler.js        # microScript compiler
│           └── tokenizer.js       # Lexer
└── src/
    ├── config.js          # Project TOML config + registry management
    ├── backup.js          # Backup/restore + import/export
    ├── trash.js           # Deleted project management (30-day retention)
    ├── update.js          # Self-update functionality
    └── note.js            # Project notes (Markdown files)
```

## Architecture

### Server (`server.js`)
- Express server with chokidar file watchers
- WebSocket server for hot reload and logging
- Path validation middleware for security
- MTIME caching (5s TTL) for modification time tracking
- Config caching (30s TTL) for project.toml parsing

### Runtime (`static/js/runtime/runtime.js`)
- **Game Loop**: `requestAnimationFrame` based, 60fps default
- **Update/Draw Cycle**: `update()` -> `draw()` pattern per frame
- **Hot Reload**: File watchers trigger code updates via WebSocket
- **Input Handling**: Keyboard, gamepad, mouse, touch
- **API Exposure**: screen, audio, keyboard, gamepad, sprites, sounds, music, maps, assets, asset_manager, storage, system

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

### Project Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET | List all projects with metadata |
| `/api/projects` | POST | Create new project |
| `/api/project/:name` | GET | Get project config and files |
| `/api/project/:name` | DELETE | Move project to trash folder |
| `/api/project/:name/config` | PUT | Update project config |
| `/api/project/:name/note` | GET | Get project note (Markdown) |
| `/api/project/:name/note` | PUT | Save project note |
| `/api/project/:name/note` | DELETE | Delete project note |
| `/api/project/open` | POST | Open existing folder, resolve slug conflicts |
| `/api/project/:name/duplicate` | POST | Duplicate project |
| `/api/project/:name/duplicate/preview` | GET | Preview duplicate settings |

### Sprites/Media

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sprite/:project/*` | GET | Serve sprite images |
| `/api/map/:project/*` | GET | Serve map JSON files |
| `/api/sound/:project/*` | GET | Serve sound files (wav, mp3, ogg, flac) |
| `/api/music/:project/*` | GET | Serve music files |
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
| `/api/project/:name/restore` | POST | Restore from backup |
| `/api/project/:name/restore-upload` | POST | Restore from uploaded ZIP |
| `/api/project/:name/backups/upload` | POST | Upload backup ZIP |

### Import/Export

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/import-project` | POST | Import project from ZIP |
| `/api/import-project/preview` | POST | Preview imported config |

### Utilities

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/default-path` | GET | Get default project path |
| `/api/unique-folder-name` | GET | Generate unique folder name |
| `/api/slug-exists` | GET | Check if slug exists |
| `/api/documents-path` | GET | Get OS documents path |
| `/api/system/pick-folder` | GET | Native OS folder picker dialog |
| `/api/version` | GET | Check for updates |
| `/api/update/download` | GET | Download and install update |

### Routing

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:project` | GET | Serve game runner (game.html) |
| `/` | GET | Serve project browser (index.html) |

### WebSocket

| URL | Purpose |
|-----|---------|
| `ws://localhost:PORT/ws?project=SLUG` | Hot reload and logging |

## Config Module (`src/config.js`)

### TOML Configuration Structure

```javascript
{
  microrunnerVersion: "1.0-beta-4",
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
| `read(projectPath)` | Parse project.toml | Config object |
| `write(projectPath, config)` | Write project.toml | - |
| `createConfig(name, slug, options)` | Create new config | Config object |
| `syncSprites(projectPath)` | Scan sprites dir, auto-detect frames | - |
| `getSpriteProperties(spriteName, projectPath)` | Get sprite frames/fps | Object |
| `detectSpriteFrames(spritePath, direction)` | Detect animation frames | Number |
| `touch(projectPath)` | Update lastModified | - |
| `generateDefaultProjectPath(baseName)` | Get Documents/ path | String |
| `generateUniqueFolderName(baseName)` | Get unique folder name | String |
| `getDocumentsPath()` | Get OS documents path | String |
| `readProjectsToml()` | Read registry | `{ projects: { paths: [] } }` |
| `writeProjectsToml(data)` | Write registry | - |
| `addProject(slug, path)` | Add to registry | - |
| `removeProject(slug)` | Remove from registry | - |
| `getProjectPath(slug)` | Get path by slug | String |
| `getAllProjects()` | List all projects | Array |
| `cleanStaleProjects()` | Remove missing paths | - |
| `updateProjectSlug(old, new, path)` | Update slug in registry | - |
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
| `getProjectPath(project)` | Get project path | String |

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

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/project/:name/note` | GET | Get project note content |
| `/api/project/:name/note` | PUT | Save project note |
| `/api/project/:name/note` | DELETE | Delete project note |

### Frontend Features

- **Note icon** (fa-sticky-note) in project card header
- **Color indicator** - icon uses accent color when note exists
- **Inline editing** - click icon to edit note in card
- **Fullscreen mode** - expand icon for larger editor
- **ESC key** - exits note mode with unsaved changes warning
- **Unsaved changes dialog** - warns before discarding

## Common Workflows

### Project Creation
1. User provides name, slug, path in Create modal
2. Server validates slug uniqueness via `/api/slug-exists`
3. Creates directory structure: `ms/`, `sprites/`, `assets/`
4. Copies template files: `icon.png`, `BitCell.ttf`, `main.ms`
5. Creates `project.toml` with config
6. Adds entry to `projects.toml` registry
7. Reloads project list on client

### Hot Reload
1. User edits `.ms` file in external IDE
2. Server `chokidar` detects change (recursive: true)
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
8. Register in `projects.toml`
9. Show success modal

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
5. Entry removed from `projects.toml` registry
6. On server restart: `trash.emptyExpiredTrash()` removes folders older than 30 days

### Note Workflow
1. User clicks note icon (fa-sticky-note) on project card
2. Card transforms into note editor with project icon and name
3. User edits note content in textarea
4. Click "Save" to persist to `{projectPath}/note.md`
5. Click "Cancel" or ESC to exit (with warning if unsaved changes)
6. Click expand icon to open fullscreen note editor

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
| Modal width (default) | 480px | All form modals |
| Modal width (backups) | 640px | Backup list modal |
| Modal width (note expanded) | 860px | Fullscreen note editor |

### Auto-Update Behavior
- `excludePatterns` in server.js protects these folders/files during updates:
  - `projects.toml` - Project registry
  - `node_modules` - Dependencies
  - `logs` - Log files
  - `trash` - Deleted projects (preserved for 30 days)
- On server restart: `trash.emptyExpiredTrash()` permanently deletes expired trashed projects

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

### System API (`system.*`)

- `system.javascript(code)` - Execute JavaScript from microScript
- `system.openURL(url)` - Open URL in browser
- `system.setUpdateRate(fps)` - Set game update rate
- `system.exit()` - Close game runner

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

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/slug-exists?slug=` | GET | Check if slug exists |
| `/api/unique-folder-name?slug=` | GET | Get unique folder name |

### Validation Rules

- Regex: `/^[a-z0-9-]+$/`
- Lowercase only
- Dashes for spaces
- No special characters

### Frontend Functions

```javascript
generateSlug(name)              // Convert name to valid slug
debounce(func, wait)            // Debounce utility (100ms)
checkCreateSlugExists(slug)     // Create modal validation
checkConfigSlugExists(slug)     // Config modal validation
checkDuplicateSlugExists(slug)  // Duplicate modal validation
checkImportSlugExists(slug)     // Import modal validation
saveConfig()                    // Save project config
openDeleteModal(slug, name)     // Open delete modal
closeTopmostModal()             // Close topmost modal (ESC or click outside)
pickFolder(inputId)             // Open folder picker, update input (inputId: "create-path"|"import-path"|"duplicate-path")
toggleNote(slug)                // Toggle note editor on project card
saveNote(slug)                  // Save note content
handleNoteCancel(slug)          // Cancel note editing (with unsaved changes warning)
expandNote(slug)                // Expand note to fullscreen modal
closeNoteExpand()               // Close fullscreen note modal
saveNoteExpand(slug)            // Save note from fullscreen modal
handleProjectCardClick(slug)    // Handle project card click (skip if in note mode)
```

### Modal Behavior

| Modal | Width | Slug Editable | Auto-generated | Path Field | Closes on |
|-------|-------|---------------|----------------|------------|-----------|
| Create | 480px | Yes | Yes, from name | Auto-unique | ESC, click outside |
| Configure | 480px | Yes | No | Read-only | ESC, click outside |
| Duplicate | 480px | Yes | Yes, from name | Auto-unique | ESC, click outside |
| Import | 480px | Yes | Yes, from filename | Auto-unique | ESC, click outside |
| Delete | 480px | N/A | N/A | Read-only | ESC, click outside |
| Backups | 640px | N/A | N/A | N/A | ESC, click outside |
| Update | 480px | N/A | N/A | N/A | ESC, click outside |
| Note | Fullscreen | N/A | N/A | N/A | ESC, click outside, Save, Cancel |

## Font Loading

microRunner uses a unified approach for loading fonts. See `docs/fonts.md` for detailed documentation.

### Built-in Fonts

| Font | Location | Setup Required |
|------|----------|----------------|
| **BitCell** | `static/fonts/BitCell.ttf` | No - loaded automatically |
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
- Root `/` serves project browser
- Reserved routes: `/api`, `/static`, `/favicon.ico`
- File watchers use `ignoreInitial: true`

### Font Handling
- Font names case-sensitive (upstream may differ)
- Only BitCell built-in (upstream has 48 built-ins)
- Asset references preserve case in export/backup/import

## Adding New Features

1. **New API endpoint**: Add route in `server.js`, use `validatePath()` for file access
2. **New runtime function**: Add to `global` object in `startReady()` method in `runtime.js`
3. **New screen API**: Add method to Screen class in `screen.js`
4. **New backend module**: Create in `src/`, export functions, import in `server.js`
5. **Project configuration**: Update `getProjectConfig()` and `project.toml` schema
6. **New frontend module**: Add to `static/js/`, import in appropriate HTML

## Useful References

- **microStudio Repository**: https://github.com/pmgl/microstudio
- **Font Documentation**: `docs/fonts.md`
- **microStudio Docs**: https://microstudio.dev/documentation/
