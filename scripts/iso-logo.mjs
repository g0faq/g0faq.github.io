/* Изометрический логотип «g0faq» для первого экрана.
 *
 * Буквы заданы пиксельной сеткой и стоят как объёмные блоки: лицевая грань
 * заштрихована, верх и правый бок уходят вглубь. Внутренние швы между
 * клетками не рисуются, поэтому каждая буква читается цельным блоком.
 *
 * Запуск: node scripts/iso-logo.mjs > img/g0faq-iso.svg
 * Результат вставляется в index.html inline — цвета берутся из CSS.
 * Каждая буква — ссылка на Telegram. */

const GLYPHS = {
  g: [
    '.....',
    '#####',
    '#...#',
    '#...#',
    '#####',
    '....#',
    '....#',
    '#####',
  ],
  0: [
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#...#',
    '#####',
    '.....',
    '.....',
  ],
  f: [
    '..###',
    '..#..',
    '#####',
    '..#..',
    '..#..',
    '..#..',
    '.....',
    '.....',
  ],
  a: [
    '.....',
    '#####',
    '....#',
    '#####',
    '#...#',
    '#####',
    '.....',
    '.....',
  ],
  q: [
    '.....',
    '#####',
    '#...#',
    '#...#',
    '#####',
    '....#',
    '....#',
    '....#',
  ],
};

const WORD = 'g0faq';
const GAP = 2;
const CELL = 18;
const DEPTH = 1.25;
const ROWS = 8;

// Буквы стоят вертикально: x — вдоль слова, z — высота, объём уходит вглубь (y).
const cells = new Set();
const letterOf = new Map();
let cursor = 0;
[...WORD].forEach((char, letter) => {
  const glyph = GLYPHS[char];
  glyph.forEach((row, r) => {
    [...row].forEach((mark, x) => {
      if (mark !== '#') return;
      const key = `${cursor + x},${ROWS - 1 - r}`;
      cells.add(key);
      letterOf.set(key, letter);
    });
  });
  cursor += glyph[0].length + GAP;
});
const has = (x, z) => cells.has(`${x},${z}`);

// Диметрия вместо строгой изометрии: слово идёт с лёгким наклоном (14°),
// а глубина уходит влево-вниз под 40°. Блок получается низким и широким.
const AX = (14 * Math.PI) / 180;
const AY = (40 * Math.PI) / 180;
const project = (x, y, z) => [
  (x * Math.cos(AX) - y * Math.cos(AY)) * CELL,
  (x * Math.sin(AX) + y * Math.sin(AY) - z) * CELL,
];

const all = [...cells].map((key) => key.split(',').map(Number));
const corners = all.flatMap(([x, z]) => [0, DEPTH].flatMap((y) => [
  project(x, y, z), project(x + 1, y, z), project(x, y, z + 1), project(x + 1, y, z + 1),
]));
const minX = Math.min(...corners.map((p) => p[0])) - 3;
const minY = Math.min(...corners.map((p) => p[1])) - 3;
const maxX = Math.max(...corners.map((p) => p[0])) + 3;
const maxY = Math.max(...corners.map((p) => p[1])) + 3;

const pt = (x, y, z) => {
  const [px, py] = project(x, y, z);
  return `${(px - minX).toFixed(1)},${(py - minY).toFixed(1)}`;
};
const poly = (cls, pts) => `<polygon class="${cls}" points="${pts.join(' ')}"/>`;
const seg = (a, b) => `M${a}L${b}`;

// Дальние клетки первыми: ближе к зрителю те, что правее и выше.
all.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);

const D = DEPTH;
const groups = [...WORD].map(() => []);
all.forEach(([x, z]) => {
  const shapes = groups[letterOf.get(`${x},${z}`)];
  const edges = [];

  // Верхняя грань — если сверху пусто.
  if (!has(x, z + 1)) {
    shapes.push(poly('iso-side iso-side--top', [pt(x, 0, z + 1), pt(x + 1, 0, z + 1), pt(x + 1, D, z + 1), pt(x, D, z + 1)]));
    edges.push(seg(pt(x, 0, z + 1), pt(x + 1, 0, z + 1)));
    if (!(has(x - 1, z) && !has(x - 1, z + 1))) edges.push(seg(pt(x, 0, z + 1), pt(x, D, z + 1)));
    if (!(has(x + 1, z) && !has(x + 1, z + 1))) edges.push(seg(pt(x + 1, 0, z + 1), pt(x + 1, D, z + 1)));
  }

  // Правая грань — если справа пусто.
  if (!has(x + 1, z)) {
    shapes.push(poly('iso-side iso-side--right', [pt(x + 1, 0, z), pt(x + 1, 0, z + 1), pt(x + 1, D, z + 1), pt(x + 1, D, z)]));
    edges.push(seg(pt(x + 1, 0, z), pt(x + 1, 0, z + 1)));
    if (!(has(x, z + 1) && !has(x + 1, z + 1))) edges.push(seg(pt(x + 1, 0, z + 1), pt(x + 1, D, z + 1)));
    if (!(has(x, z - 1) && !has(x + 1, z - 1))) edges.push(seg(pt(x + 1, 0, z), pt(x + 1, D, z)));
  }

  // Лицевая грань со штриховкой; контур — только по внешним краям буквы.
  shapes.push(poly('iso-face', [pt(x, D, z), pt(x + 1, D, z), pt(x + 1, D, z + 1), pt(x, D, z + 1)]));
  if (!has(x, z + 1)) edges.push(seg(pt(x, D, z + 1), pt(x + 1, D, z + 1)));
  if (!has(x, z - 1)) edges.push(seg(pt(x, D, z), pt(x + 1, D, z)));
  if (!has(x - 1, z)) edges.push(seg(pt(x, D, z), pt(x, D, z + 1)));
  if (!has(x + 1, z)) edges.push(seg(pt(x + 1, D, z), pt(x + 1, D, z + 1)));

  shapes.push(`<path class="iso-edge" d="${edges.join('')}"/>`);
});

const width = (maxX - minX).toFixed(0);
const height = (maxY - minY).toFixed(0);

process.stdout.write(`<svg class="iso-logo" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-label="g0faq — написать в Telegram">
<defs><pattern id="iso-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="5" class="iso-hatch-line"/></pattern></defs>
${groups.map((shapes, index) => `<a class="iso-link" href="https://t.me/g0_faq" target="_blank" rel="noreferrer" aria-label="Написать в Telegram @g0_faq"><g class="iso-letter" style="--l:${index}">${shapes.join('')}</g></a>`).join('\n')}
</svg>
`);
