/**
 * Asset generator (dev utility — no external dependencies).
 *
 * Generates the TMS Android branding assets with Node's built-in `zlib`:
 *   assets/icon.png                 1024x1024  app icon
 *   assets/adaptive-icon.png        1024x1024  Android adaptive-icon foreground
 *   assets/adaptive-icon-bg.png     1024x1024  Android adaptive-icon background
 *   assets/splash-icon.png          1024x1024  splash image
 *
 * The mark is a simple tailoring motif (needle + stitches) drawn from the TMS
 * navy (#0f172a) and accent blue (#0ea5e9) palette.
 * Run: `node scripts/generate-assets.cjs`
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [15, 23, 42, 255];
const ACCENT = [14, 165, 233, 255];
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
};

const encodePng = (width, height, rgba) => {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ---------------------------------------------------------------- drawing
const canvas = (size, color) => {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    buf[i * 4] = color[0];
    buf[i * 4 + 1] = color[1];
    buf[i * 4 + 2] = color[2];
    buf[i * 4 + 3] = color[3];
  }
  return { size, buf };
};

const setPixel = (img, x, y, color) => {
  if (x < 0 || y < 0 || x >= img.size || y >= img.size) return;
  const idx = (y * img.size + x) * 4;
  const a = color[3] / 255;
  const dstA = img.buf[idx + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA === 0) return;
  img.buf[idx] = Math.round((color[0] * a + img.buf[idx] * dstA * (1 - a)) / outA);
  img.buf[idx + 1] = Math.round((color[1] * a + img.buf[idx + 1] * dstA * (1 - a)) / outA);
  img.buf[idx + 2] = Math.round((color[2] * a + img.buf[idx + 2] * dstA * (1 - a)) / outA);
  img.buf[idx + 3] = Math.round(outA * 255);
};

const fillCircle = (img, cx, cy, radius, color) => {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(img, x, y, color);
    }
  }
};

const strokeLine = (img, x0, y0, x1, y1, thickness, color) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(length * 2);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    fillCircle(img, x0 + dx * t, y0 + dy * t, thickness / 2, color);
  }
};

// ---------------------------------------------------------------- TMS mark drawing
const drawTmsMark = (img) => {
  const cx = img.size / 2;
  const cy = img.size / 2;

  // --- White disc ---
  fillCircle(img, cx, cy, 380, WHITE);
  // --- Inner navy disc (creates a white ring around the mark) ---
  fillCircle(img, cx, cy, 336, NAVY);

  // --- Needle: 45-degree diagonal, white, on the navy disc ---
  const angle = Math.PI / 4;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const halfLen = 210;
  strokeLine(
    img,
    cx - cosA * halfLen, cy - sinA * halfLen,
    cx + cosA * halfLen, cy + sinA * halfLen,
    20, WHITE
  );

  // --- Needle eye: accent blue dot at the top-left end ---
  fillCircle(img, cx - cosA * halfLen, cy - sinA * halfLen, 15, ACCENT);

  // --- Stitch marks: small accent blue dashes perpendicular to the needle ---
  const stitchCount = 7;
  const span = halfLen * 1.15;
  const step = span / (stitchCount + 1);
  const start = -span / 2 + step;
  const pcos = -sinA; // perpendicular direction
  const psin = cosA;
  for (let i = 0; i < stitchCount; i++) {
    const t = start + i * step;
    const px = cx + cosA * t;
    const py = cy + sinA * t;
    strokeLine(
      img,
      px - pcos * 12, py - psin * 12,
      px + pcos * 12, py + psin * 12,
      6, ACCENT
    );
  }
};

// ---------------------------------------------------------------- asset helpers
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const transparentCanvas = (size) => ({ size, buf: Buffer.alloc(size * size * 4) });

const writeAsset = (name, width, height, bgColor, draw) => {
  const img = bgColor ? canvas(width, bgColor) : transparentCanvas(width);
  if (draw) draw(img);
  ensureDir(ASSETS_DIR);
  fs.writeFileSync(path.join(ASSETS_DIR, name), encodePng(width, height, img.buf));
  console.log(`  ✓ assets/${name} (${width}×${height})`);
};

// ---------------------------------------------------------------- generate
console.log('Generating TMS Android branding assets...\n');

// App icon — opaque navy with the needle + stitch mark
writeAsset('icon.png', 1024, 1024, NAVY, drawTmsMark);

// Adaptive icon foreground — mark on transparent (the system applies the background)
writeAsset('adaptive-icon.png', 1024, 1024, null, drawTmsMark);

// Adaptive icon background — solid navy
writeAsset('adaptive-icon-bg.png', 1024, 1024, NAVY, null);

// Splash icon — same as the app icon
writeAsset('splash-icon.png', 1024, 1024, NAVY, drawTmsMark);

console.log(`\nDone. Assets written to: ${ASSETS_DIR}`);