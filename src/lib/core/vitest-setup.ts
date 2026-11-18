// Tests run in node (or jsdom), where the engine's `fetch` of its `.wasm` URL has
// nothing to serve it, so instantiate it from the bytes on disk instead. The path
// is from the repository root (vitest's root): under jsdom `import.meta.url` is not
// a file URL.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initSync } from './pkg/heda_core.js';

initSync({ module: readFileSync(join(process.cwd(), 'src/lib/core/pkg/heda_core_bg.wasm')) });
