import { invoke } from '@tauri-apps/api/core';

// Vitest runs without a Tauri backend, so it reaches the same engine through its WASM
// build (`bun run core`, initialized in vitest-setup.ts). Every other build calls the
// native engine through Tauri: `MODE` is fixed at build time, so the WASM never ships.
const wasm_loaders = import.meta.env.MODE === 'test' ? import.meta.glob('./pkg/heda_core.js') : {};

type WasmEngine = { dispatch_json: (command: string, args: string) => string };

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs one engine command (`dispatch` in `crates/heda-core/src/dispatch.rs`) through the
 * Tauri `heda` command. Calls run one at a time in the order made, so a read always
 * sees every write sent before it.
 */
export function engine<T>(command: string, args: object = {}): Promise<T> {
	const call = queue.then(async () => {
		const load_wasm = Object.values(wasm_loaders)[0];
		if (!load_wasm) return invoke<T>('heda', { command, args });
		const { dispatch_json } = (await load_wasm()) as WasmEngine;
		return JSON.parse(dispatch_json(command, JSON.stringify(args))) as T;
	});
	queue = call.catch(() => undefined);
	return call;
}
