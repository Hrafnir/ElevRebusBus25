import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const androidAssets = join(root, 'android/app/src/main/assets');

await mkdir(androidAssets, { recursive: true });
await rm(join(androidAssets, 'public'), { recursive: true, force: true });
await cp(join(root, 'android-web'), join(androidAssets, 'public'), { recursive: true });
await cp(join(root, 'capacitor.config.json'), join(androidAssets, 'capacitor.config.json'));
