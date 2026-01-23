const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const PROJECT_DIRS = ['ms', 'sprites', 'maps', 'sounds', 'music', 'assets', 'doc'];
const THUMBNAIL_DIRS = ['sounds_th', 'music_th', 'assets_th'];

const SPRITES = /\.(png|jpg|jpeg)$/i;
const SOUNDS = /\.(wav|ogg|flac)$/i;
const MUSIC = /\.(mp3|ogg|flac)$/i;
const ASSETS = /\.(glb|obj|jpg|ttf|wasm|txt|csv|json)$/i;
const SOURCES = /\.ms$/;
const MAPS = /\.json$/;
const DOCS = /\.md$/;

const pkg = require(path.join(PROJECT_ROOT, 'package.json'));
const VERSION = pkg.version;

module.exports = {
  PROJECT_ROOT,
  PROJECT_DIRS,
  THUMBNAIL_DIRS,
  SPRITES,
  SOUNDS,
  MUSIC,
  ASSETS,
  SOURCES,
  MAPS,
  DOCS,
  VERSION,
};
