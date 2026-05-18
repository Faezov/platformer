(function runGame() {
  "use strict";

  const Core = window.CrownlineCore;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dayEl = document.getElementById("day");
  const peopleEl = document.getElementById("people");
  const coinsEl = document.getElementById("coins");
  const crownEl = document.getElementById("crown-health");
  const actionEl = document.getElementById("action");
  const actionTitleEl = document.getElementById("action-title");
  const actionCostEl = document.getElementById("action-cost");
  const pauseButton = document.getElementById("pause");
  const soundButton = document.getElementById("sound");
  const menuEl = document.getElementById("menu");
  const endingEl = document.getElementById("ending");
  const scoreLineEl = document.getElementById("score-line");
  const resumeButton = document.getElementById("resume");
  const restartButton = document.getElementById("restart");
  const tryAgainButton = document.getElementById("try-again");

  const STORAGE_KEY = "crownline-vale-save-v1";
  const KING_SPRITE_SIZE = 48;
  const KING_SPRITE_SCALE = 4;
  const KING_SPRITE_ROOT = "../assets/sprites/king";
  const SCENERY_ROOT = "../assets/sprites/backgrounds";
  const LAND_ROOT = "../assets/terrain/grassland";
  const LAND_STRIP_SCALE = 2;
  const LAND_SURFACE_SOURCE_Y = 28;
  const LAND_LARGE_TARGET_HEIGHT = 300;
  const LAND_LARGE_SOURCE_TOP_RATIO = 0.145;
  const LAND_LARGE_SURFACE_RATIO = 0.3;
  const LAND_LARGE_SOURCE_BOTTOM_RATIO = 0.92;
  const RIVER_REFLECTION_SOURCE_HEIGHT = 270;
  const RIVER_REFLECTION_SLICE_HEIGHT = 4;
  const USE_ASSET_SKY = false;
  const USE_ASSET_MOUNTAINS = false;
  const USE_ASSET_TERRAIN = false;
  const USE_ASSET_PROPS = false;
  const USE_CUSTOM_LAND_ASSET = true;
  const USE_REFLECTIVE_RIVER = true;
  const TERRAIN_FOCUS_MODE = true;
  const input = { left: false, right: false, sprint: false };
  const camera = { x: 0 };
  const view = { width: 1280, height: 720, dpr: 1, ground: 516 };
  const riverReflection = {
    canvas: document.createElement("canvas"),
    ctx: null
  };
  riverReflection.ctx = riverReflection.canvas.getContext("2d");
  const weather = makeWeather();
  const kingSprites = {
    idle: loadSpriteFrames(`${KING_SPRITE_ROOT}/Idle/Knight_idle`, 5),
    walk: loadSpriteFrames(`${KING_SPRITE_ROOT}/Walk/Knight_walk`, 8),
    gallop: loadSpriteFrames(`${KING_SPRITE_ROOT}/Gallop/Knight_gallop`, 5)
  };
  const scenery = {
    sky: loadImage(`${SCENERY_ROOT}/Backgrounds/Sky.png`),
    redSky: loadImage(`${SCENERY_ROOT}/Backgrounds/Red Sky.png`),
    mountains: [
      loadImage(`${SCENERY_ROOT}/Backgrounds/Mountains 1.png`),
      loadImage(`${SCENERY_ROOT}/Backgrounds/Mountains 2.png`),
      loadImage(`${SCENERY_ROOT}/Backgrounds/Mountains 3.png`),
      loadImage(`${SCENERY_ROOT}/Backgrounds/Mountains 4.png`)
    ],
    tiles: loadImage(`${SCENERY_ROOT}/Tiles/Pixel Art Tiles and Backgrounds - Mountains.png`),
    props: {
      barrel: loadImage(`${SCENERY_ROOT}/Decoration/Barrel.png`),
      fence1: loadImage(`${SCENERY_ROOT}/Decoration/Fence 1.png`),
      fence2: loadImage(`${SCENERY_ROOT}/Decoration/Fence 2.png`),
      grass1: loadImage(`${SCENERY_ROOT}/Decoration/Grass 1.png`),
      grass2: loadImage(`${SCENERY_ROOT}/Decoration/Grass 2.png`),
      grass3: loadImage(`${SCENERY_ROOT}/Decoration/Grass 3.png`),
      grass4: loadImage(`${SCENERY_ROOT}/Decoration/Grass 4.png`),
      house: loadImage(`${SCENERY_ROOT}/Decoration/House.png`),
      laundry: loadImage(`${SCENERY_ROOT}/Decoration/Laundry.png`),
      rock1: loadImage(`${SCENERY_ROOT}/Decoration/Rock 1.png`),
      rock2: loadImage(`${SCENERY_ROOT}/Decoration/Rock 2.png`),
      rock3: loadImage(`${SCENERY_ROOT}/Decoration/Rock 3.png`),
      rock4: loadImage(`${SCENERY_ROOT}/Decoration/Rock 4.png`),
      rock5: loadImage(`${SCENERY_ROOT}/Decoration/Rock 5.png`),
      stackedRocks: loadImage(`${SCENERY_ROOT}/Decoration/Stacked Rocks.png`),
      torch: loadImage(`${SCENERY_ROOT}/Decoration/Standing Torch.png`),
      tree1: loadImage(`${SCENERY_ROOT}/Decoration/Tree 1.png`),
      tree2: loadImage(`${SCENERY_ROOT}/Decoration/Tree 2.png`),
      tree3: loadImage(`${SCENERY_ROOT}/Decoration/Tree 3.png`),
      shed: loadImage(`${SCENERY_ROOT}/Decoration/Wooden Shed.png`)
    },
    clouds: [
      loadImage(`${SCENERY_ROOT}/Decoration/Cloud 1.png`),
      loadImage(`${SCENERY_ROOT}/Decoration/Cloud 2.png`),
      loadImage(`${SCENERY_ROOT}/Decoration/Cloud 3.png`),
      loadImage(`${SCENERY_ROOT}/Decoration/Cloud 4.png`),
      loadImage(`${SCENERY_ROOT}/Decoration/Cloud 5.png`),
      loadImage(`${SCENERY_ROOT}/Decoration/Cloud 6.png`)
    ]
  };
  const landAssets = {
    strip: loadImage(`${LAND_ROOT}/land-strip.png`),
    prepared: null,
    preparedKey: ""
  };
  const terrainDecorations = makeTerrainDecorations();
  let audio = null;
  let muted = localStorage.getItem("crownline-vale-muted") === "true";
  let state = loadGame();
  let lastTime = performance.now();
  let saveTimer = 0;

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return prepareGameState(Core.createInitialState());
      return prepareGameState(Core.reviveLoadedState(JSON.parse(raw)));
    } catch (_error) {
      return prepareGameState(Core.createInitialState());
    }
  }

  function prepareGameState(nextState) {
    if (!TERRAIN_FOCUS_MODE) return nextState;
    nextState.structures = [];
    nextState.camps = [];
    nextState.portals = [];
    nextState.citizens = [];
    nextState.enemies = [];
    nextState.drops = [];
    nextState.shots = [];
    nextState.events = [];
    nextState.gameOver = false;
    return nextState;
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

  function makeTerrainDecorations() {
    const props = ["grass1", "grass2", "grass3", "rock2", "grass4", "rock3", "fence1", "grass2", "rock5", "grass1", "stackedRocks", "grass3"];
    const decorations = [];
    for (let x = Core.WORLD_MIN + 260; x <= Core.WORLD_MAX - 260; x += 165) {
      const wobble = Math.sin(x * 0.021) * 58;
      const index = Math.abs(Math.floor((x + 4000) / 165)) % props.length;
      decorations.push({
        key: props[index],
        x: x + wobble,
        scale: 1.7 + (index % 4) * 0.18,
        layer: index % 5 === 0 ? "back" : "front"
      });
    }

    decorations.push(
      { key: "tree1", x: -2180, scale: 1.15, layer: "back" },
      { key: "tree2", x: -1840, scale: 1.05, layer: "back" },
      { key: "shed", x: -1220, scale: 1.4, layer: "back" },
      { key: "house", x: 1220, scale: 1.25, layer: "back" },
      { key: "tree3", x: 1850, scale: 1.25, layer: "back" },
      { key: "tree1", x: 2260, scale: 1.05, layer: "back" },
      { key: "barrel", x: -760, scale: 1.45, layer: "front" },
      { key: "laundry", x: 760, scale: 1.45, layer: "front" },
      { key: "torch", x: -245, scale: 1.25, layer: "front" },
      { key: "torch", x: 245, scale: 1.25, layer: "front" }
    );

    return decorations;
  }

  function saveGame() {
    if (state.gameOver) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Core.serializableState(state)));
  }

  function restartGame() {
    state = prepareGameState(Core.createInitialState(Date.now() >>> 0));
    camera.x = state.player.x;
    endingEl.hidden = true;
    menuEl.hidden = true;
    state.paused = false;
    localStorage.removeItem(STORAGE_KEY);
    if (!TERRAIN_FOCUS_MODE) playSound("build");
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

  function ensureAudio() {
    if (audio || muted) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audio = new AudioContext();
  }

  function playTone(freq, duration, type, gain) {
    if (!audio || muted) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain || 0.04, now + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playSound(kind) {
    if (muted) return;
    ensureAudio();
    if (kind === "coin") playTone(880, 0.12, "triangle", 0.035);
    if (kind === "build") playTone(220, 0.16, "square", 0.025);
    if (kind === "hire") playTone(550, 0.13, "triangle", 0.03);
    if (kind === "wave") playTone(90, 0.28, "sawtooth", 0.028);
    if (kind === "hurt") playTone(120, 0.22, "square", 0.035);
    if (kind === "empty") playTone(160, 0.08, "sine", 0.018);
  }

  function setPaused(paused) {
    state.paused = paused;
    menuEl.hidden = !paused;
    pauseButton.classList.toggle("play", paused);
  }

  function setMuted(value) {
    muted = value;
    soundButton.classList.toggle("muted", muted);
    localStorage.setItem("crownline-vale-muted", String(muted));
    if (muted && audio) {
      audio.suspend();
    } else if (audio) {
      audio.resume();
    }
  }

  function handleAction() {
    if (TERRAIN_FOCUS_MODE) return;
    ensureAudio();
    const beforeEvents = state.events.length;
    const didAct = Core.performAction(state);
    if (!didAct) {
      playSound("empty");
      return;
    }
    const latest = state.events.slice(beforeEvents).at(-1);
    playSound(latest && latest.type === "hire" ? "hire" : "build");
    saveGame();
  }

  function setKey(event, pressed) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") input.left = pressed;
    if (key === "arrowright" || key === "d") input.right = pressed;
    if (key === "shift") input.sprint = pressed;
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", "shift", " ", "e", "enter", "p", "escape"].includes(key)) {
      event.preventDefault();
    }
    setKey(event, true);
    if (event.repeat) return;
    if (key === " " || key === "e" || key === "enter") handleAction();
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
    ensureAudio();
    const x = event.clientX / Math.max(1, window.innerWidth);
    if (x < 0.42) {
      input.left = true;
      input.right = false;
    } else if (x > 0.58) {
      input.right = true;
      input.left = false;
    } else {
      handleAction();
    }
  });

  window.addEventListener("pointerup", () => {
    input.left = false;
    input.right = false;
  });

  pauseButton.addEventListener("click", () => setPaused(!state.paused));
  soundButton.addEventListener("click", () => setMuted(!muted));
  resumeButton.addEventListener("click", () => setPaused(false));
  restartButton.addEventListener("click", restartGame);
  tryAgainButton.addEventListener("click", restartGame);
  window.addEventListener("resize", resize);

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
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

  function drawTiledImage(image, parallax, y, width, height, alpha) {
    if (!imageReady(image)) return false;
    const tileWidth = Math.max(1, Math.round(width));
    const offset = ((camera.x * parallax) % tileWidth + tileWidth) % tileWidth;

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.imageSmoothingEnabled = false;
    for (let x = -offset - tileWidth; x < view.width + tileWidth; x += tileWidth) {
      ctx.drawImage(image, Math.round(x), Math.round(y), tileWidth, Math.round(height));
    }
    ctx.restore();
    return true;
  }

  function drawTiledCrop(image, source, parallax, y, width, height, alpha) {
    if (!imageReady(image)) return false;
    const tileWidth = Math.max(1, Math.round(width));
    const offset = ((camera.x * parallax) % tileWidth + tileWidth) % tileWidth;

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.imageSmoothingEnabled = false;
    for (let x = -offset - tileWidth; x < view.width + tileWidth; x += tileWidth) {
      ctx.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        Math.round(x),
        Math.round(y),
        tileWidth,
        Math.round(height)
      );
    }
    ctx.restore();
    return true;
  }

  function getWaterY() {
    return Math.min(view.height - 68, view.ground + Math.max(44, view.height * 0.065));
  }

  function drawSky(light) {
    if (USE_ASSET_SKY && imageReady(scenery.sky)) {
      const local = state.time % Core.DAY_LENGTH;
      const orbit = local / Core.DAY_LENGTH;
      const sunset = 1 - Math.min(1, Math.abs(local - Core.NIGHT_START) / 15);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scenery.sky, 0, 0, view.width, view.ground + 120);
      if (imageReady(scenery.redSky)) {
        ctx.globalAlpha = Math.max(0, sunset) * 0.32;
        ctx.drawImage(scenery.redSky, 0, 0, view.width, view.ground + 120);
      }
      ctx.restore();

      const sunX = view.width * (0.08 + orbit * 0.84);
      const sunY = view.ground * (0.34 - Math.sin(orbit * Math.PI) * 0.23);
      ctx.save();
      ctx.globalAlpha = light;
      const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 86);
      glow.addColorStop(0, "rgba(255, 245, 180, 0.92)");
      glow.addColorStop(0.45, "rgba(255, 235, 160, 0.3)");
      glow.addColorStop(1, "rgba(255, 235, 160, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
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
      return;
    }

    const top = colorMix("#101521", "#86b9c6", light);
    const mid = colorMix("#1a1b2f", "#d8b16a", light * 0.55);
    const low = colorMix("#252438", "#efd092", light);
    const gradient = ctx.createLinearGradient(0, 0, 0, view.ground);
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
    const readyClouds = scenery.clouds.filter(imageReady);
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
    const readyMountains = scenery.mountains.filter(imageReady);
    if (USE_ASSET_MOUNTAINS && readyMountains.length) {
      const parallax = [0.03, 0.055, 0.085, 0.13];
      const alpha = [0.5, 0.62, 0.72, 0.86];
      for (let i = 0; i < readyMountains.length; i += 1) {
        const image = readyMountains[i];
        const scale = Math.max(view.width / image.naturalWidth, (view.ground + 150) / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const bottom = view.ground + 150 - i * 22;
        drawTiledImage(image, parallax[i] || 0.08, bottom - height, width, height, alpha[i] == null ? 1 : alpha[i]);
      }

      ctx.save();
      ctx.globalAlpha = 0.28 * (1 - light);
      ctx.fillStyle = "#11172a";
      ctx.fillRect(0, 0, view.width, view.ground + 120);
      ctx.restore();
      return;
    }

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

  function drawForest(light) {
    drawTreeLayer(0.34, view.ground - 10, colorMix("#142922", "#314b33", light), 92, 82);
    drawTreeLayer(0.53, view.ground + 6, colorMix("#183426", "#3d5f36", light), 74, 108);
  }

  function treeNoise(value) {
    return Math.sin(value * 12.9898) * 43758.5453 % 1;
  }

  function drawTreeLayer(parallax, baseY, color, spacing, height) {
    ctx.fillStyle = color;
    const left = -spacing;
    const right = view.width + spacing;
    for (let sx = left; sx <= right; sx += spacing) {
      const world = sx + camera.x * parallax;
      const n = Math.abs(treeNoise(Math.floor(world / spacing)));
      const x = sx + n * spacing * 0.42;
      const h = height * (0.78 + n * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, baseY - h);
      ctx.lineTo(x - h * 0.28, baseY);
      ctx.lineTo(x + h * 0.28, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 3, baseY - h * 0.26, 6, h * 0.26);
    }
  }

  function drawGround(light) {
    const waterY = getWaterY();
    if (USE_ASSET_TERRAIN && imageReady(scenery.tiles)) {
      const dirt = colorMix("#1b1612", "#4d3f28", light);
      const shadowDirt = colorMix("#15100e", "#34291e", light);
      ctx.fillStyle = shadowDirt;
      ctx.fillRect(0, view.ground - 18, view.width, waterY - view.ground + 40);
      ctx.fillStyle = dirt;
      ctx.fillRect(0, view.ground + 20, view.width, waterY - view.ground + 20);

      drawTiledCrop(
        scenery.tiles,
        { x: 0, y: 128, width: 256, height: 64 },
        1,
        view.ground - 18,
        512,
        waterY - view.ground + 46,
        1
      );

      ctx.save();
      ctx.globalAlpha = 0.16 + light * 0.16;
      ctx.fillStyle = "#d0b26c";
      for (let x = -40; x < view.width + 40; x += 54) {
        const y = view.ground + 14 + Math.sin((x + camera.x) * 0.025) * 4;
        ctx.fillRect(Math.round(x), Math.round(y), 28, 3);
      }
      ctx.restore();

      drawRiverBase(light, waterY);
      return;
    }

    if (USE_CUSTOM_LAND_ASSET && imageReady(landAssets.strip)) {
      drawGrasslandAsset(light);
      drawRiverBase(light, waterY);
      return;
    }

    const dirt = colorMix("#211811", "#56412c", light);
    const deepDirt = colorMix("#17110d", "#37281d", light);
    const grass = colorMix("#243d22", "#6f8e3e", light);
    const grassLight = colorMix("#5f7b34", "#b6c862", light);
    const grassDark = colorMix("#172816", "#3f5a2c", light);

    ctx.fillStyle = deepDirt;
    ctx.fillRect(0, view.ground + 28, view.width, view.height - view.ground - 28);

    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.moveTo(0, view.ground + 8);
    for (let x = 0; x <= view.width + 24; x += 24) {
      const y = view.ground + 8 + Math.sin((x + camera.x * 0.65) * 0.018) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(view.width, view.height);
    ctx.lineTo(0, view.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = grassDark;
    ctx.fillRect(0, view.ground - 3, view.width, 18);

    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.moveTo(0, view.ground - 10);
    for (let x = 0; x <= view.width + 20; x += 20) {
      const y = view.ground - 10 + Math.sin((x + camera.x) * 0.024) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(view.width, view.ground + 10);
    ctx.lineTo(0, view.ground + 10);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = grassLight;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45 + light * 0.25;
    for (let x = -40; x < view.width + 40; x += 18) {
      const seed = Math.sin((x + camera.x) * 0.11);
      const bladeHeight = 7 + Math.abs(seed) * 10;
      const baseY = view.ground - 7 + Math.sin((x + camera.x) * 0.032) * 3;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + seed * 5, baseY - bladeHeight);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.18 + light * 0.16;
    ctx.fillStyle = "#8a6c43";
    for (let x = -20; x < view.width + 40; x += 38) {
      const y = view.ground + 24 + Math.sin((x + camera.x) * 0.03) * 4;
      ctx.fillRect(Math.round(x), Math.round(y), 17, 3);
    }
    ctx.restore();

    drawRiverBase(light, waterY);
  }

  function drawGrasslandAsset(light) {
    const land = prepareLandStrip();
    if (!land) return;

    const scale = land.scale;
    const tileWidth = land.sourceWidth * scale;
    const tileHeight = land.sourceHeight * scale;
    const y = view.ground - land.surfaceY * scale + 2;
    const offset = ((camera.x) % tileWidth + tileWidth) % tileWidth;

    ctx.fillStyle = colorMix("#17120e", "#312319", light);
    ctx.fillRect(0, y + tileHeight - 8, view.width, Math.max(0, view.height - y - tileHeight + 8));

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let x = -offset - tileWidth; x < view.width + tileWidth; x += tileWidth) {
      ctx.drawImage(
        land.image,
        land.sourceX,
        land.sourceY,
        land.sourceWidth,
        land.sourceHeight,
        Math.round(x),
        Math.round(y),
        Math.round(tileWidth),
        Math.round(tileHeight)
      );
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.06 + (1 - light) * 0.34;
    ctx.fillStyle = "#080c15";
    ctx.fillRect(0, view.ground + 14, view.width, view.height - view.ground - 14);
    ctx.restore();
  }

  function prepareLandStrip() {
    const strip = landAssets.strip;
    if (!imageReady(strip)) return null;

    const key = `${strip.naturalWidth}x${strip.naturalHeight}`;
    if (landAssets.prepared && landAssets.preparedKey === key) return landAssets.prepared;

    const largePaintedStrip = strip.naturalWidth > 900 || strip.naturalHeight > 260;
    const sourceTop = largePaintedStrip ? Math.round(strip.naturalHeight * LAND_LARGE_SOURCE_TOP_RATIO) : 0;
    const sourceBottom = largePaintedStrip ? Math.round(strip.naturalHeight * LAND_LARGE_SOURCE_BOTTOM_RATIO) : strip.naturalHeight;
    const sourceHeight = Math.max(1, sourceBottom - sourceTop);
    const surfaceY = largePaintedStrip
      ? Math.max(1, Math.round(strip.naturalHeight * LAND_LARGE_SURFACE_RATIO) - sourceTop)
      : LAND_SURFACE_SOURCE_Y;
    const rawScale = largePaintedStrip ? LAND_LARGE_TARGET_HEIGHT / sourceHeight : LAND_STRIP_SCALE;
    const scale = largePaintedStrip ? Math.max(0.25, Math.min(1, Math.round(rawScale * 4) / 4)) : rawScale;

    const image = largePaintedStrip
      ? makeTransparentLandCanvas(strip, Math.round(strip.naturalHeight * LAND_LARGE_SURFACE_RATIO), sourceBottom)
      : strip;

    landAssets.prepared = {
      image,
      sourceX: 0,
      sourceY: sourceTop,
      sourceWidth: strip.naturalWidth,
      sourceHeight,
      surfaceY,
      scale
    };
    landAssets.preparedKey = key;
    return landAssets.prepared;
  }

  function makeTransparentLandCanvas(image, grassBottomY, dirtBottomY) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const buffer = canvas.getContext("2d");
    buffer.imageSmoothingEnabled = false;
    buffer.drawImage(image, 0, 0);

    try {
      const imageData = buffer.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      for (let y = 0; y < canvas.height; y += 1) {
        const canClearBlack = y < grassBottomY || y > dirtBottomY;
        if (!canClearBlack) continue;

        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          if (r < 22 && g < 22 && b < 22) pixels[index + 3] = 0;
        }
      }
      buffer.putImageData(imageData, 0, 0);
    } catch (_error) {
      return image;
    }

    return canvas;
  }

  function drawRiverBase(light, waterY) {
    if (!USE_REFLECTIVE_RIVER || waterY >= view.height - 12) return;

    const waterGradient = ctx.createLinearGradient(0, waterY - 12, 0, view.height);
    waterGradient.addColorStop(0, colorMix("#23302c", "#607b70", light));
    waterGradient.addColorStop(0.42, colorMix("#263b3a", "#6f918a", light));
    waterGradient.addColorStop(1, colorMix("#17242a", "#74aabd", light));

    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterY - 3, view.width, view.height - waterY + 4);

    ctx.save();
    ctx.globalAlpha = 0.32 + light * 0.18;
    ctx.fillStyle = colorMix("#4a3424", "#977345", light);
    for (let x = -80; x < view.width + 90; x += 34) {
      const world = x + camera.x;
      const y = waterY - 12 + Math.sin(world * 0.035) * 3;
      const width = 18 + Math.abs(Math.sin(world * 0.071)) * 26;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), 5);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.42 + light * 0.26;
    ctx.fillStyle = colorMix("#7d8f48", "#c1cc66", light);
    for (let x = -60; x < view.width + 70; x += 46) {
      const world = x + camera.x * 0.9;
      const h = 8 + Math.abs(Math.sin(world * 0.083)) * 16;
      const y = waterY - 10 + Math.sin(world * 0.044) * 2;
      ctx.fillRect(Math.round(x), Math.round(y - h), 3, Math.round(h));
      if (Math.sin(world * 0.039) > 0.15) {
        ctx.fillRect(Math.round(x + 5), Math.round(y - h * 0.7), 2, Math.round(h * 0.7));
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#100d0b";
    for (let x = -40; x < view.width + 40; x += 22) {
      const y = waterY - 2 + Math.sin((x + camera.x) * 0.052) * 2;
      ctx.fillRect(Math.round(x), Math.round(y), 11 + (x % 3) * 3, 2);
    }
    ctx.restore();
  }

  function drawRiverEffects(light) {
    if (!USE_REFLECTIVE_RIVER) return;
    const waterY = getWaterY();
    if (waterY >= view.height - 12) return;

    drawRiverReflection(light, waterY);
    drawRiverSurface(light, waterY);
  }

  function drawRiverReflection(light, waterY) {
    const sourceHeight = Math.min(RIVER_REFLECTION_SOURCE_HEIGHT, Math.max(96, waterY - 32));
    const sourceY = Math.max(0, Math.round(waterY - sourceHeight));
    const capturedHeight = Math.min(sourceHeight, waterY - sourceY);
    const waterDepth = view.height - waterY;
    if (capturedHeight <= 0 || waterDepth <= 0) return;

    if (riverReflection.canvas.width !== view.width || riverReflection.canvas.height !== capturedHeight) {
      riverReflection.canvas.width = view.width;
      riverReflection.canvas.height = capturedHeight;
    }

    const buffer = riverReflection.ctx;
    buffer.setTransform(1, 0, 0, 1, 0, 0);
    buffer.clearRect(0, 0, view.width, capturedHeight);
    buffer.imageSmoothingEnabled = false;
    buffer.drawImage(
      canvas,
      0,
      Math.round(sourceY * view.dpr),
      Math.round(view.width * view.dpr),
      Math.round(capturedHeight * view.dpr),
      0,
      0,
      view.width,
      capturedHeight
    );

    const reflectedHeight = Math.min(capturedHeight * 0.72, waterDepth + 96);
    const squash = reflectedHeight / capturedHeight;
    const shimmer = state.time * 2.1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY, view.width, view.height - waterY);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;

    for (let sy = 0; sy < capturedHeight; sy += RIVER_REFLECTION_SLICE_HEIGHT) {
      const sliceHeight = Math.min(RIVER_REFLECTION_SLICE_HEIGHT, capturedHeight - sy);
      const depth = (capturedHeight - sy) / capturedHeight;
      const dy = waterY + (capturedHeight - sy - sliceHeight) * squash;
      const wave = Math.sin(shimmer + sy * 0.095) * (2 + depth * 5);
      const drift = Math.sin(camera.x * 0.009 + sy * 0.041) * (1 + depth * 4);
      const dx = Math.round(wave + drift);
      const alpha = (0.06 + depth * 0.18) * (0.55 + light * 0.45);

      ctx.globalAlpha = alpha;
      ctx.drawImage(
        riverReflection.canvas,
        0,
        sy,
        view.width,
        sliceHeight,
        dx,
        Math.round(dy),
        view.width,
        Math.max(2, Math.ceil(sliceHeight * squash) + 1)
      );
    }

    ctx.globalAlpha = 0.2 + light * 0.12;
    ctx.fillStyle = colorMix("#263a39", "#79a29a", light);
    ctx.fillRect(0, waterY, view.width, view.height - waterY);
    ctx.restore();
  }

  function drawRiverSurface(light, waterY) {
    const waterDepth = view.height - waterY;
    if (waterDepth <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY - 2, view.width, waterDepth + 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;

    ctx.globalAlpha = 0.2 + light * 0.18;
    ctx.fillStyle = colorMix("#a7c5b5", "#d9f1d6", light);
    for (let i = 0; i < 54; i += 1) {
      const x = (i * 71 + state.time * 18 - camera.x * 0.38) % (view.width + 120) - 60;
      const y = waterY + 8 + (i % 8) * Math.max(8, waterDepth / 10) + Math.sin(state.time * 1.4 + i) * 2;
      const width = 10 + (i % 5) * 9;
      ctx.fillRect(Math.round(x), Math.round(y), width, 2);
      if (i % 4 === 0) ctx.fillRect(Math.round(x + width + 5), Math.round(y + 1), 8, 1);
    }

    ctx.globalAlpha = 0.22 + light * 0.2;
    ctx.fillStyle = colorMix("#ddc078", "#fff0a3", light);
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 113 + state.time * 32 - camera.x * 0.24) % (view.width + 90) - 45;
      const y = waterY + 18 + (i % 6) * Math.max(10, waterDepth / 8);
      ctx.fillRect(Math.round(x), Math.round(y), 4 + (i % 3) * 4, 2);
    }

    ctx.globalAlpha = 0.28 + light * 0.18;
    ctx.fillStyle = colorMix("#182322", "#425d52", light);
    for (let x = -30; x < view.width + 40; x += 26) {
      const y = waterY + Math.sin((x + camera.x + state.time * 20) * 0.035) * 2;
      ctx.fillRect(Math.round(x), Math.round(y), 16, 2);
    }

    ctx.restore();
  }

  function drawDecorationLayer(layer, light) {
    if (!USE_ASSET_PROPS) return;

    ctx.save();
    ctx.globalAlpha = layer === "back" ? 0.82 : 1;
    for (const decoration of terrainDecorations) {
      if (decoration.layer !== layer) continue;
      const image = scenery.props[decoration.key];
      if (!imageReady(image)) continue;

      const x = screenX(decoration.x, layer === "back" ? 0.94 : 1);
      const scale = decoration.scale;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      if (x < -width - 80 || x > view.width + width + 80) continue;

      const groundOffset = decoration.key.startsWith("tree") || decoration.key === "house" || decoration.key === "shed" ? 6 : 2;
      const y = view.ground - height + groundOffset;
      ctx.drawImage(image, Math.round(x - width / 2), Math.round(y), Math.round(width), Math.round(height));
    }

    ctx.restore();
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

  function drawCamp(camp, light) {
    const x = screenX(camp.x);
    if (x < -160 || x > view.width + 160) return;
    const y = view.ground;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = colorMix("#5b3526", "#8d5a33", light);
    ctx.fillRect(-38, -26, 76, 20);
    ctx.fillStyle = colorMix("#2e2020", "#69443b", light);
    ctx.beginPath();
    ctx.moveTo(-54, -24);
    ctx.lineTo(-14, -76);
    ctx.lineTo(22, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colorMix("#3c2833", "#845049", light);
    ctx.beginPath();
    ctx.moveTo(2, -24);
    ctx.lineTo(42, -70);
    ctx.lineTo(58, -24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0c766";
    ctx.globalAlpha = 0.6 + Math.sin(state.time * 8) * 0.18;
    ctx.beginPath();
    ctx.arc(-4, -10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(portal) {
    const x = screenX(portal.x);
    if (x < -180 || x > view.width + 180) return;
    const y = view.ground - 42;
    const pulse = Math.sin((portal.pulse || 0) * 3.2) * 0.5 + 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.72;
    const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, 76 + pulse * 12);
    gradient.addColorStop(0, "#7d6cff");
    gradient.addColorStop(0.45, "#27143f");
    gradient.addColorStop(1, "rgba(8, 8, 16, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 72 + pulse * 7, 96 + pulse * 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(210, 199, 255, 0.42)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46 + pulse * 8, 72 + pulse * 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStructure(structure, light) {
    if (structure.kind === "keep") return drawKeep(structure, light);
    if (structure.level <= 0) return drawBuildSite(structure, light);
    if (structure.kind === "wall") return drawWall(structure, light);
    if (structure.kind === "tower") return drawTower(structure, light);
    if (structure.kind === "farm") return drawFarm(structure, light);
  }

  function drawBuildSite(structure, light) {
    const x = screenX(structure.x);
    if (x < -140 || x > view.width + 140) return;
    const y = view.ground;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.54 + light * 0.14;
    ctx.fillStyle = "#8b6b43";
    ctx.fillRect(-34, -13, 68, 11);
    ctx.strokeStyle = "#c19b5b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-28, -14);
    ctx.lineTo(-12, -50);
    ctx.moveTo(28, -14);
    ctx.lineTo(10, -50);
    ctx.moveTo(-18, -34);
    ctx.lineTo(18, -34);
    ctx.stroke();
    ctx.restore();
  }

  function drawKeep(structure, light) {
    const x = screenX(structure.x);
    const y = view.ground;
    ctx.save();
    ctx.translate(x, y);
    const stone = colorMix("#39363c", "#9a8b73", light);
    const roof = colorMix("#5a1f2a", "#9f513b", light);
    ctx.fillStyle = stone;
    const width = 118 + structure.level * 22;
    const height = 88 + structure.level * 30;
    ctx.fillRect(-width / 2, -height, width, height);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(-width / 2 - 12, -height);
    ctx.lineTo(0, -height - 58);
    ctx.lineTo(width / 2 + 12, -height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#151318";
    ctx.fillRect(-16, -42, 32, 42);
    ctx.fillStyle = "#f0c766";
    ctx.fillRect(-7, -height - 84, 14, 26);
    ctx.beginPath();
    ctx.moveTo(7, -height - 84);
    ctx.lineTo(42, -height - 72);
    ctx.lineTo(7, -height - 58);
    ctx.closePath();
    ctx.fill();
    drawHealthBar(structure, -width / 2, -height - 14, width, 5);
    ctx.restore();
  }

  function drawWall(structure, light) {
    const x = screenX(structure.x);
    if (x < -140 || x > view.width + 140) return;
    const y = view.ground;
    const width = 70 + structure.level * 18;
    const height = 58 + structure.level * 18;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = colorMix("#383b42", "#8c887a", light);
    ctx.fillRect(-width / 2, -height, width, height);
    ctx.fillStyle = colorMix("#25282f", "#68665c", light);
    for (let row = 0; row < structure.level + 2; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const bx = -width / 2 + 6 + col * (width / 5) + (row % 2) * 7;
        const by = -height + 8 + row * 17;
        ctx.fillRect(bx, by, width / 6, 5);
      }
    }
    if (structure.flash > 0) {
      ctx.globalAlpha = structure.flash;
      ctx.fillStyle = "#f0c766";
      ctx.fillRect(-width / 2, -height, width, height);
    }
    drawHealthBar(structure, -width / 2, -height - 10, width, 5);
    ctx.restore();
  }

  function drawTower(structure, light) {
    const x = screenX(structure.x);
    if (x < -160 || x > view.width + 160) return;
    const y = view.ground;
    const height = 105 + structure.level * 36;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = colorMix("#3f2d23", "#86603a", light);
    ctx.fillRect(-24, -height, 48, height);
    ctx.fillStyle = colorMix("#2b1f1a", "#5c432c", light);
    ctx.fillRect(-42, -height - 18, 84, 25);
    ctx.fillStyle = "#f0c766";
    ctx.fillRect(-6, -height - 45, 12, 27);
    drawTinyGuard(0, -height - 28, light);
    drawHealthBar(structure, -38, -height - 54, 76, 5);
    ctx.restore();
  }

  function drawFarm(structure, light) {
    const x = screenX(structure.x);
    if (x < -190 || x > view.width + 190) return;
    const y = view.ground;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = colorMix("#3f2a18", "#7f6133", light);
    ctx.fillRect(-92, -8, 184, 26);
    ctx.strokeStyle = colorMix("#8b693f", "#e0b56a", light);
    ctx.lineWidth = 3;
    for (let i = -80; i <= 80; i += 22) {
      ctx.beginPath();
      ctx.moveTo(i, 16);
      ctx.lineTo(i + 24, -8);
      ctx.stroke();
    }
    ctx.fillStyle = colorMix("#31502e", "#7c9a48", light);
    for (let i = 0; i < structure.level * 8; i += 1) {
      const px = -78 + i * 21;
      ctx.fillRect(px, -22 - (i % 2) * 8, 6, 16 + (i % 2) * 6);
    }
    ctx.fillStyle = colorMix("#53331e", "#9d6736", light);
    ctx.fillRect(-86, -48, 46, 40);
    ctx.beginPath();
    ctx.moveTo(-94, -48);
    ctx.lineTo(-62, -78);
    ctx.lineTo(-30, -48);
    ctx.closePath();
    ctx.fill();
    drawHealthBar(structure, -88, -84, 176, 5);
    ctx.restore();
  }

  function drawHealthBar(target, x, y, width, height) {
    if (!target.maxHp || target.hp >= target.maxHp) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#b84f52";
    ctx.fillRect(x, y, width * Math.max(0, target.hp / target.maxHp), height);
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

  function personPalette(role, light) {
    const skin = colorMix("#a66b48", "#e7b17c", light);
    const darkSkin = colorMix("#75442e", "#a86a45", light);
    const palettes = {
      vagrant: {
        main: colorMix("#342b35", "#6f5144", light),
        dark: colorMix("#1d1a23", "#3c2f30", light),
        trim: colorMix("#6d5544", "#a67a55", light),
        pants: colorMix("#29272a", "#4a3a35", light),
        hat: colorMix("#25202a", "#4e3a3b", light),
        skin,
        darkSkin
      },
      builder: {
        main: colorMix("#72431f", "#bd7c34", light),
        dark: colorMix("#3a2619", "#6b3d21", light),
        trim: colorMix("#a57942", "#d8a858", light),
        pants: colorMix("#313437", "#596064", light),
        hat: colorMix("#8c622d", "#d0a052", light),
        skin,
        darkSkin
      },
      guard: {
        main: colorMix("#263849", "#4b6f7b", light),
        dark: colorMix("#151e29", "#263844", light),
        trim: colorMix("#a8954d", "#e0c76b", light),
        pants: colorMix("#1f252d", "#374350", light),
        hat: colorMix("#1f2c39", "#3e5866", light),
        skin,
        darkSkin
      },
      farmer: {
        main: colorMix("#3b5a32", "#6f8c43", light),
        dark: colorMix("#22311f", "#3e532c", light),
        trim: colorMix("#987843", "#d3aa5b", light),
        pants: colorMix("#493322", "#765236", light),
        hat: colorMix("#a88545", "#e0bd67", light),
        skin,
        darkSkin
      }
    };
    return palettes[role] || palettes.farmer;
  }

  function drawPixelTool(role, unit, palette) {
    if (role === "builder") {
      pixelLine(unit, 6, -13, 10, -5, palette.dark, 0.7);
      pixelRect(unit, 5, -15, 5, 2, "#c9b37d");
      pixelRect(unit, 7, -16, 2, 1, "#eee0ad");
    }

    if (role === "guard") {
      pixelRect(unit, 7, -17, 1, 13, palette.trim);
      pixelRect(unit, 8, -18, 1, 3, palette.dark);
      pixelRect(unit, 9, -15, 1, 3, palette.dark);
      pixelRect(unit, 9, -10, 1, 3, palette.dark);
      pixelRect(unit, 8, -7, 1, 3, palette.dark);
      pixelRect(unit, 1, -12, 7, 1, "#d9c68a");
      pixelRect(unit, 6, -13, 2, 3, "#efe4b2");
    }

    if (role === "farmer") {
      pixelLine(unit, 6, -14, 10, -2, palette.dark, 0.7);
      pixelRect(unit, 7, -15, 6, 1, "#cbb879");
      pixelRect(unit, 12, -14, 1, 3, "#cbb879");
    }

    if (role === "vagrant") {
      pixelLine(unit, 6, -17, 6, 0, "#33241a", 0.75);
      pixelRect(unit, -9, -9, 3, 4, palette.trim);
      pixelRect(unit, -10, -8, 5, 2, palette.dark);
    }
  }

  function drawPixelPerson(role, light, seed, options) {
    const unit = options.unit || 3;
    const facing = options.facing || 1;
    const palette = personPalette(role, light);
    const walk = Math.sin(state.time * 8 + seed);
    const legA = Math.round(walk);
    const legB = Math.round(-walk);

    ctx.save();
    ctx.scale(facing, 1);

    pixelRect(unit, -6, -1, 12, 1, "rgba(0, 0, 0, 0.24)");

    if (role === "guard") {
      pixelRect(unit, -7, -20, 3, 11, palette.dark);
      pixelRect(unit, -8, -19, 1, 9, palette.trim);
    }

    pixelRect(unit, -5 + legA, -7, 4, 7, palette.pants);
    pixelRect(unit, 1 + legB, -7, 4, 7, palette.pants);
    pixelRect(unit, -6 + legA, -1, 5, 2, palette.dark);
    pixelRect(unit, 1 + legB, -1, 5, 2, palette.dark);

    if (role === "vagrant") {
      pixelRect(unit, -6, -17, 12, 11, palette.main);
      pixelRect(unit, -7, -14, 2, 8, palette.dark);
      pixelRect(unit, 5, -13, 2, 7, palette.dark);
      pixelRect(unit, -4, -8, 3, 2, palette.trim);
      pixelRect(unit, 3, -6, 2, 2, palette.trim);
      pixelRect(unit, -5, -22, 10, 7, palette.hat);
      pixelRect(unit, -3, -19, 6, 5, palette.skin);
      pixelRect(unit, -1, -16, 3, 2, palette.darkSkin);
    } else {
      pixelRect(unit, -5, -16, 10, 9, palette.main);
      pixelRect(unit, -5, -9, 10, 2, palette.dark);
      pixelRect(unit, -7, -15, 3, 8, palette.dark);
      pixelRect(unit, 5, -15, 3, 8, palette.dark);
      pixelRect(unit, -4, -22, 8, 7, palette.skin);
      pixelRect(unit, -5, -21, 10, 3, palette.darkSkin);
      pixelRect(unit, -4, -15, 8, 2, palette.darkSkin);
      pixelRect(unit, 2, -19, 1, 1, "#101015");
    }

    if (role === "builder") {
      pixelRect(unit, -6, -24, 12, 3, palette.hat);
      pixelRect(unit, -3, -26, 7, 2, palette.hat);
      pixelRect(unit, -4, -15, 8, 6, colorMix("#876135", "#c99a58", light));
      pixelRect(unit, -2, -14, 1, 4, "#e4c381");
    }

    if (role === "guard") {
      pixelRect(unit, -5, -24, 10, 5, palette.hat);
      pixelRect(unit, -6, -21, 12, 3, palette.hat);
      pixelRect(unit, -5, -16, 10, 2, palette.trim);
      pixelRect(unit, -2, -13, 4, 4, colorMix("#5a6470", "#9fb1b6", light));
    }

    if (role === "farmer") {
      pixelRect(unit, -7, -25, 14, 2, palette.hat);
      pixelRect(unit, -5, -27, 10, 3, palette.hat);
      pixelRect(unit, -6, -15, 12, 2, palette.trim);
    }

    drawPixelTool(role, unit, palette);
    ctx.restore();
  }

  function drawCitizen(citizen, light) {
    const x = screenX(citizen.x);
    if (x < -80 || x > view.width + 80) return;
    const y = view.ground;
    const seed = Number(citizen.id.slice(1)) || 1;
    const bob = Math.sin(state.time * 7.5 + seed) * 1.5;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    drawPixelPerson(citizen.role, light, seed, { facing: citizen.side || 1, unit: 3 });
    ctx.restore();
  }

  function drawTinyGuard(x, y, light) {
    ctx.save();
    ctx.translate(x, y + 8);
    drawPixelPerson("guard", light, 7, { facing: 1, unit: 2 });
    ctx.restore();
  }

  function drawEnemy(enemy) {
    const x = screenX(enemy.x);
    if (x < -90 || x > view.width + 90) return;
    const y = view.ground;
    const hurt = enemy.stunned > 0 ? 1 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(enemy.side, 1);
    ctx.fillStyle = hurt ? "#6f5cff" : "#11131a";
    ctx.globalAlpha = hurt ? 0.92 : 0.86;
    ctx.beginPath();
    ctx.ellipse(0, -28, 24, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, -54);
    ctx.lineTo(0, -76);
    ctx.lineTo(8, -54);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = enemy.loot > 0 ? "#f0c766" : "#c9d0ff";
    ctx.globalAlpha = 1;
    ctx.fillRect(8, -38, 5, 5);
    ctx.fillRect(-13, -38, 5, 5);
    ctx.strokeStyle = "#06070a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-18, 0);
    ctx.moveTo(12, -4);
    ctx.lineTo(18, 0);
    ctx.stroke();
    if (enemy.hp < enemy.maxHp) {
      drawHealthBar(enemy, -24, -88, 48, 5);
    }
    ctx.restore();
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
    const gold = p.hurtTimer > 0 ? "#fff0a8" : "#f0c766";
    const robe = p.hurtTimer > 0 ? "#eec2b2" : colorMix("#641f36", "#b53f54", light);
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

  function drawDrop(drop) {
    const x = screenX(drop.x);
    const y = view.ground + drop.y - 9;
    if (x < -30 || x > view.width + 30) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#b8792d";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe697";
    ctx.beginPath();
    ctx.arc(-2, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShot(shot) {
    const t = 1 - shot.ttl / shot.maxTtl;
    const x = screenX(mix(shot.fromX, shot.toX, t));
    const y = view.ground - 90 - Math.sin(t * Math.PI) * 28;
    const dx = shot.toX - shot.fromX;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dx > 0 ? 0 : Math.PI);
    ctx.strokeStyle = "#f0e1b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    const light = daylight();
    camera.x += (state.player.x - camera.x) * 0.085;
    camera.x = Core.clamp(camera.x, Core.WORLD_MIN + view.width / 2, Core.WORLD_MAX - view.width / 2);

    drawSky(light);
    drawClouds(light);
    drawMountains(light);
    drawForest(light);
    drawGround(light);
    drawDecorationLayer("back", light);
    drawDust(light);

    if (TERRAIN_FOCUS_MODE) {
      drawPlayer(light);
    } else {
      for (const portal of state.portals) drawPortal(portal);
      for (const camp of state.camps) drawCamp(camp, light);
      for (const structure of state.structures) drawStructure(structure, light);
      for (const drop of state.drops) drawDrop(drop);

      const actors = []
        .concat(state.citizens.map((item) => ({ kind: "citizen", item })))
        .concat(state.enemies.map((item) => ({ kind: "enemy", item })))
        .concat([{ kind: "player", item: state.player }])
        .sort((a, b) => a.item.x - b.item.x);

      for (const actor of actors) {
        if (actor.kind === "citizen") drawCitizen(actor.item, light);
        if (actor.kind === "enemy") drawEnemy(actor.item);
        if (actor.kind === "player") drawPlayer(light);
      }
    }

    drawRiverEffects(light);
    drawDecorationLayer("front", light);

    if (!TERRAIN_FOCUS_MODE) {
      for (const shot of state.shots) drawShot(shot);
    }

    if (state.phase === "night") {
      ctx.fillStyle = "rgba(18, 17, 41, 0.18)";
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  function syncHud() {
    const counts = Core.getCounts(state);
    dayEl.textContent = String(state.day);
    peopleEl.textContent = String(counts.total);
    updateCoins(Math.max(0, state.player.coins));
    updateCrown();

    if (TERRAIN_FOCUS_MODE) {
      actionEl.hidden = true;
      endingEl.hidden = true;
      return;
    }

    const target = Core.getNearestInteractable(state);
    if (!target) {
      actionEl.hidden = true;
    } else {
      actionEl.hidden = false;
      actionTitleEl.textContent = target.title;
      actionCostEl.textContent = `${target.cost}`;
    }

    if (state.gameOver) {
      endingEl.hidden = false;
      scoreLineEl.textContent = `Day ${state.day}, ${state.stats.enemiesDefeated} defeated, ${state.stats.peopleHired} hired.`;
    }
  }

  function updateCoins(count) {
    const visible = Math.min(count, 16);
    if (coinsEl.dataset.count === String(count)) return;
    coinsEl.dataset.count = String(count);
    coinsEl.innerHTML = "";
    for (let i = 0; i < visible; i += 1) {
      const coin = document.createElement("span");
      coin.className = "coin";
      coinsEl.appendChild(coin);
    }
    if (count > visible) {
      const more = document.createElement("span");
      more.className = "coin more";
      more.textContent = `+${count - visible}`;
      coinsEl.appendChild(more);
    }
  }

  function updateCrown() {
    const current = Math.max(0, state.player.crownHealth);
    const max = state.player.maxCrownHealth;
    const signature = `${current}/${max}`;
    if (crownEl.dataset.value === signature) return;
    crownEl.dataset.value = signature;
    crownEl.innerHTML = "";
    for (let i = 0; i < max; i += 1) {
      const pip = document.createElement("span");
      pip.className = i < current ? "pip" : "pip empty";
      crownEl.appendChild(pip);
    }
  }

  function reactToEvents() {
    if (!state.events || state.events.length === 0) return;
    for (const event of state.events) {
      if (event.type === "coin") playSound("coin");
      if (event.type === "wave") playSound("wave");
      if (event.type === "hurt" || event.type === "steal" || event.type === "break") playSound("hurt");
    }
  }

  function frame(now) {
    const dt = Math.min(0.08, (now - lastTime) / 1000 || 0);
    lastTime = now;

    Core.update(state, input, dt);
    prepareGameState(state);
    reactToEvents();
    render();
    syncHud();

    saveTimer += dt;
    if (saveTimer >= 2.5) {
      saveTimer = 0;
      saveGame();
    }

    requestAnimationFrame(frame);
  }

  setMuted(muted);
  resize();
  camera.x = state.player.x;
  syncHud();
  requestAnimationFrame(frame);
})();
