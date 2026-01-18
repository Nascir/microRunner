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
    var err, file, name, split;
    if (typeof font !== "string") {
      return;
    }
    file = font.replace(/\//g, "-");
    split = file.split("-");
    name = split[split.length - 1];
    try {
      font = new FontFace(name, `url(/api/assets/${this.runtime.projectName}/${file}.ttf)`);
      return font.load().then(() => {
        document.fonts.add(font);
        this.loadedFonts.add(name);
        this.runtime?.listener?.log(`Font loaded: ${name}`);
      }).catch((err) => {
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
      });
    } catch (error) {
      err = error;
      if (this.runtime?.listener?.reportWarning) {
        this.runtime.listener.reportWarning({
          message: `Failed to load font "${name}": ${err.message}`,
          type: 'font_load_error'
        });
      }
    }
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
    return BABYLON.SceneLoader.LoadAssetContainer("", `/api/assets/${this.runtime.projectName}/${path}`, scene, (container) => {
      loader.container = container;
      loader.ready = 1;
      if (callback) {
        return callback(container);
      }
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
    return loader;
  }

  loadJSON(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `/api/assets/${this.runtime.projectName}/${path}.json`;
    loader = {
      ready: 0
    };
    fetch(path).then((result) => {
      return result.json().then((data) => {
        loader.data = data;
        loader.ready = 1;
        if (callback) {
          return callback(data);
        }
      });
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
    fetch(path).then((result) => {
      return result.text().then((text) => {
        loader.text = text;
        loader.ready = 1;
        if (callback) {
          return callback(text);
        }
      });
    });
    return loader;
  }

  loadCSV(path, callback) {
    return this.loadText(path, callback, "csv");
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
    fetch(path).then((response) => {
      return response.arrayBuffer().then((buffer) => {
        return WebAssembly.instantiate(buffer).then((result) => {
          loader.instance = result.instance;
          loader.ready = 1;
          if (callback) {
            return callback(loader.instance);
          }
        });
      });
    });
    return loader;
  }

};
