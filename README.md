# microRunner

> **Warning: This is a beta version.** The software may contain bugs, breaking changes, or unexpected behavior. Use with caution and expect potential issues. Back up your projects regularly.

CLI-based local development environment for microStudio games with hot reload.

## Features

- **microScript 2.0 compatible** - full compiler, runtime, and all APIs
- **Hot reload** - changes appear instantly via WebSocket (no page refresh)
- **Integrated terminal** - print() output, warnings, errors and debugging
- **Run, pause, restart** game controls
- **Import/Export** projects in microStudio ZIP format
- **CLI-first** - full control from terminal
- **Auto-update** from GitHub

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

### Import from microStudio

```bash
cd ~/projects
microrunner import game.zip   # Import microStudio project
ls                            # Check extracted folder name
cd <extracted-folder>
microrunner start
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `microrunner` | Show help |
| `microrunner init` | Create new project in current folder |
| `microrunner import <file.zip>` | Import from microStudio ZIP |
| `microrunner start` | Scan sprites and start the server |
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
└── assets/            # Fonts, models, other resources
```

## Development Workflow

1. Create or import a project using CLI
2. Run `microrunner start` - browser opens automatically
3. Open the project folder in your favorite IDE
4. Write microScript code in `ms/` folder
5. Add assets to their respective folders 
6. Edit code - changes appear instantly via hot reload

## System Requirements

- Node.js 16.0 or higher
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
