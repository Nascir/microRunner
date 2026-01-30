# microRunner

> **Warning: This is a beta version.** The software may contain bugs, breaking changes, or unexpected behavior. Use with caution and expect potential issues. Back up your projects regularly.

CLI-based local development environment for microStudio games with hot reload.

## Features

- **microScript 2.0 compatible** - full compiler, runtime, and all APIs
- **Both system and web-view terminal support** - print() output
- **Run, pause, restart** game controls
- **Hot reload** - changes appear instantly via WebSocket (no page refresh)
- **Import/Export** projects in microStudio ZIP format
- **CLI** - run microRunner server inside your project

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
microrunner init           # Creates project files in current folder
microrunner start          # Starts server, opens browser
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `microrunner` | Show help |
| `microrunner init` | Create new project in current folder |
| `microrunner import <file.zip>` | Import from microStudio ZIP |
| `microrunner start` | Scan sprites and start the server |
| `microrunner export` | Export project to ZIP |
| `microrunner backup` | Create backup of the project |
| `microrunner version` | Show version |
| `microrunner help` | Show help |

## Project Structure

```
my-game/
├── project.toml       # Project configuration
├── ms/
│   └── main.ms        # Your microScript code
├── sprites/           # Sprite images (png, jpg)
├── maps/              # Map files (json)
├── sounds/            # Sound effects (wav, ogg, flac)
├── music/             # Music tracks (mp3, ogg, flac)
└── assets/            # Fonts, JSONs, other resources
```

## Development Workflow

1. Create or import a project using CLI
2. Run `microrunner start` - browser opens automatically
3. Open the project folder in your favorite IDE
4. Write microScript code in `ms/` folder
5. Add assets to their respective folders 
6. Edit code - changes appear instantly via hot reload

## System Requirements

- Node.js 16.0.0 or higher
- Git (for installation via `git clone`)
- Modern browser (Chrome, Firefox, Safari)
- macOS, Linux, or Windows

## Guides

Additional guides in `docs/` folder:

- [Fonts](docs/fonts.md) - Custom fonts in projects
- [Sprites](docs/sprites.md) - Sprite animations

## Licenses

- **microRunner**: MIT License - [LICENSE](LICENSE)
- **microStudio Runtime**: MIT License - [LICENSE-microStudio](LICENSE-microStudio)
- **Third-party**: [THIRD-PARTY.txt](THIRD-PARTY.txt)
