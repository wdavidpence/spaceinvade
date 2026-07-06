(() => {
  const WORLD = { width: 480, height: 800 };
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

  const config = {
    rows: 5,
    cols: 11,
    alienW: 28,
    alienH: 18,
    alienGapX: 36,
    alienGapY: 34,
    alienStartX: 24,
    alienStartY: 90,
    alienPoints: [30, 20, 20, 10, 10],
    playerW: 46,
    playerH: 18,
    playerY: WORLD.height - 78,
    playerSpeed: 340,
    shotSpeed: 520,
    alienShotSpeed: 320,
    maxPlayerShots: 1,
    playerShotCooldown: 0.20,
    leftBound: 16,
    rightBound: WORLD.width - 16,
    maxAlienShots: 3,
    baseAlienSpeed: 36,
    speedGrowth: 2.0,
    dropPixels: 16,
    bunkerCount: 4,
    bunkerWidth: 78,
    bunkerHeight: 43,
    bunkerY: WORLD.height - 270,
    bunkerSpacing: 102,
    blockSize: 6,
    ufoValue: [50, 100, 150, 300],
    ufoSpeed: 90,
    ufoY: 52,
    ufoCooldownMin: 6,
    ufoCooldownMax: 12,
    readyCountdownSeconds: 0.9,
  };

  const state = {
    phase: "title",
    score: 0,
    best: Number(localStorage.getItem("space-invaders-best") || 0),
    level: 1,
    lives: 3,
    player: null,
    aliens: [],
    bullets: [],
    alienBullets: [],
    bunkers: [],
    stars: [],
    explosions: [],
    ufo: null,
    alienDir: 1,
    alienSpeed: config.baseAlienSpeed,
    shotCooldown: 0,
    alienMoveTimer: 0,
    alienFireTimer: 0,
    readyTimer: 0,
    spawnUfoTimer: 0,
  };

  const input = {
    left: false,
    right: false,
    fire: false,
    paused: false,
  };

  let worldScale = 1;
  let lastTime = 0;
  let audioCtx = null;
  let alienMoveSound = true;
  let pixelRatio = 1;

  const starCount = 64;

  function setOverlay(phase) {
    if (phase === "title") {
      UI.overlayTitle.textContent = "Space Invaders";
      UI.overlayBody.textContent =
        "Tap start to begin. Move with < and > , tap FIRE to shoot, Pause to pause. Esc or P on keyboard.";
      UI.startButton.textContent = "Tap to Start";
      UI.overlay.classList.remove("hidden");
    } else if (phase === "gameOver") {
      UI.overlayTitle.textContent = "Game Over";
      UI.overlayBody.textContent = `Final score: ${state.score}`;
      UI.startButton.textContent = "Restart";
      UI.overlay.classList.remove("hidden");
    } else if (phase === "ready") {
      UI.overlay.classList.add("hidden");
    } else {
      UI.overlay.classList.add("hidden");
    }
  }

  function updateHUD() {
    UI.score.textContent = String(state.score);
    UI.best.textContent = String(state.best);
    UI.level.textContent = String(state.level);
    UI.lives.textContent = String(state.lives);
  }

  function ensureAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function tone(freq, duration = 0.1, type = "square", volume = 0.04, start = 0, stop = 0.001) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + stop);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + stop);
  }

  function playSfx(kind) {
    if (!audioCtx) return;
    if (kind === "shoot") tone(760, 0.06, "triangle", 0.03);
    if (kind === "alienMove") {
      const f = alienMoveSound ? 760 : 540;
      tone(f, 0.04, "square", 0.01);
      alienMoveSound = !alienMoveSound;
    }
    if (kind === "alienExplode") tone(140, 0.12, "sawtooth", 0.05);
    if (kind === "playerExplode") {
      tone(100, 0.18, "triangle", 0.06, 0, 0.02);
      tone(80, 0.22, "sawtooth", 0.06, 0.03, 0.04);
    }
    if (kind === "ufo") tone(620, 0.08, "triangle", 0.03);
    if (kind === "start") {
      tone(400, 0.1, "sawtooth", 0.04, 0, 0.002);
      tone(640, 0.1, "triangle", 0.04, 0.08, 0.004);
    }
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    pixelRatio = dpr;
    const controls = 150;
    const availW = Math.min(window.innerWidth - 16, 520);
    const availH = Math.max(360, window.innerHeight - controls);
    worldScale = Math.min(availW / WORLD.width, availH / WORLD.height, 1.2);
    const w = WORLD.width * worldScale;
    const h = WORLD.height * worldScale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function seedStars() {
    state.stars = [];
    for (let i = 0; i < starCount; i++) {
      state.stars.push({
        x: Math.random() * WORLD.width,
        y: Math.random() * WORLD.height,
        r: Math.random() * 1.8 + 0.5,
        s: Math.random() * 30 + 12,
      });
    }
  }

  function centerPlayer() {
    state.player = {
      x: WORLD.width / 2 - config.playerW / 2,
      y: config.playerY,
      w: config.playerW,
      h: config.playerH,
      invulnerable: 0,
    };
  }

  function createAliens() {
    state.aliens = [];
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        state.aliens.push({
          row,
          col,
          x: config.alienStartX + col * config.alienGapX,
          y: config.alienStartY + row * config.alienGapY,
          w: config.alienW,
          h: config.alienH,
          alive: true,
          score: config.alienPoints[row],
          frame: 0,
          anim: 0,
        });
      }
    }
    state.alienDir = 1;
    state.alienSpeed = config.baseAlienSpeed + (state.level - 1) * config.speedGrowth;
    state.alienFireTimer = 1.0;
  }

  function buildBunkers() {
    state.bunkers = [];
    const shape = [
      "000000000000",
      "011111111110",
      "111111111111",
      "111111111111",
      "111111111111",
      "110000001111",
      "110000001111",
    ];
    const bW = shape[0].length * config.blockSize;
    const baseStart = (WORLD.width - (config.bunkerCount * config.bunkerWidth + (config.bunkerCount - 1) * 8)) / 2;

    for (let b = 0; b < config.bunkerCount; b++) {
      const originX = baseStart + b * (config.bunkerWidth + 8);
      const blocks = [];
      for (let r = 0; r < shape.length; r++) {
        const line = shape[r];
        for (let c = 0; c < line.length; c++) {
          if (line[c] === "1") {
            blocks.push({
              x: originX + c * config.blockSize,
              y: config.bunkerY + r * config.blockSize,
              w: config.blockSize - 1,
              h: config.blockSize - 1,
              hp: 2,
            });
          }
        }
      }
      state.bunkers.push(blocks);
    }
  }

  function rectsIntersect(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function spawnPlayerShot() {
    if (state.phase !== "running") return;
    if (state.bullets.filter((b) => b.alive).length >= config.maxPlayerShots) return;
    if (state.shotCooldown > 0) return;
    if (!state.player) return;
    state.bullets.push({
      x: state.player.x + state.player.w / 2 - 1.5,
      y: state.player.y - 16,
      w: 3,
      h: 12,
      v: -config.shotSpeed,
      owner: "player",
      alive: true,
    });
    state.shotCooldown = config.playerShotCooldown;
    playSfx("shoot");
  }

  function spawnAlienShot() {
    const alive = state.aliens.filter((a) => a.alive);
    if (!alive.length || state.alienBullets.length >= config.maxAlienShots) return;
    const byCol = new Map();
    for (const alien of alive) {
      const arr = byCol.get(alien.col) || [];
      arr.push(alien);
      byCol.set(alien.col, arr);
    }
    const columns = Array.from(byCol.keys());
    const chosen = columns[Math.floor(Math.random() * columns.length)];
    const columnAliens = byCol.get(chosen);
    columnAliens.sort((a, b) => b.y - a.y);
    const shooter = columnAliens[0];
    state.alienBullets.push({
      x: shooter.x + shooter.w / 2 - 1.5,
      y: shooter.y + shooter.h + 2,
      w: 3,
      h: 10,
      v: config.alienShotSpeed,
      alive: true,
    });
  }

  function explode(x, y, c = "rgba(200,255,140,0.8)") {
    for (let i = 0; i < 14; i++) {
      state.explosions.push({
        x: x + Math.random() * 2,
        y: y + Math.random() * 2,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 220,
        life: 0.35,
        age: 0,
        color: c,
      });
    }
  }

  function spawnUfoIfNeeded(dt) {
    if (state.ufo) return;
    state.spawnUfoTimer -= dt;
    if (state.spawnUfoTimer > 0) return;
    const shouldSpawn = Math.random() < 0.45;
    if (shouldSpawn) {
      const fromLeft = Math.random() < 0.5;
      state.ufo = {
        x: fromLeft ? -55 : WORLD.width + 55,
        y: config.ufoY,
        w: 50,
        h: 20,
        v: fromLeft ? config.ufoSpeed : -config.ufoSpeed,
        value: config.ufoValue[Math.floor(Math.random() * config.ufoValue.length)],
      };
      playSfx("ufo");
    }
    state.spawnUfoTimer = shouldSpawn
      ? config.ufoCooldownMin + Math.random() * config.ufoCooldownMax
      : 2.2 + Math.random() * 1.8;
  }

  function updateAliens(dt) {
    const alive = state.aliens.filter((a) => a.alive);
    if (!alive.length) return;
    state.alienSpeed = config.baseAlienSpeed + (state.level - 1) * config.speedGrowth;
    state.alienSpeed += (config.rows * config.cols - alive.length) * 0.55;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const a of alive) {
      minX = Math.min(minX, a.x);
      maxX = Math.max(maxX, a.x + a.w);
      minY = Math.min(minY, a.y);
      maxY = Math.max(maxY, a.y + a.h);
    }

    const move = state.alienSpeed * dt * state.alienDir;
    let drop = false;
    if (minX + move < config.leftBound || maxX + move > config.rightBound) {
      state.alienDir *= -1;
      drop = true;
    }

    if (drop) {
      for (const a of state.aliens) {
        if (!a.alive) continue;
        a.y += config.dropPixels;
      }
      playSfx("alienMove");
      state.alienMoveTimer = 0;
    } else {
      for (const a of state.aliens) {
        if (!a.alive) continue;
        a.x += move;
        a.anim += dt;
        a.frame = Math.floor(a.anim * 4) % 2;
      }
      state.alienMoveTimer += dt;
      if (state.alienMoveTimer > 0.12) {
        playSfx("alienMove");
        state.alienMoveTimer = 0;
      }
    }

    state.alienFireTimer -= dt;
    if (state.alienFireTimer <= 0) {
      const pace = Math.max(0.18, 1.6 - state.level * 0.13 - alive.length / 220);
      if (Math.random() < 0.65) spawnAlienShot();
      state.alienFireTimer = pace;
    }

    if (maxY >= state.player.y - 16) {
      endGame();
    }
  }

  function updateBullets(dt) {
    const removeDead = (item) => item.alive && item.y + item.h >= 0 && item.y <= WORLD.height;

    for (const b of state.bullets) {
      b.y += b.v * dt;
      if (state.phase !== "running") continue;
      if (b.owner === "player") {
        let hit = false;
        for (const a of state.aliens) {
          if (!a.alive || hit) continue;
          if (rectsIntersect(b, a)) {
            a.alive = false;
            b.alive = false;
            hit = true;
            const px = a.x + a.w / 2;
            const py = a.y + a.h / 2;
            state.score += a.score;
            explode(px, py, "rgba(130,255,120,0.9)");
            playSfx("alienExplode");
            updateHUD();
            state.best = Math.max(state.score, state.best);
            localStorage.setItem("space-invaders-best", String(state.best));
          }
        }
        if (!hit && state.ufo && rectsIntersect(b, state.ufo)) {
          b.alive = false;
          state.score += state.ufo.value;
          state.ufo = null;
          explode(state.player.x, config.ufoY + 8, "rgba(180,190,255,0.85)");
          playSfx("alienExplode");
          updateHUD();
          state.best = Math.max(state.score, state.best);
          localStorage.setItem("space-invaders-best", String(state.best));
        }
      }

      if (!b.alive) {
        continue;
      }
      for (const bunker of state.bunkers) {
        for (const p of bunker) {
          if (p.hp <= 0 || !rectsIntersect(b, p)) continue;
          b.alive = false;
          p.hp -= 1;
          if (p.hp <= 0) p.broken = true;
          break;
        }
        if (!b.alive) break;
      }
    }

    for (const b of state.alienBullets) {
      b.y += b.v * dt;
      if (b.owner === "alien" || state.phase !== "running") {
        // no extra logic
      }
      if (!state.player || b.y > WORLD.height + 4) continue;
      if (state.player.invulnerable <= 0 && rectsIntersect(b, state.player)) {
        b.alive = false;
        state.lives -= 1;
        state.player.invulnerable = 1.3;
        explode(state.player.x + state.player.w / 2, state.player.y, "rgba(255,120,100,0.8)");
        playSfx("playerExplode");
        if (state.lives <= 0) {
          endGame();
        } else {
          updateHUD();
        }
      }
      if (!b.alive) continue;
      for (const bunker of state.bunkers) {
        for (const p of bunker) {
          if (p.hp <= 0 || !rectsIntersect(b, p)) continue;
          b.alive = false;
          p.hp -= 1;
          if (p.hp <= 0) p.broken = true;
          break;
        }
        if (!b.alive) break;
      }
    }

    state.bullets = state.bullets.filter((b) => {
      b.alive = removeDead(b);
      return b.alive;
    });
    state.alienBullets = state.alienBullets.filter((b) => {
      b.alive = removeDead(b);
      return b.alive;
    });
  }

  function updateExplosions(dt) {
    const next = [];
    for (const p of state.explosions) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.age < p.life) next.push(p);
    }
    state.explosions = next;
  }

  function cleanupBunkers() {
    for (const bunker of state.bunkers) {
      for (let i = bunker.length - 1; i >= 0; i--) {
        if (bunker[i].hp <= 0) bunker.splice(i, 1);
      }
    }
  }

  function startNewWave() {
    createAliens();
    buildBunkers();
    state.bullets = [];
    state.alienBullets = [];
    state.explosions = [];
    state.spawnUfoTimer = config.ufoCooldownMin + Math.random() * config.ufoCooldownMax;
    state.shotCooldown = 0;
    state.alienMoveTimer = 0;
    state.alienFireTimer = 1.0;
    if (state.lives < 3 && state.level > 1) state.lives += 1;
    if (state.phase !== "title") state.readyTimer = 0;
    state.phase = "ready";
    UI.startButton.textContent = "Ready";
    updateHUD();
    if (state.level > 1) {
      UI.overlayTitle.textContent = "Wave Cleared";
      UI.overlayBody.textContent = `Next wave in ${config.readyCountdownSeconds.toFixed(1)}s`;
      UI.overlay.classList.remove("hidden");
      state.readyTimer = config.readyCountdownSeconds;
    } else {
      state.phase = "running";
      UI.overlay.classList.add("hidden");
    }
  }

  function endGame() {
    state.phase = "gameOver";
    UI.score.textContent = String(state.score);
    setOverlay("gameOver");
    state.best = Math.max(state.best, state.score);
    localStorage.setItem("space-invaders-best", String(state.best));
    updateHUD();
  }

  function startGame() {
    if (state.phase === "running" || state.phase === "paused") return;
    ensureAudio();
    playSfx("start");
    state.score = 0;
    state.level = 1;
    state.lives = 3;
    centerPlayer();
    startNewWave();
    state.phase = "ready";
    UI.startButton.textContent = "Start";
    setOverlay("ready");
  }

  function nextWave() {
    const alive = state.aliens.filter((a) => a.alive);
    if (alive.length === 0) {
      state.level += 1;
      centerPlayer();
      startNewWave();
      state.phase = "running";
      UI.overlay.classList.add("hidden");
    }
  }

  function update(dt) {
    if (state.phase === "paused") return;
    if (state.phase !== "running" && state.phase !== "ready") {
      return;
    }
    if (state.phase === "ready") {
      state.readyTimer = Math.max(0, state.readyTimer - dt);
      if (state.readyTimer <= 0) {
        state.phase = "running";
        UI.overlay.classList.add("hidden");
      } else {
        UI.overlayBody.textContent = `Next wave in ${state.readyTimer.toFixed(1)}s`;
        return;
      }
    }

    if (!state.player) centerPlayer();
    state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);

    if (input.left && !input.right) state.player.x -= config.playerSpeed * dt;
    if (input.right && !input.left) state.player.x += config.playerSpeed * dt;
    state.player.x = Math.max(10, Math.min(WORLD.width - state.player.w - 10, state.player.x));

    state.shotCooldown = Math.max(0, state.shotCooldown - dt);
    if (input.fire) {
      spawnPlayerShot();
    }

    for (const s of state.stars) {
      s.y += dt * s.s;
      if (s.y > WORLD.height) {
        s.y = 0;
        s.x = Math.random() * WORLD.width;
      }
    }

    updateAliens(dt);
    updateBullets(dt);
    updateExplosions(dt);
    spawnUfoIfNeeded(dt);
    cleanupBunkers();
    nextWave();
    if (state.phase === "running") {
      for (const b of state.bullets) {
        if (b.y < -20 || b.y > WORLD.height + 20) b.alive = false;
      }
      for (const b of state.alienBullets) {
        if (b.y < -20 || b.y > WORLD.height + 20) b.alive = false;
      }
    }

    if (state.ufo) {
      state.ufo.x += state.ufo.v * dt;
      if (state.ufo.v > 0 && state.ufo.x > WORLD.width + 60) state.ufo = null;
      if (state.ufo.v < 0 && state.ufo.x < -80) state.ufo = null;
    }
  }

  function drawInvader(a) {
    if (!a.alive) return;
    const x = a.x;
    const y = a.y;
    const w = a.w;
    const h = a.h;
    const frame = a.frame;

    ctx.strokeStyle = "#94f7b6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.stroke();
    if (frame === 0) {
      ctx.fillStyle = "#8aff98";
      ctx.fillRect(x + 5, y + 4, 4, 4);
      ctx.fillRect(x + 19, y + 4, 4, 4);
      ctx.fillRect(x + 9, y + 10, 10, 6);
    } else {
      ctx.fillStyle = "#6fd7ff";
      ctx.fillRect(x + 8, y + 3, 3, 12);
      ctx.fillRect(x + 17, y + 3, 3, 12);
      ctx.fillRect(x + 5, y + 12, 18, 3);
    }
  }

  function drawShields() {
    for (const bunker of state.bunkers) {
      for (const p of bunker) {
        if (p.hp <= 0) continue;
        const alpha = 0.4 + p.hp * 0.3;
        ctx.fillStyle = `rgba(130, 180, 80, ${alpha})`;
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
    }
  }

  function drawPlayer() {
    if (!state.player) return;
    const p = state.player;
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0;
    if (blink) {
      ctx.globalAlpha = 0.3;
    }
    ctx.fillStyle = "#6df58d";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#a8ffbf";
    ctx.fillRect(p.x + 1, p.y + 4, p.w - 2, 3);
    ctx.fillRect(p.x + 12, p.y - 3, 8, 6);
    ctx.globalAlpha = 1;
  }

  function drawShots() {
    ctx.fillStyle = "#5ff5ff";
    for (const b of state.bullets) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = "#ff8f9c";
    for (const b of state.alienBullets) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  function drawUFO() {
    if (!state.ufo) return;
    const u = state.ufo;
    ctx.fillStyle = "#ffc24a";
    ctx.fillRect(u.x, u.y, u.w, u.h);
    ctx.fillStyle = "#6f90db";
    ctx.fillRect(u.x + 6, u.y + 5, u.w - 12, 4);
    ctx.fillRect(u.x + 18, u.y + 10, 14, 6);
  }

  function drawExplosions() {
    for (const p of state.explosions) {
      const alpha = 1 - p.age / p.life;
      const c = p.color.slice(0, p.color.lastIndexOf(","));
      ctx.fillStyle = `${c},${Math.max(0.05, alpha).toFixed(2)})`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }

  function drawHUDText() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#f5f9ff";
    ctx.fillText(`SCORE  ${state.score}`, 16, 24);
    ctx.fillText(`BEST  ${state.best}`, WORLD.width - 170, 24);
    ctx.fillText(`WAVE  ${state.level}`, WORLD.width - 170, 44);
    ctx.fillText(`LIVES  ${state.lives}`, WORLD.width - 170, 64);
  }

  function render() {
    ctx.setTransform(pixelRatio * worldScale, 0, 0, pixelRatio * worldScale, 0, 0);
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "rgba(3, 6, 12, 0.6)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    for (const s of state.stars) {
      ctx.fillStyle = s.r > 1.6 ? "#7f9bca" : "#4d6183";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    if (state.phase === "running" || state.phase === "ready") {
      drawShields();
      for (const a of state.aliens) drawInvader(a);
      drawPlayer();
      drawShots();
      drawUFO();
      drawExplosions();
    }
    drawHUDText();

    if (state.phase === "paused") {
      ctx.fillStyle = "rgba(6, 10, 22, 0.65)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.fillStyle = "#fff";
      ctx.font = "32px Arial";
      ctx.fillText("Paused", WORLD.width / 2 - 56, WORLD.height / 2);
    }
  }

  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    update(dt);
    render();
    window.requestAnimationFrame(loop);
  }

  function onPress(btn, value) {
    return () => {
      if (btn === "left") input.left = value;
      if (btn === "right") input.right = value;
      if (btn === "fire") {
        input.fire = value;
        if (value) {
          spawnPlayerShot();
        }
      }
      if (btn === "pause" && value) {
        if (state.phase === "running") {
          state.phase = "paused";
          setOverlay("title");
          UI.overlayTitle.textContent = "Paused";
          UI.overlayBody.textContent = "Game paused. Tap start to continue.";
          UI.startButton.textContent = "Resume";
        } else if (state.phase === "paused") {
          state.phase = "running";
          UI.overlay.classList.add("hidden");
        }
      }
    };
  }

  function bindControls() {
    for (const el of [leftBtn, rightBtn, fireBtn, pauseBtn]) {
      const action = el === leftBtn ? "left" : el === rightBtn ? "right" : el === fireBtn ? "fire" : "pause";
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        ensureAudio();
        onPress(action, true)();
      });
      el.addEventListener("pointerup", (e) => {
        e.preventDefault();
        onPress(action, false)();
      });
      el.addEventListener("pointerleave", (e) => {
        e.preventDefault();
        if (action !== "pause") onPress(action, false)();
      });
      el.addEventListener("pointercancel", (e) => {
        e.preventDefault();
        if (action !== "pause") onPress(action, false)();
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.code === "ArrowLeft") input.left = true;
      if (e.code === "ArrowRight") input.right = true;
      if (e.code === "Space") {
        ensureAudio();
        input.fire = true;
        spawnPlayerShot();
        e.preventDefault();
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        onPress("pause", true)();
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft") input.left = false;
      if (e.code === "ArrowRight") input.right = false;
      if (e.code === "Space") input.fire = false;
    });

    window.addEventListener("resize", resize);
  }

  function bindOverlay() {
    UI.startButton.addEventListener("click", () => {
      ensureAudio();
      if (state.phase === "title" || state.phase === "gameOver") {
        state.phase = "running";
        startGame();
      } else if (state.phase === "ready") {
        state.phase = "running";
        UI.overlay.classList.add("hidden");
      } else if (state.phase === "paused") {
        state.phase = "running";
        UI.overlay.classList.add("hidden");
      }
    });
  }

  function preload() {
    state.best = Number(localStorage.getItem("space-invaders-best") || 0);
    centerPlayer();
    seedStars();
    buildBunkers();
    createAliens();
    state.spawnUfoTimer = 6;
    state.phase = "title";
    setOverlay("title");
    updateHUD();
    resize();
    bindControls();
    bindOverlay();
    window.requestAnimationFrame(loop);
  }

  preload();
})();
