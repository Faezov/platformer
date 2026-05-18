const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "assets", "terrain", "grassland");
const WIDTH = 384;
const HEIGHT = 128;

const palette = {
  clear: [0, 0, 0, 0],
  grassShadow: [20, 42, 24, 255],
  grassDark: [36, 68, 32, 255],
  grassMid: [73, 111, 48, 255],
  grassLight: [146, 172, 75, 255],
  moss: [100, 137, 61, 255],
  dirtTop: [106, 79, 48, 255],
  dirtMid: [76, 55, 38, 255],
  dirtLow: [50, 38, 31, 255],
  dirtDark: [28, 24, 22, 255],
  root: [129, 88, 48, 255],
  rootDark: [80, 55, 34, 255],
  stone: [83, 86, 78, 255],
  stoneLight: [139, 141, 124, 255],
  flower: [224, 197, 91, 255],
  flowerBlue: [132, 159, 198, 255]
};

function rand(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function makePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = row + 1 + x * 4;
      raw[target] = pixels[source];
      raw[target + 1] = pixels[source + 1];
      raw[target + 2] = pixels[source + 2];
      raw[target + 3] = pixels[source + 3];
    }
  }

  const chunks = [];
  chunks.push(Buffer.from("\x89PNG\r\n\x1a\n", "binary"));
  chunks.push(chunk("IHDR", Buffer.concat([
    u32(width),
    u32(height),
    Buffer.from([8, 6, 0, 0, 0])
  ])));
  chunks.push(chunk("IDAT", zlib.deflateSync(raw)));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), name, data, u32(crc32(Buffer.concat([name, data])))]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const index = (Math.floor(y) * WIDTH + Math.floor(x)) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function setPixelWrapped(pixels, x, y, color) {
  const wrappedX = ((Math.floor(x) % WIDTH) + WIDTH) % WIDTH;
  setPixel(pixels, wrappedX, y, color);
}

function rect(pixels, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(pixels, xx, yy, color);
    }
  }
}

function rectWrapped(pixels, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixelWrapped(pixels, xx, yy, color);
    }
  }
}

function line(pixels, x1, y1, x2, y2, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    setPixel(pixels, Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), color);
  }
}

function lineWrapped(pixels, x1, y1, x2, y2, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    setPixelWrapped(pixels, Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), color);
  }
}

function hash(x, y, salt) {
  let value = (x * 374761393 + y * 668265263 + salt * 1442695041) >>> 0;
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function surfaceY(x) {
  const wave = (Math.PI * 2 * (((x % WIDTH) + WIDTH) % WIDTH)) / WIDTH;
  return 28 + Math.round(Math.sin(wave * 2) * 3 + Math.sin(wave * 5 + 0.7) * 2 + Math.sin(wave * 9 + 1.3));
}

function drawLandStrip() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const random = rand(73491);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const top = surfaceY(x);
      const depth = y - top;
      const noise = hash(Math.floor(x / 4), Math.floor(y / 4), 19);
      if (y < top) {
        setPixel(pixels, x, y, palette.clear);
      } else if (depth < 2) {
        setPixel(pixels, x, y, noise > 0.22 ? palette.grassLight : palette.moss);
      } else if (depth < 8) {
        setPixel(pixels, x, y, noise > 0.68 ? palette.grassLight : palette.grassMid);
      } else if (depth < 17) {
        setPixel(pixels, x, y, palette.grassDark);
      } else {
        const deep = depth > 82;
        const pocket = hash(Math.floor(x / 7), Math.floor((y + x * 0.2) / 7), 47);
        if (deep && pocket < 0.52) setPixel(pixels, x, y, palette.dirtDark);
        else if (noise > 0.78) setPixel(pixels, x, y, palette.dirtTop);
        else if (noise < 0.18) setPixel(pixels, x, y, palette.dirtLow);
        else setPixel(pixels, x, y, palette.dirtMid);
      }
    }
  }

  for (let x = 0; x < WIDTH; x += 1) {
    const top = surfaceY(x);
    const shadow = x % 3 === 0 ? palette.grassShadow : palette.grassDark;
    setPixel(pixels, x, top + 15, shadow);
    if (x % 2 === 0) setPixel(pixels, x, top + 16, palette.dirtDark);
  }

  for (let x = 0; x < WIDTH; x += 3 + Math.floor(hash(x, 8, 3) * 4)) {
    const top = surfaceY(x);
    const blade = 8 + Math.floor(hash(x, 11, 5) * 18);
    const lean = Math.floor(hash(x, 13, 7) * 9) - 4;
    const color = hash(x, 17, 9) > 0.3 ? palette.grassLight : palette.moss;
    lineWrapped(pixels, x, top + 2, x + lean, top - blade, color);
    if (hash(x, 19, 11) > 0.72) {
      lineWrapped(pixels, x + 1, top + 5, x + lean + 2, top - Math.floor(blade * 0.62), palette.grassMid);
    }
  }

  for (let i = 0; i < 46; i += 1) {
    const x = Math.floor(random() * WIDTH);
    const y = surfaceY(x) + 23 + Math.floor(random() * 68);
    const w = 4 + Math.floor(random() * 18);
    const color = random() > 0.34 ? palette.root : palette.rootDark;
    lineWrapped(pixels, x, y, x + w, y + Math.floor(random() * 9) - 4, color);
  }

  for (let i = 0; i < 42; i += 1) {
    const x = Math.floor(random() * WIDTH);
    const y = surfaceY(x) + 28 + Math.floor(random() * 72);
    const size = 1 + Math.floor(random() * 3);
    rectWrapped(pixels, x, y, size + 1, size, random() > 0.45 ? palette.stone : palette.stoneLight);
    setPixelWrapped(pixels, x, y, palette.stoneLight);
  }

  for (let x = 28; x < WIDTH; x += 64) {
    const top = surfaceY(x);
    const flower = hash(x, 4, 23) > 0.42 ? palette.flower : palette.flowerBlue;
    rectWrapped(pixels, x, top - 10, 2, 7, palette.grassLight);
    setPixelWrapped(pixels, x - 1, top - 11, flower);
    setPixelWrapped(pixels, x + 2, top - 11, flower);
    setPixelWrapped(pixels, x, top - 12, flower);
  }

  return pixels;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "land-strip.png"), makePng(WIDTH, HEIGHT, drawLandStrip()));
fs.writeFileSync(path.join(OUT_DIR, "README.md"), [
  "# Grassland Terrain",
  "",
  "Generated local pixel-art land asset for Crownline Vale.",
  "",
  "Run `node scripts/generate-land-assets.js` to regenerate `land-strip.png`.",
  "The art is original to this project."
].join("\n"));

console.log(`Wrote ${path.join(OUT_DIR, "land-strip.png")}`);
