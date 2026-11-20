// news-image-20261120: "20 November 2026 — The World in One Day".
// A newspaper front page drawn from scratch with Node 22 stdlib only.
// No network, no clock, no randomness: two runs write byte-identical PNGs.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 3);

function setPx(x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPx(i, j, c);
  }
}

function hline(x0, x1, y, c) {
  for (let x = x0; x <= x1; x++) setPx(x, y, c);
}

function vline(x, y0, y1, c) {
  for (let y = y0; y <= y1; y++) setPx(x, y, c);
}

// Bresenham line, thickness 1..3
function line(x0, y0, x1, y1, c, t = 1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    if (t === 1) setPx(x, y, c);
    else fillRect(x - ((t / 2) | 0), y - ((t / 2) | 0), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function circle(cx, cy, r, c, fill = false) {
  if (fill) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      hline(cx - half, cx + half, cy + y, c);
    }
    return;
  }
  let x = r, y = 0, e = 1 - r;
  while (x >= y) {
    setPx(cx + x, cy + y, c); setPx(cx + y, cy + x, c);
    setPx(cx - y, cy + x, c); setPx(cx - x, cy + y, c);
    setPx(cx - x, cy - y, c); setPx(cx - y, cy - x, c);
    setPx(cx + y, cy - x, c); setPx(cx + x, cy - y, c);
    y++;
    if (e <= 0) e += 2 * y + 1;
    else { x--; e += 2 * (y - x) + 1; }
  }
}

// filled triangle by scanlines
function triangle(x0, y0, x1, y1, x2, y2, c) {
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    const edges = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const a = Math.ceil(Math.min(...xs)), b = Math.floor(Math.max(...xs));
      hline(a, b, y, c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 chars, '#' = ink. All-caps newspaper face.
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '.##..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '*': ['.#.#.', '..#..', '#####', '..#..', '.#.#.', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
};

function textWidth(s, scale, spacing) {
  if (!s) return 0;
  return s.length * (5 * scale + spacing) - spacing;
}

function drawText(s, x, y, scale, c, spacing = null) {
  const sp = spacing === null ? scale : spacing;
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 5 * scale + sp;
  }
}

function drawTextCentered(s, cx, y, scale, c, spacing = null) {
  drawText(s, cx - Math.floor(textWidth(s, scale, spacing === null ? scale : spacing) / 2), y, scale, c, spacing);
}

// greedy word wrap to lines of at most maxChars characters
function wrap(s, maxChars) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 231];
const NAVY = [16, 36, 62];
const GOLD = [201, 162, 39];
const RED = [179, 38, 30];
const INK = [26, 26, 26];
const WHITE = [255, 255, 255];
const TEAL = [14, 110, 110];
const GREEN = [27, 122, 62];
const LIGHT = [232, 226, 214];

// ---------------------------------------------------------------- layout
fillRect(0, 0, W, H, PAPER);

// ---- masthead
fillRect(0, 0, W, 124, NAVY);
drawTextCentered('THE WORLD IN ONE DAY', W / 2, 18, 4, PAPER);
drawTextCentered('FRIDAY 20 NOVEMBER 2026', W / 2, 62, 5, GOLD);
fillRect(0, 124, W, 4, GOLD);

// ---- lead story: Trump, Xi, Putin summit in Shenzhen
const LX = 12, LY = 140, LW = 1000, LH = 296;
fillRect(LX, LY, LW, LH, WHITE);
for (let i = 0; i < 2; i++) {
  hline(LX, LX + LW - 1, LY + i, NAVY);
  hline(LX, LX + LW - 1, LY + LH - 1 - i, NAVY);
  vline(LX + i, LY, LY + LH - 1, NAVY);
  vline(LX + LW - 1 - i, LY, LY + LH - 1, NAVY);
}
drawText('SHENZHEN, CHINA - THE BIG PICTURE', LX + 24, LY + 20, 2, RED);
drawText('TRUMP, XI AND PUTIN', LX + 24, LY + 52, 5, NAVY);
drawText('MEET FACE TO FACE', LX + 24, LY + 98, 5, NAVY);
const leadBody = wrap('FIRST THREE-WAY SUMMIT OF THE LEADERS OF THE US, CHINA AND RUSSIA. JOINT DECLARATION ON THE UN, NUCLEAR ARMS AND OIL.', 34);
leadBody.forEach((ln, i) => drawText(ln, LX + 24, LY + 164 + i * 29, 3, INK));
// globe motif, right side
const GX = 880, GY = 288, GR = 72;
circle(GX, GY, GR, NAVY);
circle(GX, GY, GR - 2, NAVY);
line(GX - GR, GY, GX + GR, GY, NAVY);
line(GX, GY - GR, GX, GY + GR, NAVY);
for (const rx of [30, 58]) {
  for (let deg = 0; deg < 360; deg++) {
    const a = (deg * Math.PI) / 180;
    setPx(GX + Math.round(rx * Math.cos(a)), GY + Math.round(GR * Math.sin(a)), NAVY);
  }
}
circle(GX - 26, GY - 18, 5, RED, true);
circle(GX + 22, GY - 8, 5, GOLD, true);
circle(GX + 2, GY + 26, 5, TEAL, true);

// ---- four story panels, 2 x 2 grid
function panel(x, y, w, h, kicker, kickerColor, head1, head2, body, icon) {
  fillRect(x, y, w, h, WHITE);
  for (let i = 0; i < 2; i++) {
    hline(x, x + w - 1, y + i, NAVY);
    hline(x, x + w - 1, y + h - 1 - i, NAVY);
    vline(x + i, y, y + h - 1, NAVY);
    vline(x + w - 1 - i, y, y + h - 1, NAVY);
  }
  drawText(kicker, x + 18, y + 16, 2, kickerColor);
  drawText(head1, x + 18, y + 44, 4, NAVY);
  drawText(head2, x + 18, y + 82, 4, NAVY);
  const lines = wrap(body, 27);
  lines.forEach((ln, i) => drawText(ln, x + 18, y + 130 + i * 29, 3, INK));
  icon(x + w - 104, y + 14, 86);
}

function iconCyclone(x, y, s) {
  const cx = x + s / 2, cy = y + s / 2;
  for (const r of [34, 24, 14]) circle(cx, cy, r, TEAL);
  circle(cx, cy, 5, TEAL, true);
  line(cx - 34, cy + 40, cx + 34, cy + 40, TEAL, 2);
}

function iconScales(x, y, s) {
  const cx = x + s / 2, top = y + 6, base = y + s - 8;
  vline(cx, top, base, NAVY);
  hline(cx - 32, cx + 32, top + 4, NAVY);
  line(cx - 32, top + 4, cx - 32, top + 26, NAVY);
  line(cx + 32, top + 4, cx + 32, top + 26, NAVY);
  line(cx - 42, top + 26, cx - 22, top + 26, NAVY, 2);
  line(cx - 42, top + 26, cx - 32, top + 40, NAVY, 2);
  line(cx - 22, top + 26, cx - 32, top + 40, NAVY, 2);
  line(cx + 22, top + 26, cx + 42, top + 26, NAVY, 2);
  line(cx + 22, top + 26, cx + 32, top + 40, NAVY, 2);
  line(cx + 42, top + 26, cx + 32, top + 40, NAVY, 2);
  hline(cx - 26, cx + 26, base, NAVY);
  circle(cx, top - 2, 4, RED, true);
}

function iconChart(x, y, s) {
  const ox = x + 8, oy = y + s - 12;
  hline(ox, ox + 66, oy, GREEN);
  vline(ox, oy - 62, oy, GREEN);
  line(ox + 4, oy - 8, ox + 22, oy - 26, GREEN, 3);
  line(ox + 22, oy - 26, ox + 40, oy - 34, GREEN, 3);
  line(ox + 40, oy - 34, ox + 62, oy - 58, GREEN, 3);
  triangle(ox + 62, oy - 58, ox + 54, oy - 52, ox + 62, oy - 46, GREEN);
}

function iconSun(x, y, s) {
  const cx = x + s / 2, cy = y + 30;
  circle(cx, cy, 16, GOLD, true);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const x0 = cx + Math.floor(22 * Math.cos(a)), y0 = cy + Math.floor(22 * Math.sin(a));
    const x1 = cx + Math.floor(30 * Math.cos(a)), y1 = cy + Math.floor(30 * Math.sin(a));
    line(x0, y0, x1, y1, GOLD, 2);
  }
  hline(x + 10, x + 76, y + 70, TEAL);
  line(x + 30, y + 70, x + 36, y + 80, TEAL, 2);
  line(x + 56, y + 70, x + 52, y + 80, TEAL, 2);
}

const PW = 497, PH = 240;
const GX0 = 12, GY0 = 448;
panel(GX0, GY0, PW, PH, 'INDIA - WEATHER', RED, 'CYCLONE AKVAN', 'NEARS ODISHA',
  'LANDFALL EXPECTED TODAY ON THE ODISHA COAST. SCHOOLS SHUT, TRAINS CUT.', iconCyclone);
panel(GX0 + 503, GY0, PW, PH, 'THE HAGUE - JUSTICE', NAVY, 'MYANMAR GUILTY', 'OF GENOCIDE',
  'WORLD COURT RULES 9-6 IN THE ROHINGYA CASE, A FIRST FOR A STATE. COMPENSATION DUE.', iconScales);
panel(GX0, GY0 + 252, PW, PH, 'MARKETS - AI', GREEN, "ANTHROPIC'S", 'RECORD 81BN IPO',
  'CLAUDE MAKER DEBUTS AT ABOUT 1.5TN VALUE. US STOCKS FALL 2 PERCENT.', iconChart);
panel(GX0 + 503, GY0 + 252, PW, PH, 'PACIFIC - CLIMATE', TEAL, 'FIJI DECLARES', 'DROUGHT DISASTER',
  'NATIONAL EMERGENCY AS EL NINO DRIES UP WATER SUPPLIES ACROSS THE ISLANDS.', iconSun);

// ---- sport strip
fillRect(0, 952, W, 72, NAVY);
drawText('SPORT: NICHOLLS 113* AS NZ REACH 243-5', 24, 960, 3, PAPER, 2);
drawText('INDIA BEAT PAKISTAN 2-1 FOR 10TH SAFF TITLE', 24, 989, 3, GOLD, 2);

// ---------------------------------------------------------------- PNG encode
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    crc32.table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
