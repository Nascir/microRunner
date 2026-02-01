class Player {
  constructor(listener) {
    this.listener = listener;
    this.runtime = null;
  }

  init(runtime) {
    this.runtime = runtime;
    if (this.listener) {
      this.listener({ name: "started" });
    }
  }

  call(name, args = []) {
    if (this.runtime != null && this.runtime.vm != null) {
      return this.runtime.vm.call(name, args);
    }
    return null;
  }

  setGlobal(name, value) {
    if (this.runtime != null && this.runtime.vm != null) {
      this.runtime.vm.context.global[name] = value;
    }
  }

  exec(command, callback) {
    if (this.runtime != null && this.runtime.runCommand != null) {
      return this.runtime.runCommand(command, callback);
    }
    if (callback) {
      callback({ error: "runCommand not available" });
    }
  }

  postMessage(data) {
    if (this.listener) {
      try {
        this.listener(data);
      } catch (err) {
        console.error("Player listener error:", err);
      }
    }
  }
}
