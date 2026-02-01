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
    loaded: [],
    dropped: [],
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
      var a, canvas, dataUrl, ext, mimeType;
      ext = format || "png";
      mimeType = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp"
      }[ext.toLowerCase()] || "image/png";
      if (typeof obj === "object" && obj !== null) {
        if (obj.class && obj.class.classname === "Image") {
          canvas = obj.canvas || obj.image;
          if (canvas) {
            dataUrl = canvas.toDataURL(mimeType, quality);
            a = document.createElement("a");
            a.style = "display: none";
            a.href = dataUrl;
            a.download = name || "image." + ext;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return 1;
          }
        }
      }
      console.warn("system.file.save is not fully supported in external mode");
      return 0;
    }
  },

  project: null
};
