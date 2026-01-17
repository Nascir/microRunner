# microRunner

> **Warning: This is an experimental version.** The software may contain bugs, breaking changes, or unexpected behavior. Use with caution and expect potential issues. Back up your projects regularly.

Local microScript development environment with hot reload for microStudio games.

## Features

- microScript 2.0 compatible - full compiler, runtime, and all APIs
- Hot reload - changes appear instantly without restarting
- Integrated terminal - game output and errors below canvas
- Run, pause, step, and restart controls
- Import and export projects in microStudio ZIP format
- Backup and restore with notes

## Install

```bash
git clone https://github.com/anomalyco/microrunner.git
cd microrunner
npm install
```

## Run

```bash
npm start
```

Open http://localhost:3000

## System Requirements

- Node.js 16.0 or higher
- Modern browser (Chrome, Firefox, Safari)

## Sprites

Configure sprite animations in your project's `project.toml` file.

**Sprite sheet layout:**
```toml
[sprites]
direction = "vertical"   # default - frames stacked top to bottom
# direction = "horizontal"  # frames stacked left to right
```

**Animation frames:**
```toml
[sprites."player.png"]
frames = 4  # number of animation frames in the sprite sheet
```

Frames are detected automatically from image dimensions:
- Vertical: `frames = height / width` (e.g., 64×128 = 2 frames)
- Horizontal: `frames = width / height` (e.g., 128×64 = 2 frames)

**Animation speed:**
Default FPS is 5. Change at runtime in your microScript code:
```
mySprite = sprites.player
mySprite.setFPS(20)  # Change animation speed
```

**Import:** When importing from microStudio ZIP, sprite properties are preserved.

## Licenses

- **microRunner**: MIT License - see [LICENSE](LICENSE)
- **microStudio Runtime**: MIT License - see [LICENSE-microStudio](LICENSE-microStudio)
- **Third-party dependencies**: see [THIRD-PARTY.txt](THIRD-PARTY.txt)
