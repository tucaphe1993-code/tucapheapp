// One-off dev utility: generates simple solid-color PNG placeholder icons
// for the PWA manifest (brown background + a lighter coffee-cup silhouette
// would need a real design tool; this just guarantees the manifest/icons
// referenced by manifest.json actually exist and are valid PNGs).
// Replace public/icons/*.png with real branded artwork before shipping.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(size, [r, g, b], glyphColor) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  const cupR = Math.round(size * 0.09);
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      // simple circle glyph in the center to make icons distinguishable
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy < cupR * cupR * 4;
      if (inCircle) {
        raw[idx] = glyphColor[0];
        raw[idx + 1] = glyphColor[1];
        raw[idx + 2] = glyphColor[2];
      } else {
        raw[idx] = r;
        raw[idx + 1] = g;
        raw[idx + 2] = b;
      }
      raw[idx + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BROWN = [91, 58, 30]; // #5b3a1e
const CREAM = [253, 251, 247]; // #fdfbf7

for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, makePng(size, BROWN, CREAM));
}
writeFileSync("public/icons/apple-touch-icon.png", makePng(180, BROWN, CREAM));
console.log("Generated placeholder PWA icons in public/icons/");
