import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');

const read = (path) => readFile(resolve(root, path), 'utf8');
const escapeInlineScript = (source) => source.replaceAll('</script', '<\\/script');
const fingerprint = (source) => createHash('sha256').update(source).digest('hex').slice(0, 10);
const mediaOrigins = [
  'https://portfolio-ten-umber-3z9vgkulzy.vercel.app',
  'https://www.g0faq.ru.',
  'https://portfolio-ten-umber-3z9vgkulzy.vercel.app.',
  'https://portfolio-ten-umber-3z9vgkulzy.vercel.app',
  'https://g0faq.ru',
  'https://www.g0faq.ru',
  'https://g0faq.ru.'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp(resolve(root, 'assets'), resolve(output, 'assets'), { recursive: true }),
  cp(resolve(root, 'data'), resolve(output, 'data'), { recursive: true }),
  mkdir(resolve(output, 'css'), { recursive: true }),
  mkdir(resolve(output, 'js'), { recursive: true })
]);

let html = await read('index.html');
const [css, calculatorConfig, casesData, ...appScripts] = await Promise.all([
  read('css/main.css'),
  read('js/calculator-config.js'),
  read('data/cases.json'),
  read('js/calculator.js'),
  read('js/main.js')
]);
const parsedCases = JSON.parse(casesData);
const appSource = appScripts.join('\n');
const cssName = `main.${fingerprint(css)}.css`;
const appName = `app.${fingerprint(appSource)}.js`;
const imagePaths = parsedCases.flatMap((item) => Object.values(item.imageWebp || {}));
const imageBuffers = await Promise.all(
  imagePaths.map((path) => readFile(resolve(root, path.replace(/^\//, ''))))
);
const imageVersion = fingerprint(Buffer.concat(imageBuffers));

const stylesheetPattern = /\s*<link id="main-styles"[^>]*>\s*<noscript><link rel="stylesheet" href="\/css\/main\.css"><\/noscript>/;
const recoveryPattern = /\s*<script id="style-recovery">[\s\S]*?<\/script>/;
const externalScriptPattern = /\s*<script src="\/js\/(?:calculator-config|calculator|main)\.js" defer><\/script>/g;

if (!stylesheetPattern.test(html) || !recoveryPattern.test(html)) {
  throw new Error('Не удалось найти подключения стилей для production-сборки');
}

html = html
  .replace(
    stylesheetPattern,
    `\n    <link rel="preconnect" href="https://www.g0faq.ru">\n` +
    `    <link rel="preconnect" href="https://portfolio-ten-umber-3z9vgkulzy.vercel.app">\n` +
    `    <link id="main-styles" rel="stylesheet" href="https://www.g0faq.ru/css/${cssName}" fetchpriority="high">`
  )
  .replace(recoveryPattern, '')
  .replace(externalScriptPattern, '');

const bootstrap = `${calculatorConfig}\nwindow.CASES_DATA = ${casesData.trim()};\nwindow.CASE_MEDIA_ORIGINS = ${JSON.stringify(mediaOrigins)};\nwindow.CASE_ASSET_VERSION = '${imageVersion}';`;
const scripts = [
  `<script>\n${escapeInlineScript(bootstrap)}\n</script>`,
  `<script src="https://portfolio-ten-umber-3z9vgkulzy.vercel.app/js/${appName}" fetchpriority="high" defer></script>`
].join('\n');

if (!html.includes('</head>')) {
  throw new Error('Не удалось найти закрывающий тег head');
}

html = html.replace('</head>', `    ${scripts}\n  </head>`);
await writeFile(resolve(output, 'index.html'), html);
await Promise.all([
  writeFile(resolve(output, 'css', cssName), css),
  writeFile(resolve(output, 'js', appName), appSource)
]);
