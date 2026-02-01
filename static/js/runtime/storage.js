this.Storage = class Storage {
  constructor() {
    this.prefix = "microstudio_";
  }

  set(name, value) {
    var key, v;
    key = this.prefix + name;
    try {
      v = JSON.stringify(value);
      localStorage.setItem(key, v);
    } catch (error) {
      console.error("Storage set failed:", error);
    }
    return value;
  }

  get(name, defaultValue) {
    var key, result;
    key = this.prefix + name;
    try {
      result = localStorage.getItem(key);
      if (result != null) {
        return JSON.parse(result);
      }
    } catch (error) {
      console.error("Storage get failed:", error);
    }
    return defaultValue !== undefined ? defaultValue : 0;
  }
};
