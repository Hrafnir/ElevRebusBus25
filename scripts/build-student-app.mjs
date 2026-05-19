import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const outDir = join(root, 'android-web');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const indexSource = await readFile(join(root, 'public/student/index.html'), 'utf8');
const mobileIndex = indexSource
  .replace('<title>Elev - Rebus Platform</title>', '<title>Rebus Elev</title>')
  .replace('<link rel="stylesheet" href="../assets/app.css">', '<link rel="stylesheet" href="assets/app.css">')
  .replace('<a class="button ghost" href="../">Forside</a>', '')
  .replace('<script src="../config.js"></script>', '<script src="config.js"></script>');

await writeFile(join(outDir, 'index.html'), mobileIndex);
await cp(join(root, 'public/student/app.js'), join(outDir, 'app.js'));
await cp(join(root, 'public/config.js'), join(outDir, 'config.js'));
await cp(join(root, 'public/assets'), join(outDir, 'assets'), { recursive: true });
