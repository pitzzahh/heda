import { invoke } from '@tauri-apps/api/core';

// Vitest runs without a Tauri backend, so it reaches the same engine through its WASM
// build (`bun run core`, initialized in vitest-setup.ts). Every other build calls the
// native engine through Tauri: `MODE` is fixed at build time, so the WASM never ships.
const wasm_loaders = import.meta.env.MODE === 'test' ? import.meta.glob('./pkg/heda_core.js') : {};

type WasmEngine = {
	dispatch_json: (command: string, args: string) => string;
	dispatch_file: (command: string, args: string) => Uint8Array;
};

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

/**
 * Writes one file in the engine (`dispatch_file` in `crates/heda-core/src/dispatch.rs`)
 * through the Tauri `heda_file` command, and answers its bytes. It starts once every
 * call made before it has answered, so the file has every write sent before it, but it
 * does not join the queue: the engine builds it on a copy of the session, and the calls
 * made after it do not wait for the build.
 */
export async function engineFile(command: string, args: object = {}): Promise<Uint8Array> {
	await queue;
	const load_wasm = Object.values(wasm_loaders)[0];
	if (!load_wasm) return new Uint8Array(await invoke<ArrayBuffer>('heda_file', { command, args }));
	const { dispatch_file } = (await load_wasm()) as WasmEngine;
	return dispatch_file(command, JSON.stringify(args));
}
