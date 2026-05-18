(function runGame() {
  "use strict";

  const Core = window.CrownlineCore;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dayEl = document.getElementById("day");
  const pauseButton = document.getElementById("pause");
  const menuEl = document.getElementById("menu");
  const resumeButton = document.getElementById("resume");
  const restartButton = document.getElementById("restart");

  const STORAGE_KEY = "crownline-vale-save-v2";
  const KING_SPRITE_SIZE = 48;
  const KING_SPRITE_SCALE = 4;
  const KING_SPRITE_ROOT = "../assets/sprites/king";
  const CLOUD_ROOT = "../assets/sprites/backgrounds/Decoration";
  const input = { left: false, right: false, sprint: false };
  const camera = { x: 0 };
  const view = { width: 1280, height: 720, dpr: 1, ground: 516 };
  const weather = makeWeather();
  const kingSprites = {
    idle: loadSpriteFrames(`${KING_SPRITE_ROOT}/Idle/Knight_idle`, 5),
    walk: loadSpriteFrames(`${KING_SPRITE_ROOT}/Walk/Knight_walk`, 8),
    gallop: loadSpriteFrames(`${KING_SPRITE_ROOT}/Gallop/Knight_gallop`, 5)
  };
  const cloudImages = [
    loadImage(`${CLOUD_ROOT}/Cloud 1.png`),
    loadImage(`${CLOUD_ROOT}/Cloud 2.png`),
    loadImage(`${CLOUD_ROOT}/Cloud 3.png`),
    loadImage(`${CLOUD_ROOT}/Cloud 4.png`),
    loadImage(`${CLOUD_ROOT}/Cloud 5.png`),
    loadImage(`${CLOUD_ROOT}/Cloud 6.png`)
  ];
  let state = loadGame();
  let lastTime = performance.now();
  let saveTimer = 0;

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Core.createInitialState();
      return Core.reviveLoadedState(JSON.parse(raw));
    } catch (_error) {
      return Core.createInitialState();
    }
  }

  function loadSpriteFrames(prefix, count) {
    const frames = [];
    for (let i = 1; i <= count; i += 1) {
      const image = new Image();
      image.decoding = "async";
      image.src = `${prefix}${i}.png`;
      frames.push(image);
    }
    return frames;
  }

  function loadImage(src) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    return image;
  }

  function imageReady(image) {
    return image && image.complete && image.naturalWidth > 0;
  }

  function framesReady(frames) {
    return frames.length > 0 && frames.every((frame) => frame.complete && frame.naturalWidth > 0);
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Core.serializableState(state)));
  }

  function restartGame() {
    state = Core.createInitialState(Date.now() >>> 0);
    camera.x = state.player.x;
    menuEl.hidden = true;
    state.paused = false;
    localStorage.removeItem(STORAGE_KEY);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    view.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    view.width = Math.max(320, Math.floor(bounds.width));
    view.height = Math.max(320, Math.floor(bounds.height));
    canvas.width = Math.floor(view.width * view.dpr);
    canvas.height = Math.floor(view.height * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    view.ground = Math.round(view.height * 0.72);
  }

  function makeWeather() {
    const clouds = [];
    for (let i = 0; i < 16; i += 1) {
      clouds.push({
        x: i * 230 + Math.sin(i * 13.7) * 90,
        y: 58 + (i % 5) * 22,
        size: 0.7 + (i % 4) * 0.16,
        speed: 5 + (i % 4) * 1.8
      });
    }
    const dust = [];
    for (let i = 0; i < 70; i += 1) {
      dust.push({
        x: Math.sin(i * 99.9) * 2600,
        y: Math.sin(i * 31.3) * 20,
        r: 0.8 + (i % 3) * 0.5
      });
    }
    return { clouds, dust };
  }

  function setPaused(paused) {
    state.paused = paused;
    menuEl.hidden = !paused;
    pauseButton.classList.toggle("play", paused);
  }

  function setKey(event, pressed) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") input.left = pressed;
    if (key === "arrowright" || key === "d") input.right = pressed;
    if (key === "shift") input.sprint = pressed;
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", "shift", "p", "escape"].includes(key)) {
      event.preventDefault();
    }
    setKey(event, true);
    if (event.repeat) return;
    if (key === "p" || key === "escape") setPaused(!state.paused);
  });

  window.addEventListener("keyup", (event) => {
    setKey(event, false);
  });

  window.addEventListener("blur", () => {
    input.left = false;
    input.right = false;
    input.sprint = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    const x = event.clientX / Math.max(1, window.innerWidth);
    if (x < 0.42) {
      input.left = true;
      input.right = false;
    } else if (x > 0.58) {
      input.right = true;
      input.left = false;
    }
  });

  window.addEventListener("pointerup", () => {
    input.left = false;
    input.right = false;
  });

  pauseButton.addEventListener("click", () => setPaused(!state.paused));
  resumeButton.addEventListener("click", () => setPaused(false));
  restartButton.addEventListener("click", restartGame);
  window.addEventListener("resize", resize);

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function colorMix(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return `rgb(${Math.round(mix(ca.r, cb.r, t))}, ${Math.round(mix(ca.g, cb.g, t))}, ${Math.round(mix(ca.b, cb.b, t))})`;
  }

  function daylight() {
    const local = state.time % Core.DAY_LENGTH;
    if (local < Core.NIGHT_START - 10) return 1;
    if (local < Core.NIGHT_START) return 1 - (local - (Core.NIGHT_START - 10)) / 10;
    if (local > Core.DAY_LENGTH - 10) return (local - (Core.DAY_LENGTH - 10)) / 10;
    return 0;
  }

  function screenX(worldX, parallax) {
    const factor = parallax == null ? 1 : parallax;
    return view.width / 2 + (worldX - camera.x * factor);
  }

  function drawSky(light) {
    const top = colorMix("#101521", "#86b9c6", light);
    const mid = colorMix("#1a1b2f", "#d8b16a", light * 0.55);
    const low = colorMix("#252438", "#8da49c", light);
    const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.52, mid);
    gradient.addColorStop(1, low);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);

    const local = state.time % Core.DAY_LENGTH;
    const orbit = local / Core.DAY_LENGTH;
    const sunX = view.width * (0.08 + orbit * 0.84);
    const sunY = view.ground * (0.34 - Math.sin(orbit * Math.PI) * 0.23);
    ctx.save();
    ctx.globalAlpha = light;
    ctx.fillStyle = "#ffe6a2";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 1 - light;
    ctx.fillStyle = "#d9e8ff";
    ctx.beginPath();
    ctx.arc(view.width - sunX, 78 + Math.sin(orbit * Math.PI) * 80, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(16, 21, 33, 0.7)";
    ctx.beginPath();
    ctx.arc(view.width - sunX - 10, 70 + Math.sin(orbit * Math.PI) * 80, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawClouds(light) {
    const readyClouds = cloudImages.filter(imageReady);
    if (readyClouds.length) {
      ctx.save();
      ctx.globalAlpha = 0.22 + light * 0.5;
      for (let i = 0; i < weather.clouds.length; i += 1) {
        const cloud = weather.clouds[i];
        const image = readyClouds[i % readyClouds.length];
        const scale = (2.1 + (i % 4) * 0.26) * cloud.size;
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const x = ((cloud.x + state.time * cloud.speed - camera.x * 0.08) % (view.width + width + 240)) - width - 80;
        const y = cloud.y * 0.8 + (i % 3) * 11;
        ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.18 + light * 0.42;
    ctx.fillStyle = "#f4ead1";
    for (const cloud of weather.clouds) {
      const x = ((cloud.x + state.time * cloud.speed - camera.x * 0.09) % (view.width + 260)) - 130;
      const y = cloud.y;
      const s = cloud.size;
      ctx.beginPath();
      ctx.ellipse(x, y, 56 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 34 * s, y + 5 * s, 28 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 38 * s, y + 4 * s, 34 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMountains(light) {
    drawRidge(0.13, view.ground - 180, colorMix("#22283a", "#697d80", light), 230, 116);
    drawRidge(0.2, view.ground - 116, colorMix("#263143", "#6f735c", light), 180, 92);
  }

  function drawRidge(parallax, baseY, color, spacing, height) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, view.ground);
    const start = -spacing * 2;
    const end = view.width + spacing * 2;
    for (let sx = start; sx <= end; sx += spacing) {
      const world = sx + camera.x * parallax;
      const peak = baseY - height * (0.72 + Math.abs(Math.sin(world * 0.004)) * 0.45);
      ctx.lineTo(sx, baseY);
      ctx.lineTo(sx + spacing * 0.5, peak);
      ctx.lineTo(sx + spacing, baseY);
    }
    ctx.lineTo(view.width, view.ground);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(light) {
    ctx.fillStyle = colorMix("#5c3a1f", "#9b6b35", light);
    ctx.fillRect(0, Math.round(view.ground), view.width, 5);
  }

  function drawDust(light) {
    ctx.save();
    ctx.globalAlpha = 0.12 + light * 0.08;
    ctx.fillStyle = "#f5d18a";
    for (const speck of weather.dust) {
      const x = screenX(speck.x, 0.92);
      if (x < -20 || x > view.width + 20) continue;
      ctx.beginPath();
      ctx.arc(x, view.ground - 22 + speck.y + Math.sin(state.time + speck.x) * 3, speck.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function pixelRect(unit, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * unit), Math.round(y * unit), Math.round(width * unit), Math.round(height * unit));
  }

  function pixelLine(unit, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.round((width || 1) * unit));
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(Math.round(x1 * unit), Math.round(y1 * unit));
    ctx.lineTo(Math.round(x2 * unit), Math.round(y2 * unit));
    ctx.stroke();
  }

  function drawPlayer(light) {
    if (drawSpritePlayer()) return;
    drawFallbackPlayer(light);
  }

  function drawSpritePlayer() {
    const p = state.player;
    const moving = Math.abs(p.vx) > 1;
    const galloping = Math.abs(p.vx) > 230;
    const animation = galloping ? "gallop" : moving ? "walk" : "idle";
    const frames = kingSprites[animation];
    if (!framesReady(frames)) return false;

    const frameRate = galloping ? 12 : moving ? 10 : 5;
    const frame = frames[Math.floor(state.time * frameRate) % frames.length];
    const x = screenX(p.x);
    const y = view.ground;
    const facing = p.facing || 1;
    const size = KING_SPRITE_SIZE * KING_SPRITE_SCALE;
    const bob = Math.sin(state.time * (moving ? 11 : 3.5)) * (moving ? 3 : 1);

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));

    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#050507";
    ctx.beginPath();
    ctx.ellipse(4, 6, 70, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.imageSmoothingEnabled = false;
    ctx.scale(facing, 1);
    ctx.drawImage(
      frame,
      0,
      0,
      KING_SPRITE_SIZE,
      KING_SPRITE_SIZE,
      -size / 2,
      -size + 24,
      size,
      size
    );
    ctx.restore();

    drawStamina(x, y);
    return true;
  }

  function drawFallbackPlayer(light) {
    const p = state.player;
    const x = screenX(p.x);
    const y = view.ground;
    const facing = p.facing || 1;
    const moving = Math.abs(p.vx) > 1;
    const gallop = moving ? state.time * 13 : state.time * 3.4;
    const bob = Math.sin(gallop) * (moving ? 4 : 1.2);
    const unit = 4;
    const horse = colorMix("#2f211b", "#81583a", light);
    const horseDark = colorMix("#17100d", "#3d291d", light);
    const leather = colorMix("#2d1b13", "#704225", light);
    const gold = "#f0c766";
    const robe = colorMix("#641f36", "#b53f54", light);
    const robeDark = colorMix("#2f1424", "#742a3b", light);
    const skin = colorMix("#b6784f", "#f1bf8d", light);
    const beard = colorMix("#31241c", "#6a4a34", light);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(facing, 1);

    pixelRect(unit, -16, -1, 32, 2, "rgba(0, 0, 0, 0.28)");

    pixelRect(unit, -17, -15, 5, 4, horseDark);
    pixelRect(unit, -18, -14, 4, 3, horseDark);
    pixelRect(unit, -12, -16, 22, 9, horse);
    pixelRect(unit, -15, -14, 27, 7, horse);
    pixelRect(unit, 8, -18, 6, 9, horse);
    pixelRect(unit, 13, -20, 9, 5, horse);
    pixelRect(unit, 20, -22, 2, 3, horseDark);
    pixelRect(unit, 12, -22, 3, 6, horseDark);
    pixelRect(unit, 17, -18, 1, 1, "#101015");
    pixelRect(unit, 14, -14, 8, 2, leather);

    pixelRect(unit, -9, -18, 15, 5, colorMix("#1f2634", "#536d7b", light));
    pixelRect(unit, -8, -13, 14, 2, colorMix("#111821", "#293a45", light));
    pixelRect(unit, -8, -12, 14, 1, gold);
    pixelRect(unit, -6, -17, 8, 2, leather);

    for (const leg of [-10, -4, 5, 11]) {
      const phase = gallop + leg * 0.24;
      const knee = Math.round(Math.sin(phase) * (moving ? 2 : 0.5));
      const foot = Math.round(Math.cos(phase) * (moving ? 2 : 0.5));
      pixelRect(unit, leg, -8, 2, 5, horseDark);
      pixelRect(unit, leg + knee, -4, 2, 4, horseDark);
      pixelRect(unit, leg + foot - 1, 0, 4, 1, "#0e0b09");
    }

    pixelRect(unit, -11, -25, 8, 12, robeDark);
    pixelRect(unit, -13, -22, 5, 9, robeDark);
    pixelRect(unit, -7, -28, 9, 12, robe);
    pixelRect(unit, -6, -18, 9, 2, robeDark);
    pixelRect(unit, -8, -19, 11, 1, gold);
    pixelRect(unit, 1, -25, 7, 2, robeDark);

    pixelLine(unit, 7, -24, 17, -16, leather, 0.45);
    pixelLine(unit, 17, -16, 21, -17, leather, 0.45);

    pixelRect(unit, -5, -34, 7, 7, skin);
    pixelRect(unit, -5, -33, 7, 2, colorMix("#ead9af", "#fff1c2", light));
    pixelRect(unit, -3, -28, 6, 3, beard);
    pixelRect(unit, 1, -32, 1, 1, "#101015");
    pixelRect(unit, -4, -37, 8, 2, gold);
    pixelRect(unit, -5, -39, 2, 3, gold);
    pixelRect(unit, -1, -40, 2, 4, gold);
    pixelRect(unit, 3, -39, 2, 3, gold);
    pixelRect(unit, -2, -37, 2, 1, "#fff1a8");

    ctx.restore();

    drawStamina(x, y);
  }

  function drawStamina(x, y) {
    const width = 72;
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.fillRect(x - width / 2, y + 16, width, 5);
    ctx.fillStyle = state.player.stamina > 0.25 ? "#e8d39b" : "#b84f52";
    ctx.fillRect(x - width / 2, y + 16, width * state.player.stamina, 5);
    ctx.restore();
  }

  function render() {
    const light = daylight();
    camera.x += (state.player.x - camera.x) * 0.085;
    camera.x = Core.clamp(camera.x, Core.WORLD_MIN + view.width / 2, Core.WORLD_MAX - view.width / 2);

    drawSky(light);
    drawClouds(light);
    drawMountains(light);
    drawGround(light);
    drawDust(light);
    drawPlayer(light);

    if (state.phase === "night") {
      ctx.fillStyle = "rgba(18, 17, 41, 0.18)";
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  function syncHud() {
    dayEl.textContent = String(state.day);
  }

  function frame(now) {
    const dt = Math.min(0.08, (now - lastTime) / 1000 || 0);
    lastTime = now;

    Core.update(state, input, dt);
    render();
    syncHud();

    saveTimer += dt;
    if (saveTimer >= 2.5) {
      saveTimer = 0;
      saveGame();
    }

    requestAnimationFrame(frame);
  }

  resize();
  camera.x = state.player.x;
  syncHud();
  requestAnimationFrame(frame);
})();
