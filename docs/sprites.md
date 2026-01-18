# Sprites

Configure sprite animations in your project's `project.toml` file.

## Sprite Sheet Layout

```toml
[sprites]
direction = "vertical"   # default - frames stacked top to bottom
# direction = "horizontal"  # frames stacked left to right
```

## Animation Frames

```toml
[sprites."player.png"]
frames = 4  # number of animation frames in the sprite sheet
```

Frames are detected automatically from image dimensions:
- Vertical: `frames = height / width` (e.g., 64×128 = 2 frames)
- Horizontal: `frames = width / height` (e.g., 128×64 = 2 frames)

## Animation Speed

Default FPS is 5. Change at runtime in your microScript code:

```microscript
mySprite = sprites.player
mySprite.setFPS(20)  # Change animation speed
```

## Import and Export

When importing from microStudio ZIP, sprite properties are preserved.
When exporting a project to microStudio ZIP format, all sprite configurations are maintained.
