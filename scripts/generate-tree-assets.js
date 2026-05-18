const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "assets", "terrain", "trees");

const colors = {
  oakDark: [20, 43, 24, 255],
  oakMid: [35, 67, 31, 255],
  oakLight: [72, 102, 43, 255],
  birchDark: [35, 64, 36, 255],
  birchMid: [67, 104, 48, 255],
  birchLight: [126, 151, 78, 255],
  willowDark: [28, 61, 38, 255],
  willowMid: [56, 93, 51, 255],
  willowLight: [108, 133, 65, 255],
  barkDark: [39, 27, 22, 255],
  barkMid: [70, 45, 30, 255],
  barkLight: [103, 66, 38, 255],
  birchBark: [183, 190, 177, 255],
  birchBarkShade: [116, 128, 119, 255],
  birchScar: [33, 37, 33, 255],
  rootShadow: [18, 18, 15, 185]
};

function makeCanvas(width, height) {
  return {
    width,
    height,
    pixels: Buffer.alloc(width * height * 4)
  };
}

function makePng(canvas) {
  const { width, height, pixels } = canvas;
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

  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
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

function hash(x, y, salt) {
  let value = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 1442695041) >>> 0;
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function setPixel(canvas, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) return;
  const index = (py * canvas.width + px) * 4;
  canvas.pixels[index] = color[0];
  canvas.pixels[index + 1] = color[1];
  canvas.pixels[index + 2] = color[2];
  canvas.pixels[index + 3] = color[3];
}

function rect(canvas, x, y, width, height, color) {
  for (let yy = Math.round(y); yy < y + height; yy += 1) {
    for (let xx = Math.round(x); xx < x + width; xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function stamp(canvas, x, y, size, color) {
  const radius = Math.floor(size / 2);
  rect(canvas, Math.round(x) - radius, Math.round(y) - radius, size, size, color);
}

function line(canvas, x1, y1, x2, y2, color, size) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    stamp(canvas, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, size || 1, color);
  }
}

function ellipse(canvas, cx, cy, rx, ry, palette, salt, density) {
  const left = Math.floor(cx - rx);
  const right = Math.ceil(cx + rx);
  const top = Math.floor(cy - ry);
  const bottom = Math.ceil(cy + ry);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;

      const edge = d > 0.78;
      const n = hash(x, y, salt);
      if (edge && n > (density || 0.88)) continue;
      if (d < 0.42 && n < 0.018) continue;

      let color = palette.mid;
      if (d > 0.74 || n < 0.22) color = palette.dark;
      if (n > 0.78 && x < cx + rx * 0.25 && y < cy + ry * 0.2) color = palette.light;
      if ((x + y + salt) % 9 === 0 && n > 0.42) color = palette.dark;
      setPixel(canvas, x, y, color);
    }
  }
}

function drawShadow(canvas, cx, y, width) {
  for (let x = -width; x <= width; x += 1) {
    const d = Math.abs(x / width);
    const halfHeight = Math.max(1, Math.round((1 - d * d) * 4));
    for (let yy = -halfHeight; yy <= halfHeight; yy += 1) {
      if (hash(cx + x, y + yy, 13) > 0.12) setPixel(canvas, cx + x, y + yy, colors.rootShadow);
    }
  }
}

function drawOak() {
  const canvas = makeCanvas(240, 276);
  drawShadow(canvas, 119, 264, 58);

  line(canvas, 112, 264, 115, 145, colors.barkDark, 28);
  line(canvas, 125, 264, 121, 142, colors.barkMid, 22);
  line(canvas, 112, 252, 71, 270, colors.barkDark, 9);
  line(canvas, 130, 252, 177, 270, colors.barkDark, 9);
  line(canvas, 116, 178, 76, 126, colors.barkDark, 9);
  line(canvas, 122, 166, 165, 112, colors.barkMid, 8);
  line(canvas, 118, 150, 112, 88, colors.barkDark, 8);

  rect(canvas, 107, 178, 5, 72, colors.barkLight);
  rect(canvas, 126, 164, 4, 86, colors.barkDark);
  for (let y = 164; y < 250; y += 13) {
    rect(canvas, 105 + (y % 3), y, 12, 3, colors.barkDark);
    rect(canvas, 124, y + 5, 9, 2, colors.barkLight);
  }

  const palette = { dark: colors.oakDark, mid: colors.oakMid, light: colors.oakLight };
  ellipse(canvas, 94, 100, 58, 54, palette, 11, 0.88);
  ellipse(canvas, 143, 98, 62, 57, palette, 23, 0.88);
  ellipse(canvas, 118, 70, 67, 54, palette, 31, 0.9);
  ellipse(canvas, 69, 145, 54, 51, palette, 47, 0.86);
  ellipse(canvas, 169, 146, 58, 52, palette, 59, 0.86);
  ellipse(canvas, 119, 136, 76, 62, palette, 71, 0.9);

  for (let i = 0; i < 160; i += 1) {
    const x = 38 + (i * 47) % 166;
    const y = 42 + (i * 31) % 135;
    const n = hash(x, y, 97);
    if (n > 0.52) rect(canvas, x, y, 3 + (i % 3), 2, n > 0.83 ? colors.oakLight : colors.oakDark);
  }

  return canvas;
}

function drawBirch() {
  const canvas = makeCanvas(188, 278);
  drawShadow(canvas, 91, 266, 42);

  line(canvas, 93, 266, 87, 116, colors.birchBarkShade, 14);
  line(canvas, 89, 266, 84, 114, colors.birchBark, 10);
  line(canvas, 87, 158, 55, 111, colors.birchBarkShade, 5);
  line(canvas, 91, 151, 120, 104, colors.birchBark, 5);
  line(canvas, 85, 126, 72, 77, colors.birchBarkShade, 4);
  line(canvas, 90, 128, 108, 81, colors.birchBark, 4);
  line(canvas, 80, 258, 55, 271, colors.birchBarkShade, 5);
  line(canvas, 98, 258, 128, 271, colors.birchBarkShade, 5);

  for (let y = 122; y < 258; y += 12) {
    const x = 82 + Math.round(Math.sin(y * 0.12) * 3);
    rect(canvas, x - 3, y, 8, 2, colors.birchScar);
    if (y % 24 === 0) rect(canvas, x + 8, y + 4, 4, 2, colors.birchScar);
  }

  const palette = { dark: colors.birchDark, mid: colors.birchMid, light: colors.birchLight };
  ellipse(canvas, 72, 91, 43, 44, palette, 101, 0.84);
  ellipse(canvas, 112, 92, 46, 46, palette, 113, 0.84);
  ellipse(canvas, 91, 58, 52, 43, palette, 127, 0.86);
  ellipse(canvas, 55, 135, 35, 41, palette, 139, 0.8);
  ellipse(canvas, 129, 136, 38, 43, palette, 151, 0.8);
  ellipse(canvas, 91, 130, 55, 48, palette, 163, 0.86);

  for (let i = 0; i < 110; i += 1) {
    const x = 34 + (i * 41) % 120;
    const y = 42 + (i * 29) % 125;
    const n = hash(x, y, 181);
    if (n > 0.58) rect(canvas, x, y, 3, 2, n > 0.82 ? colors.birchLight : colors.birchDark);
  }

  return canvas;
}

function drawWillow() {
  const canvas = makeCanvas(248, 306);
  drawShadow(canvas, 128, 292, 54);

  line(canvas, 131, 292, 130, 205, colors.barkDark, 20);
  line(canvas, 130, 206, 117, 151, colors.barkMid, 14);
  line(canvas, 119, 152, 139, 100, colors.barkDark, 9);
  line(canvas, 121, 169, 78, 127, colors.barkDark, 6);
  line(canvas, 124, 160, 174, 122, colors.barkMid, 6);
  line(canvas, 118, 280, 83, 296, colors.barkDark, 7);
  line(canvas, 140, 280, 181, 298, colors.barkDark, 7);
  rect(canvas, 121, 210, 5, 64, colors.barkLight);

  const palette = { dark: colors.willowDark, mid: colors.willowMid, light: colors.willowLight };
  ellipse(canvas, 124, 91, 78, 54, palette, 211, 0.88);
  ellipse(canvas, 83, 134, 58, 62, palette, 223, 0.84);
  ellipse(canvas, 165, 134, 60, 63, palette, 239, 0.84);
  ellipse(canvas, 123, 152, 76, 72, palette, 251, 0.86);

  for (let i = 0; i < 58; i += 1) {
    const startX = 48 + i * 3 + Math.sin(i * 1.7) * 9;
    const startY = 72 + Math.abs(Math.sin(i * 0.8)) * 50;
    const length = 56 + Math.abs(Math.sin(i * 0.43)) * 88;
    const color = i % 5 === 0 ? colors.willowLight : i % 3 === 0 ? colors.willowDark : colors.willowMid;
    const sway = Math.sin(i * 0.67) * 10;
    line(canvas, startX, startY, startX + sway, startY + length, color, i % 4 === 0 ? 3 : 2);
    if (i % 6 === 0) rect(canvas, startX + sway - 2, startY + length - 4, 5, 3, colors.willowDark);
  }

  for (let i = 0; i < 140; i += 1) {
    const x = 36 + (i * 53) % 176;
    const y = 55 + (i * 37) % 154;
    const n = hash(x, y, 271);
    if (n > 0.6) rect(canvas, x, y, 3, 3, n > 0.86 ? colors.willowLight : colors.willowDark);
  }

  return canvas;
}

const assets = [
  ["oak.png", drawOak()],
  ["birch.png", drawBirch()],
  ["willow.png", drawWillow()]
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [filename, canvas] of assets) {
  fs.writeFileSync(path.join(OUT_DIR, filename), makePng(canvas));
}

fs.writeFileSync(path.join(OUT_DIR, "README.md"), [
  "# Tree Terrain Assets",
  "",
  "Original generated pixel-art tree assets for Crownline Vale.",
  "",
  "Run `node scripts/generate-tree-assets.js` to regenerate:",
  "- `birch.png`",
  "- `oak.png`",
  "- `willow.png`"
].join("\n"));

console.log(`Wrote ${assets.map(([filename]) => path.join(OUT_DIR, filename)).join(", ")}`);
