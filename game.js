(() => {
  "use strict";

  // Fixed logical world (portrait cabinet aspect)
  const WORLD = { width: 448, height: 512 };
  const GREEN = "#33ff66";
  const DIM = "#1f8a3a";

  const UI = {
    score: document.getElementById("scoreValue"),
    best: document.getElementById("bestValue"),
    level: document.getElementById("levelValue"),
    lives: document.getElementById("livesValue"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayBody: document.getElementById("overlayBody"),
    startButton: document.getElementById("startButton"),
  };
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const fireBtn = document.getElementById("fireBtn");
  const pauseBtn = document.getElementById("pauseBtn");

  // Classic formation + step pacing (inspired by 1978 Taito/Midway)
  const CFG = {
    rows: 5,
    cols: 11,
    // top rows worth more: squid 30, crab 20, octopus 10
    rowPoints: [30, 20, 20, 10, 10],
    rowType: [0, 1, 1, 2, 2], // sprite family
    alienW: 24,
    alienH: 16,
    gapX: 32,
    gapY: 28,
    startX: 36,
    startY: 72,
    playerW: 26,
    playerH: 14,
    playerY: WORLD.height - 56,
    playerSpeed: 160,
    shotSpeed: 280,
    alienShotSpeed: 120,
    maxPlayerShots: 1,
    maxAlienShots: 2,
    // step interval (seconds) — starts slow, floors as ranks thin
    stepBase: 0.88,
    stepMin: 0.055,
    stepPerKill: 0.012,
    stepPerWave: 0.04,
    dropPx: 16,
    leftBound: 8,
    rightBound: WORLD.width - 8,
    bunkerY: WORLD.height - 150,
    bunkerCount: 4,
    block: 4,
    ufoY: 40,
    ufoSpeed: 70,
    ufoValues: [50, 100, 150, 300],
    ufoMin: 8,
    ufoMax: 16,
    invuln: 2.0,
  };

  // Classic-ish 11x8-ish bitmaps (1 = pixel). Families: 0 squid, 1 crab, 2 octopus (+ alt frames)
  const ALIEN_BMP = {
    0: [
      [
        "00100000100",
        "00010001000",
        "00111111100",
        "01101110110",
        "11111111111",
        "10111111101",
        "10100000101",
        "00011011000",
      ],
      [
        "00100000100",
        "10010001001",
        "10111111101",
        "11101110111",
        "11111111111",
        "00111111100",
        "00100000100",
        "01000000010",
      ],
    ],
    1: [
      [
        "00011111000",
        "00111111100",
        "01101101110",
        "01111111110",
        "00111111100",
        "0001001000",
        "0010000100",
        "0100000010",
      ],
      [
        "00011111000",
        "00111111100",
        "01101101110",
        "01111111110",
        "00111111100",
        "0001001000",
        "0010000100",
        "0001001000",
      ],
    ],
    2: [
      [
        "0001111000",
        "0111111110",
        "1111111111",
        "1100110011",
        "1111111111",
        "0011001100",
        "0100110010",
        "0010000100",
      ],
      [
        "0001111000",
        "0111111110",
        "1111111111",
        "1100110011",
        "1111111111",
        "0011001100",
        "0010110100",
        "0100000010",
      ],
    ],
  };

  const state = {
    phase: "title", // title | ready | running | paused | gameOver
    score: 0,
    best: Number(localStorage.getItem("space-invaders-best") || 0),
    level: 1,
    lives: 3,
    player: null,
    aliens: [],
    bullets: [],
    alienBullets: [],
    bunkers: [],
    ufo: null,
    alienDir: 1,
    stepTimer: 0,
    stepInterval: CFG.stepBase,
    marchIdx: 0,
    animFrame: 0,
    shotCd: 0,
    alienFireT: 1.2,
    ufoT: 10,
    readyT: 0,
    invuln: 0,
    groundY: WORLD.height - 28,
  };

  const input = { left: false, right: false, fire: false };
  let last = 0;
  let audio = null;
  let ufoOsc = null;
  let worldScale = 1;

  function pad4(n) {
    return String(Math.max(0, n | 0)).padStart(4, "0");
  }

  function updateHUD() {
    UI.score.textContent = pad4(state.score);
    UI.best.textContent = pad4(state.best);
    UI.level.textContent = String(state.level);
    UI.lives.textContent = String(state.lives);
  }

  function setOverlay(phase) {
    if (phase === "title") {
      UI.overlayTitle.textContent = "SPACE INVADERS";
      UI.overlayBody.innerHTML = "DESTROY THE INVADERS<br>L/R · FIRE · DEFEND EARTH";
      UI.startButton.textContent = "INSERT COIN / START";
      UI.overlay.classList.remove("hidden");
    } else if (phase === "gameOver") {
      UI.overlayTitle.textContent = "GAME OVER";
      UI.overlayBody.textContent = `SCORE ${pad4(state.score)}`;
      UI.startButton.textContent = "PLAY AGAIN";
      UI.overlay.classList.remove("hidden");
    } else {
      UI.overlay.classList.add("hidden");
    }
  }

  // ---- Web Audio: cabinet-style SFX (no modern BGM) ----
  function ensureAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      if (audio.state === "suspended") audio.resume();
    } catch (_e) {}
  }

  function blip(f0, f1, dur, type, vol) {
    if (!audio) return;
    try {
      const t = audio.currentTime;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type || "square";
      o.connect(g);
      g.connect(audio.destination);
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (_e) {}
  }

  // Classic four-note march (approx low thumps that accelerate with steps)
  const MARCH = [55, 62, 73, 82];
  function playMarch() {
    const f = MARCH[state.marchIdx % 4];
    state.marchIdx++;
    blip(f, f * 0.85, 0.09, "square", 0.07);
  }

  function playShoot() {
    blip(880, 220, 0.08, "square", 0.06);
  }
  function playAlienDie() {
    blip(180, 40, 0.16, "sawtooth", 0.08);
  }
  function playPlayerDie() {
    blip(200, 40, 0.45, "sawtooth", 0.12);
    setTimeout(() => blip(140, 30, 0.35, "square", 0.08), 80);
  }
  function playUfoHit() {
    blip(600, 120, 0.25, "square", 0.09);
  }

  function startUfoSiren() {
    stopUfoSiren();
    if (!audio) return;
    try {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "square";
      o.frequency.value = 180;
      o.connect(g);
      g.connect(audio.destination);
      g.gain.value = 0.03;
      // warble
      const lfo = audio.createOscillator();
      const lfoG = audio.createGain();
      lfo.frequency.value = 6;
      lfoG.gain.value = 40;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);
      o.start();
      lfo.start();
      ufoOsc = { o, g, lfo };
    } catch (_e) {}
  }
  function stopUfoSiren() {
    if (!ufoOsc) return;
    try {
      ufoOsc.o.stop();
      ufoOsc.lfo.stop();
    } catch (_e) {}
    ufoOsc = null;
  }

  // ---- Setup ----
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const controls = 140;
    const availW = Math.min(window.innerWidth - 16, 520);
    const availH = Math.max(320, window.innerHeight - controls - 24);
    worldScale = Math.min(availW / WORLD.width, availH / WORLD.height, 1.35);
    const w = WORLD.width * worldScale;
    const h = WORLD.height * worldScale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr * worldScale, 0, 0, dpr * worldScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function centerPlayer() {
    state.player = {
      x: WORLD.width / 2 - CFG.playerW / 2,
      y: CFG.playerY,
      w: CFG.playerW,
      h: CFG.playerH,
    };
  }

  function createAliens() {
    state.aliens = [];
    // each new wave starts a bit lower
    const yOff = Math.min(48, (state.level - 1) * 8);
    for (let row = 0; row < CFG.rows; row++) {
      for (let col = 0; col < CFG.cols; col++) {
        state.aliens.push({
          row,
          col,
          type: CFG.rowType[row],
          x: CFG.startX + col * CFG.gapX,
          y: CFG.startY + yOff + row * CFG.gapY,
          w: CFG.alienW,
          h: CFG.alienH,
          alive: true,
          score: CFG.rowPoints[row],
        });
      }
    }
    state.alienDir = 1;
    state.animFrame = 0;
    state.stepInterval = Math.max(CFG.stepMin, CFG.stepBase - (state.level - 1) * CFG.stepPerWave);
    state.stepTimer = state.stepInterval;
    state.alienFireT = 1.0;
  }

  function buildBunkers() {
    // Classic notched bunker silhouette
    const shape = [
      "00111111100",
      "01111111110",
      "11111111111",
      "11111111111",
      "11111111111",
      "11100000111",
      "11000000011",
    ];
    state.bunkers = [];
    const bW = shape[0].length * CFG.block;
    const total = CFG.bunkerCount * bW + (CFG.bunkerCount - 1) * 28;
    let x0 = (WORLD.width - total) / 2;
    for (let b = 0; b < CFG.bunkerCount; b++) {
      const blocks = [];
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] === "1") {
            blocks.push({
              x: x0 + c * CFG.block,
              y: CFG.bunkerY + r * CFG.block,
              w: CFG.block,
              h: CFG.block,
              hp: 1,
            });
          }
        }
      }
      state.bunkers.push(blocks);
      x0 += bW + 28;
    }
  }

  function aliveCount() {
    return state.aliens.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
  }

  function recomputeStepInterval() {
    const killed = CFG.rows * CFG.cols - aliveCount();
    state.stepInterval = Math.max(
      CFG.stepMin,
      CFG.stepBase - (state.level - 1) * CFG.stepPerWave - killed * CFG.stepPerKill
    );
  }

  function resetGame() {
    state.score = 0;
    state.level = 1;
    state.lives = 3;
    state.bullets = [];
    state.alienBullets = [];
    state.ufo = null;
    stopUfoSiren();
    centerPlayer();
    createAliens();
    buildBunkers();
    state.invuln = 0;
    state.shotCd = 0;
    state.ufoT = CFG.ufoMin + Math.random() * (CFG.ufoMax - CFG.ufoMin);
    state.phase = "ready";
    state.readyT = 0.8;
    setOverlay("ready");
    updateHUD();
  }

  function nextWave() {
    state.level++;
    state.bullets = [];
    state.alienBullets = [];
    state.ufo = null;
    stopUfoSiren();
    createAliens();
    // rebuild bunkers each wave (arcade-like refresh)
    buildBunkers();
    centerPlayer();
    state.phase = "ready";
    state.readyT = 0.7;
    state.invuln = 0.5;
    updateHUD();
  }

  function gameOver() {
    state.phase = "gameOver";
    stopUfoSiren();
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("space-invaders-best", String(state.best));
    }
    updateHUD();
    setOverlay("gameOver");
    playPlayerDie();
  }

  function hitBunker(bullet) {
    for (const bunker of state.bunkers) {
      for (let i = bunker.length - 1; i >= 0; i--) {
        const bl = bunker[i];
        if (
          bullet.x < bl.x + bl.w &&
          bullet.x + bullet.w > bl.x &&
          bullet.y < bl.y + bl.h &&
          bullet.y + bullet.h > bl.y
        ) {
          bunker.splice(i, 1);
          return true;
        }
      }
    }
    return false;
  }

  function firePlayer() {
    if (state.phase !== "running" || !state.player) return;
    if (state.shotCd > 0) return;
    if (state.bullets.length >= CFG.maxPlayerShots) return;
    state.bullets.push({
      x: state.player.x + state.player.w / 2 - 1,
      y: state.player.y - 8,
      w: 2,
      h: 8,
      v: -CFG.shotSpeed,
      from: "p",
    });
    state.shotCd = 0.18;
    playShoot();
  }

  function fireAlien() {
    const alive = state.aliens.filter((a) => a.alive);
    if (!alive.length || state.alienBullets.length >= CFG.maxAlienShots) return;
    // bottom-most of a random column
    const cols = new Map();
    for (const a of alive) {
      const arr = cols.get(a.col) || [];
      arr.push(a);
      cols.set(a.col, arr);
    }
    const keys = [...cols.keys()];
    const col = keys[(Math.random() * keys.length) | 0];
    const list = cols.get(col).sort((a, b) => b.y - a.y);
    const s = list[0];
    state.alienBullets.push({
      x: s.x + s.w / 2 - 1,
      y: s.y + s.h,
      w: 2,
      h: 8,
      v: CFG.alienShotSpeed + (state.level - 1) * 6,
      from: "a",
    });
    blip(120, 90, 0.06, "square", 0.04);
  }

  function stepAliens() {
    const alive = state.aliens.filter((a) => a.alive);
    if (!alive.length) return;

    let minX = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const a of alive) {
      minX = Math.min(minX, a.x);
      maxX = Math.max(maxX, a.x + a.w);
      maxY = Math.max(maxY, a.y + a.h);
    }

    const stepX = 6 * state.alienDir;
    let drop = false;
    if (minX + stepX < CFG.leftBound || maxX + stepX > CFG.rightBound) {
      state.alienDir *= -1;
      drop = true;
    }

    for (const a of state.aliens) {
      if (!a.alive) continue;
      if (drop) a.y += CFG.dropPx;
      else a.x += 6 * state.alienDir;
    }

    state.animFrame ^= 1;
    playMarch();
    recomputeStepInterval();

    // invaders reach ground / base line
    maxY = -Infinity;
    for (const a of state.aliens) {
      if (a.alive) maxY = Math.max(maxY, a.y + a.h);
    }
    if (maxY >= state.player.y - 2) {
      gameOver();
    }
  }

  function spawnUfo() {
    if (state.ufo) return;
    const left = Math.random() < 0.5;
    state.ufo = {
      x: left ? -40 : WORLD.width + 10,
      y: CFG.ufoY,
      w: 32,
      h: 14,
      v: left ? CFG.ufoSpeed : -CFG.ufoSpeed,
      value: CFG.ufoValues[(Math.random() * CFG.ufoValues.length) | 0],
    };
    startUfoSiren();
  }

  // ---- Update ----
  function update(dt) {
    if (state.phase === "title" || state.phase === "gameOver" || state.phase === "paused") return;

    if (state.phase === "ready") {
      state.readyT -= dt;
      if (state.readyT <= 0) {
        state.phase = "running";
        setOverlay("running");
      }
      return;
    }

    // player
    if (state.player) {
      let vx = 0;
      if (input.left) vx -= CFG.playerSpeed;
      if (input.right) vx += CFG.playerSpeed;
      state.player.x += vx * dt;
      state.player.x = Math.max(CFG.leftBound, Math.min(CFG.rightBound - state.player.w, state.player.x));
    }
    if (input.fire) firePlayer();
    state.shotCd = Math.max(0, state.shotCd - dt);
    state.invuln = Math.max(0, state.invuln - dt);

    // discrete alien steps
    state.stepTimer -= dt;
    if (state.stepTimer <= 0) {
      stepAliens();
      if (state.phase !== "running") return;
      state.stepTimer = state.stepInterval;
    }

    // alien fire rate rises as ranks thin / wave rises
    const alive = aliveCount();
    const fireEvery = Math.max(0.35, 1.15 - (CFG.rows * CFG.cols - alive) * 0.012 - (state.level - 1) * 0.05);
    state.alienFireT -= dt;
    if (state.alienFireT <= 0) {
      fireAlien();
      state.alienFireT = fireEvery * (0.7 + Math.random() * 0.6);
    }

    // bullets player
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.y += b.v * dt;
      if (b.y + b.h < 0) {
        state.bullets.splice(i, 1);
        continue;
      }
      if (hitBunker(b)) {
        state.bullets.splice(i, 1);
        continue;
      }
      // aliens
      let hit = false;
      for (const a of state.aliens) {
        if (!a.alive) continue;
        if (b.x < a.x + a.w && b.x + b.w > a.x && b.y < a.y + a.h && b.y + b.h > a.y) {
          a.alive = false;
          state.score += a.score;
          playAlienDie();
          hit = true;
          break;
        }
      }
      if (hit) {
        state.bullets.splice(i, 1);
        updateHUD();
        recomputeStepInterval();
        if (aliveCount() === 0) nextWave();
        continue;
      }
      // ufo
      if (state.ufo) {
        const u = state.ufo;
        if (b.x < u.x + u.w && b.x + b.w > u.x && b.y < u.y + u.h && b.y + b.h > u.y) {
          state.score += u.value;
          playUfoHit();
          stopUfoSiren();
          state.ufo = null;
          state.bullets.splice(i, 1);
          updateHUD();
        }
      }
    }

    // alien bullets
    for (let i = state.alienBullets.length - 1; i >= 0; i--) {
      const b = state.alienBullets[i];
      b.y += b.v * dt;
      if (b.y > WORLD.height) {
        state.alienBullets.splice(i, 1);
        continue;
      }
      if (hitBunker(b)) {
        state.alienBullets.splice(i, 1);
        continue;
      }
      if (state.player && state.invuln <= 0) {
        const p = state.player;
        if (b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y) {
          state.alienBullets.splice(i, 1);
          state.lives--;
          updateHUD();
          playPlayerDie();
          if (state.lives <= 0) {
            gameOver();
            return;
          }
          state.invuln = CFG.invuln;
          centerPlayer();
          state.bullets = [];
          state.alienBullets = [];
        }
      }
    }

    // ufo move
    if (state.ufo) {
      state.ufo.x += state.ufo.v * dt;
      if (state.ufo.x < -50 || state.ufo.x > WORLD.width + 50) {
        stopUfoSiren();
        state.ufo = null;
      }
    } else {
      state.ufoT -= dt;
      if (state.ufoT <= 0) {
        spawnUfo();
        state.ufoT = CFG.ufoMin + Math.random() * (CFG.ufoMax - CFG.ufoMin);
      }
    }
  }

  // ---- Draw ----
  function drawBitmap(bmp, x, y, scale, color) {
    ctx.fillStyle = color || GREEN;
    const rows = bmp.length;
    const cols = bmp[0].length;
    const pw = (CFG.alienW / cols) * (scale || 1);
    const ph = (CFG.alienH / rows) * (scale || 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (bmp[r][c] === "1") ctx.fillRect(x + c * pw, y + r * ph, pw, ph);
      }
    }
  }

  function drawPlayer() {
    if (!state.player) return;
    if (state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0) return;
    const p = state.player;
    ctx.fillStyle = GREEN;
    // laser base silhouette
    ctx.fillRect(p.x + 2, p.y + 6, p.w - 4, 6);
    ctx.fillRect(p.x + p.w / 2 - 2, p.y, 4, 8);
    ctx.fillRect(p.x, p.y + 10, p.w, 4);
  }

  function drawAliens() {
    for (const a of state.aliens) {
      if (!a.alive) continue;
      const frames = ALIEN_BMP[a.type] || ALIEN_BMP[2];
      const bmp = frames[state.animFrame % frames.length];
      // center bitmap in alien cell
      drawBitmap(bmp, a.x, a.y, 1, GREEN);
    }
  }

  function drawBunkers() {
    ctx.fillStyle = GREEN;
    for (const bunker of state.bunkers) {
      for (const bl of bunker) ctx.fillRect(bl.x, bl.y, bl.w - 0.5, bl.h - 0.5);
    }
  }

  function drawUfo() {
    if (!state.ufo) return;
    const u = state.ufo;
    ctx.fillStyle = GREEN;
    ctx.fillRect(u.x + 4, u.y + 4, u.w - 8, 6);
    ctx.fillRect(u.x, u.y + 8, u.w, 4);
    ctx.fillRect(u.x + 6, u.y + 2, u.w - 12, 4);
  }

  function draw() {
    // black field
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // subtle CRT green scan (very light)
    ctx.fillStyle = "rgba(0,40,0,0.15)";
    for (let y = 0; y < WORLD.height; y += 4) ctx.fillRect(0, y, WORLD.width, 1);

    // top score strip (cabinet-like)
    ctx.fillStyle = GREEN;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", 16, 22);
    ctx.fillText(pad4(state.score), 16, 40);
    ctx.textAlign = "right";
    ctx.fillText("HI-SCORE", WORLD.width - 16, 22);
    ctx.fillText(pad4(state.best), WORLD.width - 16, 40);

    drawUfo();
    drawAliens();
    drawBunkers();
    drawPlayer();

    // shots
    ctx.fillStyle = GREEN;
    for (const b of state.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
    for (const b of state.alienBullets) {
      // zigzag-ish alien bolt
      ctx.fillRect(b.x, b.y, b.w, 3);
      ctx.fillRect(b.x - 1, b.y + 3, b.w + 2, 3);
      ctx.fillRect(b.x, b.y + 6, b.w, 3);
    }

    // ground line
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, state.groundY, WORLD.width, 2);

    // remaining lives as mini bases
    for (let i = 0; i < state.lives; i++) {
      const x = 16 + i * 28;
      const y = WORLD.height - 18;
      ctx.fillRect(x + 2, y + 4, 18, 4);
      ctx.fillRect(x + 9, y, 4, 6);
    }

    if (state.phase === "ready") {
      ctx.fillStyle = GREEN;
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PLAYER ONE", WORLD.width / 2, WORLD.height / 2);
    }
    if (state.phase === "paused") {
      ctx.fillStyle = GREEN;
      ctx.font = "22px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSE", WORLD.width / 2, WORLD.height / 2);
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---- Input ----
  function bindHold(el, on, off) {
    const down = (e) => {
      e.preventDefault();
      ensureAudio();
      on();
    };
    const up = (e) => {
      e.preventDefault();
      off();
    };
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("mouseleave", up);
  }

  bindHold(
    leftBtn,
    () => (input.left = true),
    () => (input.left = false)
  );
  bindHold(
    rightBtn,
    () => (input.right = true),
    () => (input.right = false)
  );
  bindHold(
    fireBtn,
    () => {
      input.fire = true;
      firePlayer();
    },
    () => (input.fire = false)
  );

  pauseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (state.phase === "running") state.phase = "paused";
    else if (state.phase === "paused") state.phase = "running";
  });

  function startFromUI() {
    ensureAudio();
    if (state.phase === "title" || state.phase === "gameOver") resetGame();
  }
  UI.startButton.addEventListener("click", (e) => {
    e.preventDefault();
    startFromUI();
  });
  UI.overlay.addEventListener("click", (e) => {
    if (e.target === UI.startButton) return;
    // allow tap anywhere on overlay
    if (state.phase === "title" || state.phase === "gameOver") startFromUI();
  });

  window.addEventListener("keydown", (e) => {
    ensureAudio();
    if (e.key === "ArrowLeft" || e.key === "a") input.left = true;
    if (e.key === "ArrowRight" || e.key === "d") input.right = true;
    if (e.key === " " || e.key === "ArrowUp") {
      input.fire = true;
      firePlayer();
      e.preventDefault();
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      if (state.phase === "running") state.phase = "paused";
      else if (state.phase === "paused") state.phase = "running";
    }
    if (e.key === "Enter") startFromUI();
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") input.left = false;
    if (e.key === "ArrowRight" || e.key === "d") input.right = false;
    if (e.key === " " || e.key === "ArrowUp") input.fire = false;
  });

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(resize, 100), { passive: true });

  // boot
  resize();
  updateHUD();
  setOverlay("title");
  // attract: static empty field with ground + title handled by overlay
  centerPlayer();
  createAliens();
  buildBunkers();
  // freeze aliens on title (phase title skips update)
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(loop);
  });
})();
