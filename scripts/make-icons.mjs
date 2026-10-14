// Renders the app icon (green tile + white check) to PNGs with no dependencies.
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function render(size) {
  const bg = [47, 133, 90];
  const pts = [[0.28, 0.52], [0.44, 0.68], [0.74, 0.36]].map(([x, y]) => [x * size, y * size]);
  const half = 0.045 * size;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.min(distToSegment(x + 0.5, y + 0.5, pts[0], pts[1]), distToSegment(x + 0.5, y + 0.5, pts[1], pts[2]));
      const a = Math.max(0, Math.min(1, half - d + 0.5));
      const i = row + 1 + x * 4;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(bg[c] * (1 - a) + 255 * a);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, render(size));
console.log('Wrote public/icon-192.png and public/icon-512.png');
