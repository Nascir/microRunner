this.Terminal = class Terminal {
  constructor(runwindow, tid = "terminal") {
    this.runwindow = runwindow;
    this.tid = tid;
    this.localStorage = localStorage;
    this.commands = {
      clear: () => {
        return this.clear();
      }
    };
    this.loadHistory();
    this.buffer = [];
    this.length = 0;
    this.error_lines = 0;
    this.started = false;
  }

  loadHistory() {
    this.history = [];
    try {
      const saved = localStorage.getItem("console_history");
      if (saved != null) {
        this.history = JSON.parse(saved);
      }
    } catch (e) {}
  }

  saveHistory() {
    localStorage.setItem("console_history", JSON.stringify(this.history));
  }

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    
    const container = document.getElementById(this.tid);
    if (!container) return;
    
    const input = document.getElementById(`${this.tid}-input`);
    if (!input) return;
    
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const v = input.value;
        input.value = "";
        this.validateLine(v);
      } else if (event.key === "ArrowUp") {
        if (this.history_index == null) {
          this.history_index = this.history.length - 1;
          this.current_input = input.value;
        } else {
          this.history_index = Math.max(0, this.history_index - 1);
        }
        if (this.history_index === this.history.length - 1) {
          this.current_input = input.value;
        }
        if (this.history_index >= 0 && this.history_index < this.history.length) {
          input.value = this.history[this.history_index];
          this.setTrailingCaret(input);
        }
      } else if (event.key === "ArrowDown") {
        if (this.history_index === this.history.length) {
          return;
        }
        if (this.history_index != null) {
          this.history_index = Math.min(this.history.length, this.history_index + 1);
        } else {
          return;
        }
        if (this.history_index >= 0 && this.history_index < this.history.length) {
          input.value = this.history[this.history_index];
          this.setTrailingCaret(input);
        } else if (this.history_index === this.history.length) {
          input.value = this.current_input || "";
          this.setTrailingCaret(input);
        }
      }
    });
    
    setInterval(() => {
      this.update();
    }, 16);
  }

  setTrailingCaret(input) {
    setTimeout(() => {
      const val = input.value;
      input.setSelectionRange(val.length, val.length);
    }, 0);
  }

  validateLine(v) {
    this.history_index = null;
    if (v.trim().length > 0 && v !== this.history[this.history.length - 1]) {
      this.history.push(v);
      if (this.history.length > 1000) {
        this.history.splice(0, 1);
      }
      this.saveHistory();
    }
    
    if (this.commands[v.trim()] != null) {
      return this.commands[v.trim()]();
    }
  }

  update() {
    const container = document.getElementById(`${this.tid}-lines`);
    if (!container) return;

    if (this.buffer.length > 0) {
      for (const t of this.buffer) {
        const div = this.echoReal(t.text, t.classname);
        container.appendChild(div);
        this.length++;
      }

      this.buffer = [];

      const view = document.getElementById(`${this.tid}-view`);
      if (view) {
        const lastChild = container.lastElementChild;
        if (lastChild) {
          lastChild.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }

  echo(text, scroll = false, classname) {
    this.buffer.push({
      text: text,
      classname: classname
    });
  }

  echoReal(text, classname) {
    const div = document.createElement("div");
    div.textContent = text;
    if (classname != null) {
      div.classList.add(classname);
    }
    this.truncate();
    return div;
  }

  error(text, scroll = false) {
    this.echo(text, scroll, "error");
    this.error_lines += 1;
  }

  warn(text, scroll = false) {
    this.echo(text, scroll, "warning");
  }

  truncate() {
    const lines = document.getElementById(`${this.tid}-lines`);
    if (!lines) return;
    while (this.length > 10000 && lines.firstChild) {
      lines.removeChild(lines.firstChild);
      this.length--;
    }
  }

  clear() {
    const lines = document.getElementById(`${this.tid}-lines`);
    if (lines) {
      lines.innerHTML = "";
    }
    this.buffer = [];
    this.length = 0;
    this.error_lines = 0;
  }
};
