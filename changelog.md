# Changelog

## [1.0-beta-12] - 2026-01-29

### Fixed
- Random number generator now correctly returns values in range [0, 1] instead of [0, 1)
  (changed from `this._seed * this.norm` to `this._seed / (this.size - 1)`)
- Hexadecimal number parsing now uses explicit radix 16 for better compatibility
  (changed `Number.parseInt(s)` to `Number.parseInt(s, 16)` in tokenizer.js)

## [1.0-beta-11] - 2026-01-28

### Added
- Session separator in server terminal with timestamp and URL reminder on:
  - Game RESTART button click
  - Browser page reload
  - New WebSocket connection

### Fixed
- `--chrome` option for `microrunner start` command now works correctly
  (fixed API compatibility with `open` package v10.x using `apps.chrome`)

### Changed
- Updated CLI documentation in README.md

### Hidden
- `--chrome` flag is now undocumented (hidden feature)

## [1.0-beta-10] - 2025-12-19

### Added
- Initial beta release
- microScript 2.0 compiler and runtime
- Hot reload support via WebSocket
- Import/Export projects in microStudio ZIP format
- CLI commands: init, import, start, export, backup, version, help
