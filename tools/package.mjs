// Release zip for the GitHub release: node tools/package.mjs [--build] [--version 1.0.0]
// Takes the committed files (git archive HEAD, so local server data never ships), optionally rebuilds web/dist from
// source, then strips what a server does not need: dev tools and the NUI source (both stay on GitHub).
// Writes release/yecoyz_bossmenu.zip with a yecoyz_bossmenu/ folder inside.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const NAME = 'yecoyz_bossmenu';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const REMOVE = [
  '.gitignore', 'web/.gitignore', '.github',
  'web/src', 'web/index.html', 'web/package.json', 'web/package-lock.json', 'web/vite.config.ts', 'web/tsconfig.json', // NUI source
  'tools', 'tests', 'dev', 'server/dev.lua', 'client/dev.lua', // dev tools
];

const run = (cmd, argv, cwd = root) => execFileSync(cmd, argv, { cwd, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' && cmd === 'npm' });

const manifest = run('git', ['show', 'HEAD:fxmanifest.lua']).toString(); // the committed version, like the files
const version = manifest.match(/^version\s+'([^']+)'/m)?.[1];
if (!version) throw new Error('no version in fxmanifest.lua');
const wanted = option('--version');
if (wanted && wanted !== version) throw new Error(`release ${wanted} but fxmanifest.lua says ${version}: bump the version first`);

if (flag('--build')) {
  run('npm', ['ci'], join(root, 'web'));
  run('npm', ['run', 'build'], join(root, 'web'));
}

// Stage the committed tree; the freshly built web/dist replaces the committed one when --build is given.
const work = mkdtempSync(join(tmpdir(), 'bm-package-'));
const stage = join(work, NAME);
mkdirSync(stage);
run('git', ['archive', '--format=tar', '-o', join(work, 'head.tar'), 'HEAD']);
run('tar', ['-xf', 'head.tar', '-C', NAME], work);
rmSync(join(work, 'head.tar'));
if (flag('--build')) {
  rmSync(join(stage, 'web/dist'), { recursive: true, force: true });
  cpSync(join(root, 'web/dist'), join(stage, 'web/dist'), { recursive: true });
}
for (const p of REMOVE) rmSync(join(stage, p), { recursive: true, force: true });

// The dev bridge is gone: drop it from the manifest and the config.
const edit = (file, pairs) => {
  let s = readFileSync(join(stage, file), 'utf8');
  for (const [from, to] of pairs) {
    if (!from.test(s)) throw new Error(`${file}: ${from} not found`);
    s = s.replace(from, to);
  }
  writeFileSync(join(stage, file), s);
};
edit('fxmanifest.lua', [[/\r?\n[ \t]*'server\/dev\.lua',/, ''], [/\r?\n[ \t]*'client\/dev\.lua',/, '']]);
edit('config.lua', [[/\r?\n[ \t]*-- Development bridge[^\r\n]*\r?\nConfig\.DevBridge = false[^\r\n]*/, '']]);

const left = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? left(join(dir, f)) : [join(dir, f)]));
const files = left(stage).map((f) => relative(work, f).split('\\').join('/')).sort();
for (const p of REMOVE) if (files.some((f) => f === `${NAME}/${p}` || f.startsWith(`${NAME}/${p}/`))) throw new Error(`${p} is still in the package`);
if (!files.includes(`${NAME}/web/dist/index.html`)) throw new Error('web/dist is missing: build the UI first');
if (/dev\.lua|DevBridge/.test(readFileSync(join(stage, 'fxmanifest.lua'), 'utf8') + readFileSync(join(stage, 'config.lua'), 'utf8'))) throw new Error('dev bridge still referenced');

// Plain zip writer (deflate, forward slashes), so the archive is the same on every machine.
const local = [], central = [];
let offset = 0;
for (const name of files) {
  const data = readFileSync(join(work, name));
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
  head.writeUInt16LE(0, 10); head.writeUInt16LE(0x21, 12); // fixed 1980-01-01 timestamp: same bytes for the same files
  head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(nameBuf.length, 26); head.writeUInt16LE(0, 28);
  local.push(head, nameBuf, packed);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10); entry.writeUInt16LE(0, 12); entry.writeUInt16LE(0x21, 14);
  entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBuf.length, 28); entry.writeUInt32LE(offset, 42);
  central.push(entry, nameBuf);
  offset += head.length + nameBuf.length + packed.length;
}
const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);

const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${NAME}.zip`);
writeFileSync(out, Buffer.concat([...local, ...central, end]));
rmSync(work, { recursive: true, force: true });
console.log(files.map((f) => '  ' + f).join('\n'));
console.log(`${relative(root, out)} ${version} (${files.length} files)`);
