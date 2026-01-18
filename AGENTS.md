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

No formal tests or linting configured.

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

## File Organization

```
microrunner/
├── server.js           # Main entry point
├── package.json        # npm configuration
├── projects.toml       # Project registry
├── static/
│   ├── index.html      # Project browser UI
│   ├── game.html       # Game runner with terminal
│   ├── fonts/          # GUI fonts only (Inter, Hack)
│   ├── template/       # Template files for new projects
│   │   ├── BitCell.ttf # Default game font
│   │   ├── icon.png    # Default project icon
│   │   └── main.ms     # Default main.ms
│   ├── css/
│   │   ├── fonts.css         # @font-face (Inter, Hack only)
│   │   ├── style.css
│   │   └── terminal.css
│   └── js/
│       ├── backup.js           # Backup modal UI
│       ├── terminal/           # Terminal component
│       ├── runtime/            # microStudio Runtime (adapted)
│       │   ├── runtime.js      # Main Runtime class
│       │   ├── screen.js       # Screen API
│       │   ├── microvm.js      # Virtual machine
│       │   ├── watcher.js      # Hot reload watcher
│       │   └── audio/          # Audio subsystem
│       └── languages/microscript/v2/  # Compiler
└── src/
    ├── config.js       # Project TOML config module
    └── backup.js       # Backup/restore module
```

## Key Differences from microStudio

When syncing from upstream microStudio, preserve these modifications:

### Screen Class (`static/js/runtime/screen.js`)
- Keep `isInsideCanvas()` method (guards clicks outside canvas)
- Keep canvas parameter in constructor
- Keep `resize()` call in constructor
- Keep `setDrawRotation` in `getInterface()`
- Remove `runtime.listener.log()` from `drawSprite()` and `drawSpritePart()` (suppress runtime errors, show only compiler warnings in terminal)

### Runtime Class (`static/js/runtime/runtime.js`)
- Keep canvas + options parameters in constructor
- Keep `projectName` property
- Keep API endpoint URLs (`/api/sprite/`, `/api/map/`, `/api/sound/`, `/api/music/`)
- Keep empty resources check (`checkStartReady()`)
- Keep `ms_libs || []` fallback

### Server (`server.js`)
- Sprite scanning uses `{ recursive: true }` for subdirectory support
- Sprite broadcast uses full normalized path (with .png extension)

### Config (`src/config.js`)
- `getSpriteProperties()` normalizes sprite names (removes .png extension for key lookup)

### Font Loading (`static/js/runtime/assetmanager.js` and `screen.js`)
- Font names are case-sensitive - use exact name matching the font file
- `asset_manager.loadFont()` preserves original case from font file name
- `screen.loadFont()` and `screen.isFontReady()` use the same case as passed
- All asset references (fonts, sprites, maps, sounds, music) preserve case when:
  - Exporting to microStudio ZIP format
  - Creating backups
  - Importing projects from ZIP archives
  - Restoring projects from backups

## Utility Modules

### `src/config.js`

```javascript
const config = require('./src/config.js');

// Project TOML operations
config.read(projectPath)           // Parse project.toml
config.write(projectPath, config)  // Write project.toml
config.createConfig(name, slug, opts)  // Create new project config

// Sprite management
config.syncSprites(projectPath)
config.detectSpriteFrames(spritePath, direction)

// Registry management (projects.toml)
config.readProjectsToml()
config.writeProjectsToml(data)
config.addProject(slug, path)
config.getProjectPath(slug)
config.getAllProjects()
```

### `src/backup.js`

```javascript
const backup = require('./src/backup.js');

// Backups
backup.createBackup(project, options)
backup.listBackups(project)
backup.restoreProject(project, file, options)

// Import/Export
backup.createExport(project)           // microStudio format ZIP
backup.importProjectFromArchive(zipPath, customPath)

// Project management
backup.duplicateProject(project)
backup.getProjectPath(project)
```

## Security

- **Path traversal**: Use `validatePath()` function on all file-serving endpoints
- **XSS prevention**: Always escape user input in HTML templates
- **Error responses**: Return 403 for access denied, 404 for missing files
- **Local only**: Server designed for local development, not internet-facing

## Adding New Features

1. **New API endpoint**: Add route in `server.js`, use `validatePath()` for file access
2. **New runtime function**: Add to `global` object in `startReady()` method in `runtime.js`
3. **New screen API**: Add method to Screen class in `screen.js`
4. **Project configuration**: Update `getProjectConfig()` and `project.toml` schema

## Font Loading

microRunner uses a unified approach for loading fonts in projects. See [docs/fonts.md](docs/fonts.md) for detailed documentation.

### Built-in Fonts

| Font | Location | Setup Required |
|------|----------|----------------|
| **BitCell** | `static/fonts/BitCell.ttf` | No - loaded automatically |
| **Inter, Hack** | `static/fonts/` | No - UI fonts only |
| **Other fonts** | `assets/` | Yes - requires `asset_manager.loadFont()` |

### microStudio Built-in Fonts

microStudio includes 47 built-in fonts that are NOT available in microRunner. When a project uses one of these fonts, a warning is displayed in the terminal:

```
⚠️ Font "ModernDos" is a built-in microStudio font. microRunner doesn't include built-in fonts (except BitCell).
Download "ModernDos.ttf" from microStudio and add it to your assets/ folder.
```

**List of unsupported microStudio fonts:**
AESystematic, Alkhemikal, AlphaBeta, Arpegius, Awesome, block_cell, Blocktopia, Comicoro, Commodore64, DigitalDisco, Edunline, EnchantedSword, EnterCommand, Euxoi, FixedBold, GenericMobileSystem, GrapeSoda, JupiterCrash, Kapel, KiwiSoda, Litebulb8bit, LycheeSoda, MisterPixel, ModernDos, NokiaCellPhone, PearSoda, PixAntiqua, PixChicago, PixelArial, PixelOperator, Pixellari, Pixolde, PlanetaryContact, PressStart2P, RainyHearts, RetroGaming, Revolute, Romulus, Scriptorium, Squarewave, Thixel, Unbalanced, UpheavalPro, VeniceClassic, ZXSpectrum, Zepto

### Implementation

- `BUILTIN_FONTS` array in `screen.js` contains the list of unsupported microStudio fonts
- `loadFont()` triggers a warning for built-in microStudio fonts (shown once per font)
- `loadBuiltinFont()` automatically loads BitCell from `static/fonts/`

- **microStudio Repository**: https://github.com/pmgl/microstudio
- Use for compatibility checks when implementing features
- Copy updated runtime files to `static/js/runtime/` then re-apply microRunner modifications
