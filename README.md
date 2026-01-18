# microRunner

> **Warning: This is a beta version.** The software may contain bugs, breaking changes, or unexpected behavior. Use with caution and expect potential issues. Back up your projects regularly.

Local microScript development environment with hot reload for microStudio games.

## Features

- microScript 2.0 compatible - full compiler, runtime, and all APIs
- Hot reload - changes appear instantly via WebSocket (no page refresh)
- Integrated terminal - print() output, warnings, errors and enhanced debugging information
- Run, pause, step, and restart game
- Project browser - manage multiple projects
- Import and export projects in microStudio ZIP format
- Internal backup and restore with notes
- Auto check for new microRunner version

## Install

```bash
git clone https://github.com/Nascir/microRunner
cd microrunner
npm install
```

## Run

```bash
npm start
```

Open http://localhost:3000

## Get started

1. **Create or import a project**
   - Click "New Project" in the project browser to create a new project
   - Or "Import" to import a project from a microStudio ZIP archive

2. **Open the project in the IDE**
   - Open the project folder in your favorite IDE
   - Write your microScript code in the `ms/` folder (e.g., `ms/main.ms`)
   - Add assets to their respective folders:
     - `sprites/` - sprite images
     - `maps/` - map files
     - `sounds/` - sound effects
     - `music/` - music tracks
     - `assets/` - fonts and other resources

## Guides

Additional guides are available in the `docs/` folder:

- [Setting Up Fonts](docs/fonts.md) - How to use custom fonts in your projects
- [Sprites](docs/sprites.md) - How to configure sprite animations

## System Requirements

- Node.js 16.0 or higher
- Modern browser (Chrome, Firefox, Safari)

## Licenses

- **microRunner**: MIT License - see [LICENSE](LICENSE)
- **microStudio Runtime**: MIT License - see [LICENSE-microStudio](LICENSE-microStudio)
- **Third-party dependencies**: see [THIRD-PARTY.txt](THIRD-PARTY.txt)
