this.System = {
  time: function() {
    return Date.now();
  },

  language: (typeof navigator !== "undefined" && navigator.language) || "en",

  inputs: {
    keyboard: 1,
    mouse: 1,
    touch: ("ontouchstart" in window) ? 1 : 0,
    gamepad: 0
  },

  say: function(text) {
    alert(text);
  },

  prompt: function(text, callback) {
    var result = prompt(text);
    if (callback) {
      callback(result !== null ? 1 : 0, result || "");
    }
    return result;
  },

  pause: function() {},

  exit: function() {},

  loading: 100,

  preemptive: 1,

  disable_autofullscreen: 0,

  update_rate: 60,

  file: {
    loaded: null,
    dropped: null,
    load: function(types, callback) {
      var input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = types.join(",");
      input.onchange = function(event) {
        var files = event.target.files;
        var results = [];
        var index = 0;
        var processFile = function() {
          if (index < files.length) {
            var file = files[index++];
            var reader = new FileReader();
            reader.onload = function(e) {
              results.push({
                name: file.name,
                size: file.size,
                content: e.target.result,
                file_type: file.type
              });
              processFile();
            };
            reader.readAsDataURL(file);
          } else {
            System.file.loaded = results;
            if (callback) {
              callback(results);
            }
          }
        };
        processFile();
      };
      input.click();
    },
    save: function(obj, name, format, quality) {
      console.warn("system.file.save is not fully supported in external mode");
    }
  },

  project: null
};
