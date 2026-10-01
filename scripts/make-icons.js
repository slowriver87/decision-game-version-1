// Draws the app icon (a tiny frequency grid) and writes PNGs + SVG to icons/.
// No dependencies: a minimal PNG encoder on top of Node's zlib.
// Usage: node scripts/make-icons.js
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [18, 18, 17], GRAY = [74, 74, 70], BLUE = [57, 135, 229], ORANGE = [217, 89, 38];
// 3×3 grid: the "real" dot and the "false alarm" dot, then everyone else.
const DOTS = [BLUE, ORANGE, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY, GRAY];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** contentScale: fraction of the canvas the dot grid spans. corner: rounded-corner radius as fraction (0 = full bleed). */
function draw(size, { contentScale, corner }) {
  const SS = 4; // supersampling for anti-aliasing
  const out = Buffer.alloc(size * size * 4);
  const span = contentScale, step = span / 3, r = step * 0.34, start = (1 - span) / 2 + step / 2;
  const centers = DOTS.map((c, i) => ({ x: start + (i % 3) * step, y: start + Math.floor(i / 3) * step, c }));
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = (px + (sx + 0.5) / SS) / size, y = (py + (sy + 0.5) / SS) / size;
      // Rounded-square mask
      let inside = true;
      if (corner > 0) {
        const cx = Math.min(Math.max(x, corner), 1 - corner), cy = Math.min(Math.max(y, corner), 1 - corner);
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= corner ** 2;
      }
      if (!inside) continue;
      let col = BG;
      for (const d of centers) if ((x - d.x) ** 2 + (y - d.y) ** 2 <= r * r) { col = d.c; break; }
      acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255;
    }
    const n = SS * SS, i = (py * size + px) * 4;
    const a = acc[3] / n;
    out[i] = a ? Math.round(acc[0] / (acc[3] / 255)) : 0;
    out[i + 1] = a ? Math.round(acc[1] / (acc[3] / 255)) : 0;
    out[i + 2] = a ? Math.round(acc[2] / (acc[3] / 255)) : 0;
    out[i + 3] = Math.round(a);
  }
  return png(size, out);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', draw(192, { contentScale: 0.62, corner: 0.22 }));
writeFileSync('icons/icon-512.png', draw(512, { contentScale: 0.62, corner: 0.22 }));
// Maskable: full bleed, content inside the 80% safe zone.
writeFileSync('icons/icon-maskable-512.png', draw(512, { contentScale: 0.5, corner: 0 }));
// iOS adds its own rounded corners and needs an opaque image.
writeFileSync('icons/apple-touch-icon.png', draw(180, { contentScale: 0.62, corner: 0 }));

const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const svgDots = DOTS.map((c, i) => `<circle cx="${(19 + (i % 3) * 13).toFixed(1)}" cy="${(19 + Math.floor(i / 3) * 13).toFixed(1)}" r="4.4" fill="${hex(c)}"/>`).join('');
writeFileSync('icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${hex(BG)}"/>${svgDots}</svg>\n`);
console.log('icons written');
