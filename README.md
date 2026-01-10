# microRunner

> **Warning: This is an experimental version.** The software may contain bugs, breaking changes, or unexpected behavior. Use with caution and expect potential issues. Back up your projects regularly.

Local microScript development environment with hot reload for microStudio games.

## Features

- **microScript 2.0 compatible** - full compiler, runtime, all APIs
- **Integrated terminal** - game output below canvas
- **Execution controls** - run, pause, step forward, restart
- **Hot reload** - changes appear instantly
- **Loop warnings** - timeout warnings with file and line info
- **Offline capable** - no internet required
- **microStudio import/export** - ZIP format
- **Project configuration** - orientation, aspect ratio, sprite direction
- **Backup system** - create, restore, manage with notes

## Getting Started

```
npm install
npm start
```

Open http://localhost:3000

## Sprite Animation

Configure animated sprites (sprite sheets) per project:

**Sprite Sheet Direction** - how frames are arranged (in `config.json`):
- `spriteDirection: "vertical"` (default) - frames stacked vertically
- `spriteDirection: "horizontal"` - frames stacked horizontally

**Auto-detection of frames:**
- Vertical: `frames = height / width` (e.g., 64×128 = 2 frames)
- Horizontal: `frames = width / height` (e.g., 128×64 = 2 frames)

**Default FPS:** 5 (can be changed at runtime with `sprite.setFPS(fps)`)

**Changing FPS at runtime:**
Use `sprite.setFPS(fps)` in your microScript code:
```
init = function()
  mySprite = sprites.anim
  mySprite.setFPS(20)  // Change animation speed
end
```

**Project JSON format (frames only, fps controlled in code):**
```
{
  "files": {
    "sprites/sprite.png": {
      "properties": {
        "frames": 4
      }
    }
  }
}
```

**Import:** Sprite properties preserved when importing from microStudio ZIP

See [AGENTS.md](AGENTS.md) for documentation.

## Licenses

- **microRunner**: MIT License - see [LICENSE](LICENSE)
- **microStudio Runtime**: MIT License - see [LICENSE-microStudio](LICENSE-microStudio)
- **Third-party dependencies**: see [THIRD-PARTY.txt](THIRD-PARTY.txt)
