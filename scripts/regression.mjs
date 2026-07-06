import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const html = await fs.readFile(path.join(process.cwd(), "game.js"), "utf8");

function createClassList() {
  const values = new Set([""]);
  return {
    add(className) {
      values.add(className);
    },
    remove(className) {
      values.delete(className);
    },
    contains(className) {
      return values.has(className);
    },
    list() {
      return Array.from(values).filter(Boolean).join(" ");
    },
  };
}

function createElement(id) {
  const el = {
    id,
    textContent: "",
    style: {},
    classList: createClassList(),
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    appendChild() {},
  };
  Object.defineProperty(el, "className", {
    get() {
      return this.classList.list();
    },
    set(value) {
      this.classList = createClassList();
      (value || "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((cls) => this.classList.add(cls));
    },
  });
  return el;
}

function createCanvasContext() {
  return new Proxy(
    {
      imageSmoothingEnabled: false,
      fillStyle: "",
      strokeStyle: "",
      fillRect() {},
      clearRect() {},
      fillText() {},
      stroke() {},
      beginPath() {},
      rect() {},
      setTransform() {},
      drawImage() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      fill() {},
      lineWidth: 0,
      globalAlpha: 1,
      font: "",
      textAlign: "start",
      lineCap: "",
    },
    {
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
}

const storage = new Map();
const rafQueue = [];
function requestAnimationFrame(cb) {
  rafQueue.push(cb);
  return rafQueue.length;
}

function tickFrames(count = 1) {
  for (let i = 0; i < count; i += 1) {
    const frame = rafQueue.shift();
    if (typeof frame === "function") frame((i + 1) * 16.666);
  }
}

class MockAudio {
  constructor(src = "") {
    this.src = src;
    this.preload = "";
    this.loop = false;
    this.volume = 1;
    this.currentTime = 0;
    this.paused = true;
    this.played = false;
  }

  cloneNode() {
    const clone = new MockAudio(this.src);
    clone.preload = this.preload;
    clone.loop = this.loop;
    clone.volume = this.volume;
    return clone;
  }

  play() {
    this.paused = false;
    this.played = true;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

class MockAudioContext {
  constructor() {
    this.state = "running";
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  createGain() {
    return {
      gain: {
        value: 0,
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {
        return this;
      },
    };
  }

  createOscillator() {
    return {
      type: "square",
      frequency: { value: 0 },
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }
}

const elements = new Map(
  ["scoreValue", "bestValue", "levelValue", "livesValue", "overlay", "overlayTitle", "overlayBody", "startButton", "gameCanvas", "leftBtn", "rightBtn", "fireBtn", "pauseBtn"].map((id) => [id, createElement(id)]),
);
const canvasContext = createCanvasContext();
elements.get("gameCanvas").getContext = () => canvasContext;

const document = {
  getElementById(id) {
    return elements.get(id) || null;
  },
};

const context = {
  console,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame,
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  Math,
  Number,
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  },
  navigator: {
    vibrate() {
      return true;
    },
  },
  Image: class {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this._src = "";
    }
    set src(v) {
      this._src = v;
      if (this.onload) this.onload();
    }
    get src() {
      return this._src;
    }
  },
  Audio: MockAudio,
  URLSearchParams: globalThis.URLSearchParams,
  window: {
    setTimeout,
    clearTimeout,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    pageXOffset: 0,
    pageYOffset: 0,
    location: { search: "?qa=1" },
    performance: { now: () => Date.now() },
    addEventListener() {},
    removeEventListener() {},
    navigator: {
      vibrate() {
        return true;
      },
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    document,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    runAnimationFrames: tickFrames,
  },
  document,
  performance: {
    now: () => Date.now(),
  },
  URL: "http://localhost/",
  location: { search: "?qa=1", href: "http://localhost/?qa=1" },
  navigator: {
    vibrate() {
      return true;
    },
  },
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
};

context.window = context;

const script = new vm.Script(html, { filename: "game.js" });
const sandbox = vm.createContext(context);
script.runInContext(sandbox);

const debug = sandbox.__spaceInvadersDebug;
if (!debug) {
  console.error("Regression API not found.");
  process.exit(1);
}

const checkpoints = debug.runRegressionSweep();
console.log("REGRESSION_CHECKPOINTS", JSON.stringify(checkpoints, null, 2));

const start = checkpoints.find((item) => item.label === "running");
const ready = checkpoints.find((item) => item.label === "ready");
const gameOver = checkpoints.find((item) => item.label === "game-over");

const pass =
  start && start.phase === "running" && ready && ready.phase === "ready" && gameOver && gameOver.phase === "gameOver";
console.log("REGRESSION_PASS", pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
