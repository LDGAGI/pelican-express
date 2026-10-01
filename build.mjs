#!/usr/bin/env node
/* Inline every source file into one self-contained dist/index.html */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

const files = (await readdir(join(src, 'js'))).filter((f) => f.endsWith('.js')).sort();
const parts = [];
for (const f of files) {
  const full = join(src, 'js', f);
  execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
  const body = await readFile(full, 'utf8');
  parts.push(`\n/* ─────────── ${f} ─────────── */\n${body.trimEnd()}\n`);
}
const js = parts.join('\n');
const css = await readFile(join(src, 'style.css'), 'utf8');
let html = await readFile(join(src, 'index.template.html'), 'utf8');

if (js.includes('</script')) throw new Error('JS contains a literal </script>');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

await mkdir(dist, { recursive: true });
await writeFile(join(dist, 'index.html'), html, 'utf8');

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`built dist/index.html  ${kb} KB  from ${files.length} modules`);
console.log(files.map((f) => '  · ' + f).join('\n'));
