// One random key per installation. Device-encrypted `.heda` files are sealed
// with this key, so opening/saving never asks for a password. The key is a
// local secret: it protects files from casual reading and other OS users, but
// anyone who can run code as this user can read it. Use a password-protected
// copy when a file has to leave this device.
import { invoke, isTauri } from '@tauri-apps/api/core';
import { base64ToBytes, bytesToBase64 } from './index.js';

const WEB_KEY = 'heda-device-key';
const KEY_BYTES = 32;

let cached: Promise<string> | null = null;
let memory_key: string | null = null;

function web_storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

function validate(key: string): string {
	try {
		if (base64ToBytes(key).length === KEY_BYTES) return key;
	} catch {
		// Fall through to the shared error below.
	}
	throw new Error('The device key is missing or damaged.');
}

function create(): string {
	return bytesToBase64(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

async function loadOrCreate(): Promise<string> {
	if (isTauri()) {
		const stored = await invoke<string | null>('load_device_key');
		if (stored) return validate(stored);
		const key = create();
		await invoke('store_device_key', { key });
		return key;
	}

	const storage = web_storage();
	const stored = storage?.getItem(WEB_KEY) ?? memory_key;
	if (stored) return validate(stored);

	const key = create();
	memory_key = key;
	try {
		storage?.setItem(WEB_KEY, key);
	} catch {
		// Private mode: keep the key for this page session only.
	}
	return key;
}

export function getDeviceKey(): Promise<string> {
	if (!cached) {
		cached = loadOrCreate().catch((err) => {
			cached = null;
			throw err;
		});
	}
	return cached;
}

/** Test helper: drop the in-memory copy so the next call reloads or recreates. */
export function resetDeviceKeyCache(): void {
	cached = null;
	memory_key = null;
}
