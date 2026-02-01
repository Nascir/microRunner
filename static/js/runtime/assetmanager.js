this.AssetManager = class AssetManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.loadedFonts = new Set();
    this.interface = {
      loadFont: (font) => {
        return this.loadFont(font);
      },
      loadModel: (path, scene, callback) => {
        return this.loadModel(path, scene, callback);
      },
      loadImage: (path, callback) => {
        return this.loadImage(path, callback);
      },
      loadJSON: (path, callback) => {
        return this.loadJSON(path, callback);
      },
      loadText: (path, callback) => {
        return this.loadText(path, callback);
      },
      loadCSV: (path, callback) => {
        return this.loadCSV(path, callback);
      },
      loadMarkdown: (path, callback) => {
        return this.loadMarkdown(path, callback);
      },
      wasmInstance: (path, callback) => {
        return this.wasmInstance(path, callback);
      }
    };
  }

  getInterface() {
    return this.interface;
  }

  loadFont(font) {
    var err, file, fontFace, loader, name, split;
    if (typeof font !== "string") {
      return;
    }
    file = font.replace(/\//g, "-");
    split = file.split("-");
    name = split[split.length - 1];
    loader = {
      ready: 0
    };
    try {
      fontFace = new FontFace(name, `url(/api/assets/${this.runtime.projectName}/${file}.ttf)`);
      fontFace.load().then(() => {
        document.fonts.add(fontFace);
        this.loadedFonts.add(name);
        loader.ready = 1;
        this.runtime?.listener?.log(`Font loaded: ${name}`);
      }).catch((err) => {
        console.error('[AssetManager] Font load error:', err.message);
        if (this.runtime?.listener?.reportWarning) {
          let msg = `Failed to load font "${name}": ${err.message}`;
          if (err.message.includes("network") || err.message.includes("Failed to load resource")) {
            msg = `Font file not found: assets/${name}.ttf. Check that the file exists and the name is correct (case-sensitive).`;
          }
          this.runtime.listener.reportWarning({
            message: msg,
            type: 'font_load_error'
          });
        }
        this.runtime?.listener?.log('ERROR: Failed to load font "' + name + '" - ' + err.message);
        loader.ready = 1;
      });
    } catch (error) {
      err = error;
      console.error('[AssetManager] Font error:', err.message);
      if (this.runtime?.listener?.reportWarning) {
        this.runtime.listener.reportWarning({
          message: `Failed to load font "${name}": ${err.message}`,
          type: 'font_load_error'
        });
      }
      this.runtime?.listener?.log('ERROR: Failed to load font "' + name + '" - ' + err.message);
      loader.ready = 1;
    }
    return loader;
  }

  loadModel(path, scene, callback) {
    var loader;
    if (typeof BABYLON === "undefined" || BABYLON === null) {
      return;
    }
    loader = {
      ready: 0
    };
    if (this.runtime.assets[path] != null) {
      path = this.runtime.assets[path].file;
    } else {
      path = path.replace(/\//g, "-");
      path += ".glb";
    }
    var url = `/api/assets/${this.runtime.projectName}/${path}`;
    return BABYLON.SceneLoader.LoadAssetContainer("", url, scene, (container) => {
      loader.container = container;
      loader.ready = 1;
      if (callback) {
        return callback(container);
      }
    }, (err) => {
      console.error('[AssetManager] Model load error:', err.message);
      this.runtime?.listener?.log('ERROR: Failed to load model - ' + url + ' - ' + err.message);
      loader.ready = 1;
      loader.error = true;
    });
  }

  loadImage(path, callback) {
    var img, loader;
    loader = {
      ready: 0
    };
    if (this.runtime.assets[path] != null) {
      path = this.runtime.assets[path].file;
    }
    img = new Image;
    img.src = `/api/assets/${this.runtime.projectName}/${path}`;
    img.onload = () => {
      var i;
      i = new msImage(img);
      loader.image = i;
      loader.ready = 1;
      if (callback) {
        return callback(i);
      }
    };
    img.onerror = () => {
      console.error('[AssetManager] Image load error:', path);
      this.runtime?.listener?.log('ERROR: Failed to load image - ' + path);
      loader.ready = 0;
      loader.error = true;
    };
    return loader;
  }

  loadJSON(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `/api/assets/${this.runtime.projectName}/${path}.json`;
    loader = {
      ready: 0
    };
    fetch(path)
      .then((result) => {
        if (!result.ok) {
          throw new Error(`HTTP ${result.status}: ${result.statusText}`);
        }
        return result.json();
      })
      .then((data) => {
        loader.data = data;
        loader.ready = 1;
        if (callback) {
          return callback(data);
        }
      })
      .catch((err) => {
        console.error('[AssetManager] Load error:', err.message);
        this.runtime?.listener?.log('ERROR: Failed to load ' + path + ' - ' + err.message);
        loader.ready = 1;
      });
    return loader;
  }

  loadText(path, callback, ext = "txt") {
    var loader;
    path = path.replace(/\//g, "-");
    path = `/api/assets/${this.runtime.projectName}/${path}.${ext}`;
    loader = {
      ready: 0
    };
    fetch(path)
      .then((result) => {
        if (!result.ok) {
          throw new Error(`HTTP ${result.status}: ${result.statusText}`);
        }
        return result.text();
      })
      .then((text) => {
        loader.text = text;
        loader.ready = 1;
        if (callback) {
          return callback(text);
        }
      })
      .catch((err) => {
        console.error('[AssetManager] Load error:', err.message);
        this.runtime?.listener?.log('ERROR: Failed to load ' + path + ' - ' + err.message);
        loader.ready = 1;
      });
    return loader;
  }

  loadCSV(path, callback) {
    return this.loadText(path, (text) => {
      var lines = text.split('\n').filter(l => l.trim());
      var data = lines.map(line => line.split(','));
      if (callback) callback(data);
    }, "csv");
  }

  loadMarkdown(path, callback) {
    return this.loadText(path, callback, "md");
  }

  wasmInstance(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `/api/assets/${this.runtime.projectName}/${path}.wasm`;
    loader = {
      ready: 0
    };
    fetch(path)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        return WebAssembly.instantiate(buffer);
      })
      .then((result) => {
        loader.instance = result.instance;
        loader.ready = 1;
        if (callback) {
          return callback(loader.instance);
        }
      })
      .catch((err) => {
        console.error('[AssetManager] WASM load error:', err.message);
        this.runtime?.listener?.log('ERROR: Failed to load WASM - ' + path + ' - ' + err.message);
        loader.ready = 1;
        loader.error = true;
      });
    return loader;
  }

};
