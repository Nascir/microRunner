# How to Set Up Fonts in microRunner

This guide explains how to properly set up and use custom fonts in your microRunner project.

## Chapter 1: Quick Start

### Adding a Font File

Place your `.ttf` font file in the `assets/` folder of your project:

```
my-project/
├── assets/
│   ├── MyFont.ttf      # Your font file
│   └── ...
├── sprites/
├── maps/
└── ms/
    └── main.ms
```

### Loading the Font in Code

```microScript
init = function()
  asset_manager.loadFont("MyFont")
  while true
    if screen.isFontReady("MyFont") then break end
    sleep 0.1
  end
  screen.setFont("MyFont")
end
```

## Chapter 2: How Fonts Work

### microStudio vs microRunner

**microStudio** has 48 built-in fonts available by default in online projects. You can use them directly without any setup - just call `screen.setFont("ModernDos")` and it works.

**microRunner** is different. It only includes **one** built-in font: **BitCell**. All other 47 fonts must be added to your project and loaded manually.

### Case Sensitivity

Font names are case-sensitive. Use the exact name as it appears in the font file.

## Chapter 3: Built-in Fonts

### BitCell

**BitCell** is the default font in microRunner (`static/fonts/BitCell.ttf`). If you don't set another font, text will be drawn with BitCell automatically. No setup required.

## Chapter 4: External Fonts

### The 47 Unsupported microStudio Fonts

If your project uses any of these 47 fonts, microRunner will show a warning:

```
⚠️ Font "ModernDos" is a built-in microStudio font. microRunner doesn't include built-in fonts (except BitCell).
Download "ModernDos.ttf" from microStudio and add it to your assets/ folder.
```

### Setup Instructions

1. Download the font `.ttf` from microStudio
2. Add it to your `assets/` folder
3. Load it in code with `asset_manager.loadFont("FontName")`

### Font List

The following fonts require manual setup:

AESystematic, Alkhemikal, AlphaBeta, Arpegius, Awesome, block_cell, Blocktopia, Comicoro, Commodore64, DigitalDisco, Edunline, EnchantedSword, EnterCommand, Euxoi, FixedBold, GenericMobileSystem, GrapeSoda, JupiterCrash, Kapel, KiwiSoda, Litebulb8bit, LycheeSoda, MisterPixel, ModernDos, NokiaCellPhone, PearSoda, PixAntiqua, PixChicago, PixelArial, PixelOperator, Pixellari, Pixolde, PlanetaryContact, PressStart2P, RainyHearts, RetroGaming, Revolute, Romulus, Scriptorium, Squarewave, Thixel, Unbalanced, UpheavalPro, VeniceClassic, ZXSpectrum, Zepto
