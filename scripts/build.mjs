import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');

const read = (path) => readFile(resolve(root, path), 'utf8');
const escapeInlineScript = (source) => source.replaceAll('</script', '<\\/script');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp(resolve(root, 'assets'), resolve(output, 'assets'), { recursive: true }),
  cp(resolve(root, 'data'), resolve(output, 'data'), { recursive: true })
]);

let html = await read('index.html');
const css = await read('css/main.css');
const scripts = await Promise.all([
  read('js/calculator-config.js'),
  read('js/calculator.js'),
  read('js/main.js')
]);

const stylesheetPattern = /\s*<link id="main-styles"[^>]*>\s*<noscript><link rel="stylesheet" href="\/css\/main\.css"><\/noscript>/;
const recoveryPattern = /\s*<script id="style-recovery">[\s\S]*?<\/script>/;
const externalScriptPattern = /\s*<script src="\/js\/(?:calculator-config|calculator|main)\.js" defer><\/script>/g;

if (!stylesheetPattern.test(html) || !recoveryPattern.test(html)) {
  throw new Error('Не удалось найти подключения стилей для production-сборки');
}

html = html
  .replace(stylesheetPattern, `\n    <style id="main-styles">\n${css}\n    </style>`)
  .replace(recoveryPattern, '')
  .replace(externalScriptPattern, '');

const inlineScripts = scripts
  .map((source) => `<script>\n${escapeInlineScript(source)}\n</script>`)
  .join('\n');

if (!html.includes('</body>')) {
  throw new Error('Не удалось найти закрывающий тег body');
}

html = html.replace('</body>', `  ${inlineScripts}\n  </body>`);
await writeFile(resolve(output, 'index.html'), html);
