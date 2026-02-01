# microRunner

Local microScript development environment for [microStudio](https://github.com/pmgl/microstudio) projects

## Features

- **microScript 2.0 Support** – compiler and runtime
- **microStudio Graphics API** - full implementation
- **Any IDE** - Write code in your favourite IDE (check available microScript extensions in Zed or VS Code)
- **Dual Console Output** – `print()` appears in both terminal (system console) and in-game terminal
- **Hot Reload via WebSocket** – Edit code, save and see changes instantly without page refresh
- **Game Controls** – Run, pause, and restart your game directly from the browser UI
- **ZIP Compatibility** – Import existing microStudio projects or export your work as ZIP archives
- **CLI-First Workflow** – Start the development server with a single command from your project folder
- **Auto Asset Discovery** – Assets in `sprites/`, `maps/`, `sounds/`, `music/`, and `assets/` folders are automatically detected
- **Port Management** – Automatically finds an available port if 3000 is in use

## Quick Start

### Installation

```bash
git clone https://github.com/Nascir/microRunner
cd microrunner
npm install
npm link   # Creates global 'microrunner' command
```

### Create a Project

```bash
cd ~/my-awesome-game
microrunner init         # Creates project files in current (empty) folder
microrunner start        # Starts server and opens browser
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `microrunner` | Show help |
| `microrunner init` | Create new project in current (empty) folder |
| `microrunner start` | Scan sprites and start the server |
| `microrunner backup` | Create backup of the project |
| `microrunner import <file.zip>` | Import from microStudio ZIP |
| `microrunner export` | Export project to microStudio ZIP |
| `microrunner version` | Show version |

## Project Structure

```
my-game/
├── project.toml       # Project configuration
├── ms/
│   └── main.ms        # Your microScript code
├── sprites/           # Sprite images (PNG, JPG)
├── maps/              # Map files (JSON)
├── sounds/            # Sound effects (WAV, OGG, FLAC)
├── music/             # Music tracks (MP3, OGG, FLAC)
├── doc/               # Documentation (Markdown files)
└── assets/            # Fonts, JSONs, and other resources
```

## Development Workflow

1. Create (`microrunner init`) or import (`microrunner import <file.zip>`) a project using CLI
2. Run `microrunner start` - server starts and browser opens automatically
3. Open the project folder in your favorite IDE
4. Write microScript code in `ms/` folder
5. Add assets to their respective folders 
6. Edit code and save - changes appear instantly via hot reload

## Update microRunner

`git pull`

## System Requirements

- Node.js 16.0.0 or higher
- Git (for installation via `git clone` and updates via `git pull`)
- Modern browser (Chrome, Firefox, Safari)
- macOS, Windows or Linux

## Guides

Additional guides in `docs/` folder:

- [Fonts](docs/fonts.md) - Custom fonts in projects
- [Sprites](docs/sprites.md) - Sprite animations
