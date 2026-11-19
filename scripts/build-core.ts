/**
 * Builds the Rust calculation engine (`crates/heda-core`) to WebAssembly and
 * writes its JavaScript bindings to `src/lib/core/pkg/` (gitignored), for vitest.
 *
 * Runs before `test` and `check`. Needs the `wasm32-unknown-unknown` target and
 * `wasm-bindgen-cli` at exactly the version the crate pins, because the CLI and
 * the crate must agree on the ABI.
 *
 * Run: `bun scripts/build-core.ts`
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(new URL('.', import.meta.url).pathname, '..');
const CRATE = join(ROOT, 'crates/heda-core');
const OUT_DIR = join(ROOT, 'src/lib/core/pkg');
const WASM = join(CRATE, 'target/wasm32-unknown-unknown/release/heda_core.wasm');
const BINDINGS = join(OUT_DIR, 'heda_core.js');

const manifest = readFileSync(join(CRATE, 'Cargo.toml'), 'utf8');
const pinned = manifest.match(/^wasm-bindgen = \{ version = "=([^"]+)"/m)?.[1];
if (!pinned)
	throw new Error('crates/heda-core/Cargo.toml must pin wasm-bindgen exactly ("=x.y.z").');

let installed = '';
try {
	installed = execFileSync('wasm-bindgen', ['--version'], { encoding: 'utf8' }).trim();
} catch {
	// not installed: reported below
}
if (installed !== `wasm-bindgen ${pinned}`) {
	console.error(
		`heda-core needs wasm-bindgen-cli ${pinned} (found: ${installed || 'none'}).\n` +
			`  rustup target add wasm32-unknown-unknown\n` +
			`  cargo install wasm-bindgen-cli --version ${pinned} --locked`
	);
	process.exit(1);
}

const run = (command: string, args: string[]) =>
	execFileSync(command, args, { stdio: 'inherit', cwd: ROOT });
run('cargo', [
	...['build', '--release', '--quiet', '--target', 'wasm32-unknown-unknown'],
	...['--features', 'wasm', '--manifest-path', join(CRATE, 'Cargo.toml')]
]);
run('wasm-bindgen', ['--target', 'web', '--out-dir', OUT_DIR, '--out-name', 'heda_core', WASM]);
// The generated JSDoc is not strict-clean; its types come from the `.d.ts` beside it.
writeFileSync(BINDINGS, `// @ts-nocheck\n${readFileSync(BINDINGS, 'utf8')}`);
