import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptFilePayload, packFileV2, packFileV3 } from './format.js';
import {
	LEGACY_V1_FIXTURE_FIXED_SALT,
	LEGACY_V1_FIXTURE_PASSPHRASE,
	LEGACY_V1_FIXTURE_PAYLOAD,
	LEGACY_V1_FIXTURE_STEM_SALT,
	LEGACY_V1_PLAIN_FIXED,
	LEGACY_V1_PLAIN_STEM
} from './legacy/fixtures.js';

const DEVICE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const OTHER_DEVICE_KEY = '//////////////////////////////////////////w=';
const APP_DIR = '/data/user/0/com.peterjohnarao.heda';
const DIR = `${APP_DIR}/projects`;
const PICKED = 'content://com.android.providers.downloads.documents/document/msf%3A1000001234';

// An in-memory stand-in for the fs plugin: files by absolute path (or URI).
const { fs, open_dialog, invoke_mock, legacy_config } = vi.hoisted(() => ({
	fs: {
		files: new Map<string, { bytes: Uint8Array; mtime: Date | null }>(),
		dirs: new Set<string>(),
		handles: [] as { closed: boolean }[],
		fail_open: false
	},
	open_dialog: vi.fn(),
	invoke_mock: vi.fn(),
	legacy_config: vi.fn()
}));

vi.mock('@tauri-apps/api/path', () => ({ appLocalDataDir: async () => APP_DIR }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invoke_mock }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: open_dialog }));
vi.mock('#lib/helpers/security/device-key.js', () => ({ getDeviceKey: async () => DEVICE_KEY }));
vi.mock('./legacy/credentials.js', () => ({ getLegacyV1Config: legacy_config }));
vi.mock('./index.js', () => ({ EXTENSION: 'heda' }));
vi.mock('@tauri-apps/plugin-fs', () => ({
	mkdir: vi.fn(async (path: string) => void fs.dirs.add(path)),
	readDir: vi.fn(async (dir: string) => {
		const inside = (path: string) =>
			path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/');
		return [
			...[...fs.files.keys()].filter(inside).map((path) => ({ path, isFile: true })),
			...[...fs.dirs].filter(inside).map((path) => ({ path, isFile: false }))
		].map(({ path, isFile }) => ({
			name: path.slice(dir.length + 1),
			isFile,
			isDirectory: !isFile,
			isSymlink: false
		}));
	}),
	stat: vi.fn(async (path: string) => {
		const file = fs.files.get(path);
		if (!file) throw new Error(`${path}: not found`);
		return { mtime: file.mtime, size: file.bytes.length };
	}),
	remove: vi.fn(async (path: string) => {
		if (!fs.files.delete(path)) throw new Error(`${path}: not found`);
	}),
	writeFile: vi.fn(async (path: string, bytes: Uint8Array, options?: { createNew?: boolean }) => {
		if (options?.createNew && fs.files.has(path)) throw new Error(`${path}: exists`);
		fs.files.set(path, { bytes, mtime: new Date() });
	}),
	open: vi.fn(async (path: string) => {
		const file = fs.files.get(path);
		if (fs.fail_open || !file) throw new Error(`${path}: cannot open`);
		const handle = { closed: false };
		fs.handles.push(handle);
		let offset = 0;
		return {
			read: async (buffer: Uint8Array) => {
				if (offset >= file.bytes.length) return null;
				const chunk = file.bytes.subarray(offset, offset + buffer.length);
				buffer.set(chunk);
				offset += chunk.length;
				return chunk.length;
			},
			close: async () => void (handle.closed = true)
		};
	})
}));

import {
	IMPORTED_PROJECT_NAME,
	IMPORT_SIZE_LIMIT,
	deleteLibraryProject,
	importIntoLibrary,
	importedProjectName,
	listLibraryProjects,
	newLibraryFile,
	prepareImport,
	readCapped,
	sanitizeProjectName,
	uniqueProjectFileName
} from './library.js';

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array | string) =>
	typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);

function put(path: string, contents: string | Uint8Array, mtime: Date | null = new Date(0)) {
	fs.files.set(path, { bytes: typeof contents === 'string' ? encode(contents) : contents, mtime });
}

function pick(uri: string, contents: string | Uint8Array, info: object = {}) {
	put(uri, contents);
	open_dialog.mockResolvedValue(uri);
	invoke_mock.mockResolvedValue(info);
}

beforeEach(() => {
	fs.files.clear();
	fs.dirs.clear();
	fs.handles.length = 0;
	fs.fail_open = false;
	vi.clearAllMocks();
	legacy_config.mockReturnValue({
		passphrase: LEGACY_V1_FIXTURE_PASSPHRASE,
		salt: LEGACY_V1_FIXTURE_FIXED_SALT
	});
});

describe('sanitizeProjectName', () => {
	it('keeps an ordinary name', () => {
		expect(sanitizeProjectName('Building A - 3rd floor')).toBe('Building A - 3rd floor');
	});

	it('replaces characters that are unsafe in a file name', () => {
		expect(sanitizeProjectName('A/B\\C:D*E?F"G<H>I|J')).toBe('A-B-C-D-E-F-G-H-I-J');
	});

	it('collapses whitespace, tabs and line breaks into single spaces', () => {
		expect(sanitizeProjectName('  Main\t\tpanel\n\rboard  ')).toBe('Main panel board');
	});

	it('drops control characters', () => {
		expect(sanitizeProjectName('Panel\u0000\u0007A')).toBe('Panel--A');
	});

	it('strips leading dots and trailing dots or spaces', () => {
		expect(sanitizeProjectName('..hidden..  ')).toBe('hidden');
	});

	it('returns an empty name when nothing usable is left', () => {
		expect(sanitizeProjectName(' . .. ')).toBe('');
		expect(sanitizeProjectName('')).toBe('');
	});

	it('caps the length by code point without splitting an emoji', () => {
		// U+1F50C is a surrogate pair: a cut by UTF-16 unit would leave half of one.
		const name = sanitizeProjectName('🔌'.repeat(102));
		expect(Array.from(name)).toHaveLength(100);
		expect(name).toBe('🔌'.repeat(100));
	});

	it('strips a trailing space the length cap leaves behind', () => {
		expect(sanitizeProjectName(`${'a'.repeat(99)} b`)).toBe('a'.repeat(99));
	});
});

describe('uniqueProjectFileName', () => {
	it('uses the plain name when it is free', () => {
		expect(uniqueProjectFileName('Plan', ['Other.heda'])).toBe('Plan.heda');
	});

	it('numbers the name past every taken one', () => {
		expect(uniqueProjectFileName('Plan', ['Plan.heda', 'Plan-(1).heda'])).toBe('Plan-(2).heda');
	});

	it('treats names that differ only in case as taken', () => {
		expect(uniqueProjectFileName('Plan', ['PLAN.HEDA'])).toBe('Plan-(1).heda');
	});
});

describe('importedProjectName', () => {
	it("prefers the provider's display name, without the extension", () => {
		expect(importedProjectName('Mall Expansion.HEDA', PICKED)).toBe('Mall Expansion');
	});

	it('drops the .txt or .bin Android adds after .heda (#371)', () => {
		expect(importedProjectName('northpoint-cold-storage.heda.txt', PICKED)).toBe(
			'northpoint-cold-storage'
		);
		expect(importedProjectName('Plan.HEDA.TXT', PICKED)).toBe('Plan');
		expect(importedProjectName('Plan.heda.bin', PICKED)).toBe('Plan');
		const external =
			'content://com.android.externalstorage.documents/document/primary%3ADownload%2FPanel%20C.heda.txt';
		expect(importedProjectName(null, external)).toBe('Panel C');
	});

	it('keeps a .txt that does not follow .heda', () => {
		expect(importedProjectName('notes.txt', PICKED)).toBe('notes.txt');
	});

	it('keeps a display name that has no extension', () => {
		expect(importedProjectName('Mall Expansion', PICKED)).toBe('Mall Expansion');
	});

	it('sanitizes the display name', () => {
		expect(importedProjectName('Mall: Phase 1/2.heda', PICKED)).toBe('Mall- Phase 1-2');
	});

	it('reads the name from a document id that embeds the path', () => {
		const external =
			'content://com.android.externalstorage.documents/document/primary%3ADownload%2FPanel%20A.heda';
		const raw =
			'content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2FPanel%20B.heda';
		expect(importedProjectName(null, external)).toBe('Panel A');
		expect(importedProjectName(undefined, raw)).toBe('Panel B');
	});

	it('falls back to a generic name for an opaque document id', () => {
		expect(importedProjectName(null, PICKED)).toBe(IMPORTED_PROJECT_NAME);
		expect(importedProjectName('', 'content://media/external/file/1234')).toBe(
			IMPORTED_PROJECT_NAME
		);
	});

	it('falls back past a display name that sanitizes to nothing', () => {
		const external =
			'content://com.android.externalstorage.documents/document/primary%3ADownload%2FPanel.heda';
		expect(importedProjectName(' .. ', external)).toBe('Panel');
	});

	it('survives a stray percent sign and an unparsable URI', () => {
		// `%ZZ` makes the segment undecodable, so it is kept as it is.
		expect(importedProjectName(null, 'content://x/document/100%25%2Fbad%ZZ.heda')).toBe(
			'100%25%2Fbad%ZZ'
		);
		expect(importedProjectName(null, 'not a uri')).toBe(IMPORTED_PROJECT_NAME);
	});
});

describe('library folder', () => {
	it('creates the folder and lists projects newest first, skipping everything else', async () => {
		put(`${DIR}/Old.heda`, 'x', new Date('2026-01-01'));
		put(`${DIR}/New.heda`, 'x', new Date('2026-06-01'));
		put(`${DIR}/New.heda.v2.bak`, 'x');
		put(`${DIR}/New.heda.v3.tmp`, 'x');
		put(`${DIR}/notes.txt`, 'x');
		fs.dirs.add(`${DIR}/folder.heda`);
		put(`${APP_DIR}/heda-d`, 'key');

		const projects = await listLibraryProjects();

		expect(fs.dirs.has(DIR)).toBe(true);
		expect(projects).toEqual([
			{ name: 'New', path: `${DIR}/New.heda`, modified: new Date('2026-06-01') },
			{ name: 'Old', path: `${DIR}/Old.heda`, modified: new Date('2026-01-01') }
		]);
	});

	it('sorts files without a modification time last, by name', async () => {
		put(`${DIR}/b.heda`, 'x', null);
		put(`${DIR}/a.heda`, 'x', null);
		put(`${DIR}/c.heda`, 'x', new Date('2026-01-01'));
		expect((await listLibraryProjects()).map((project) => project.name)).toEqual(['c', 'a', 'b']);
	});

	it('picks a free, sanitized path for a new project', async () => {
		put(`${DIR}/Plan.heda`, 'x');
		await expect(newLibraryFile('  Plan ')).resolves.toBe(`${DIR}/Plan-(1).heda`);
		await expect(newLibraryFile('a/b')).resolves.toBe(`${DIR}/a-b.heda`);
		await expect(newLibraryFile(' .. ')).resolves.toBe(`${DIR}/Untitled project.heda`);
	});

	it('deletes a project with its backups, but no other project', async () => {
		put(`${DIR}/Plan.heda`, 'x');
		put(`${DIR}/Plan.heda.v2.bak`, 'x');
		put(`${DIR}/Plan.heda.v2.bak.1`, 'x');
		put(`${DIR}/Plan.heda.final.heda`, 'x');
		put(`${DIR}/Planning.heda`, 'x');

		await deleteLibraryProject(`${DIR}/Plan.heda`);

		expect([...fs.files.keys()].sort()).toEqual([
			`${DIR}/Plan.heda.final.heda`,
			`${DIR}/Planning.heda`
		]);
	});

	it('refuses to delete anything outside the folder', async () => {
		put(`${APP_DIR}/heda-d`, 'key');
		put(`${DIR}/sub/Plan.heda`, 'x');
		put(`${DIR}/notes.txt`, 'x');
		for (const path of [
			`${APP_DIR}/heda-d`,
			`${DIR}/sub/Plan.heda`,
			`${DIR}/notes.txt`,
			`${DIR}/../heda-d`,
			`${DIR}-evil/Plan.heda`
		]) {
			await expect(deleteLibraryProject(path)).rejects.toThrow('Only a project');
		}
		expect(fs.files.size).toBe(3);
	});
});

describe('readCapped', () => {
	it('reads a file larger than one chunk exactly, then closes it', async () => {
		const bytes = new Uint8Array(2.5 * 1024 * 1024).map((_, i) => i % 251);
		put('content://big', bytes);
		const read = await readCapped('content://big', IMPORT_SIZE_LIMIT);
		// Byte compare: a deep toEqual over 2.5M elements takes seconds under load.
		expect(read?.length).toBe(bytes.length);
		expect(read?.every((byte, i) => byte === bytes[i])).toBe(true);
		expect(fs.handles).toEqual([{ closed: true }]);
	});

	it('reads an empty file', async () => {
		put('content://empty', '');
		await expect(readCapped('content://empty', 10)).resolves.toEqual(new Uint8Array());
	});

	it('stops at the limit and still closes the file', async () => {
		put('content://huge', new Uint8Array(11));
		await expect(readCapped('content://huge', 10)).resolves.toBeNull();
		await expect(readCapped('content://huge', 11)).resolves.toHaveLength(11);
		expect(fs.handles.every((handle) => handle.closed)).toBe(true);
	});
});

describe('prepareImport', () => {
	it('keeps a whole password-protected file as it is', async () => {
		const bytes = encode(await packFileV2({ a: 1 }, 'correct horse'));
		await expect(prepareImport(bytes, 'Plan.heda')).resolves.toBe(bytes);
	});

	it('rejects a cut-off password-protected file', async () => {
		const raw = await packFileV2({ a: 1 }, 'correct horse');
		await expect(prepareImport(encode(raw.slice(0, 40)), 'Plan.heda')).resolves.toBe('invalid');
	});

	it("keeps a file sealed with this device's key", async () => {
		const bytes = encode(await packFileV3({ a: 1 }, DEVICE_KEY));
		await expect(prepareImport(bytes, 'Plan.heda')).resolves.toBe(bytes);
	});

	it("rejects a file sealed with another device's key", async () => {
		const bytes = encode(await packFileV3({ a: 1 }, OTHER_DEVICE_KEY));
		await expect(prepareImport(bytes, 'Plan.heda')).resolves.toBe('other_device');
	});

	it('rejects bytes that are no HEDA file at all', async () => {
		await expect(prepareImport(encode('%PDF-1.7 ...'), 'scan.pdf')).resolves.toBe('invalid');
		await expect(prepareImport(new Uint8Array(), '')).resolves.toBe('invalid');
	});

	it('upgrades a legacy file to device encryption in memory', async () => {
		const prepared = await prepareImport(encode(LEGACY_V1_PLAIN_FIXED), 'Anything.heda');
		expect(prepared).toBeInstanceOf(Uint8Array);
		await expect(
			decryptFilePayload(decode(prepared as Uint8Array), null, DEVICE_KEY)
		).resolves.toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
		expect(fs.files.size).toBe(0);
	});

	it('upgrades a legacy file keyed to its original name', async () => {
		const prepared = await prepareImport(
			encode(LEGACY_V1_PLAIN_STEM),
			`${LEGACY_V1_FIXTURE_STEM_SALT}.heda`
		);
		await expect(
			decryptFilePayload(decode(prepared as Uint8Array), null, DEVICE_KEY)
		).resolves.toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
	});

	it('cannot upgrade a name-keyed legacy file once the name is lost', async () => {
		await expect(prepareImport(encode(LEGACY_V1_PLAIN_STEM), '')).resolves.toBe('legacy_failed');
	});

	it('rejects a legacy file when the build has no legacy keys', async () => {
		legacy_config.mockReturnValue(null);
		await expect(prepareImport(encode(LEGACY_V1_PLAIN_FIXED), 'Plan.heda')).resolves.toBe(
			'legacy_unsupported'
		);
	});
});

describe('importIntoLibrary', () => {
	it('does nothing when the picker is cancelled', async () => {
		open_dialog.mockResolvedValue(null);
		await expect(importIntoLibrary()).resolves.toEqual({ status: 'cancelled' });
		expect(invoke_mock).not.toHaveBeenCalled();
	});

	it("copies a valid file under the provider's name", async () => {
		const raw = await packFileV3({ a: 1 }, DEVICE_KEY);
		pick(PICKED, raw, { name: 'Mall.heda', size: raw.length });

		await expect(importIntoLibrary()).resolves.toEqual({
			status: 'imported',
			path: `${DIR}/Mall.heda`
		});
		expect(invoke_mock).toHaveBeenCalledWith('document_info', { uri: PICKED });
		expect(decode(fs.files.get(`${DIR}/Mall.heda`)!.bytes)).toBe(raw);
	});

	it('never overwrites a project with the same name', async () => {
		const raw = await packFileV2({ a: 1 }, 'correct horse');
		put(`${DIR}/Mall.heda`, 'mine');
		pick(PICKED, raw, { name: 'Mall.heda' });

		await expect(importIntoLibrary()).resolves.toEqual({
			status: 'imported',
			path: `${DIR}/Mall-(1).heda`
		});
		expect(decode(fs.files.get(`${DIR}/Mall.heda`)!.bytes)).toBe('mine');
	});

	it('falls back to a generic name when the provider cannot answer', async () => {
		const raw = await packFileV2({ a: 1 }, 'correct horse');
		pick(PICKED, raw);
		invoke_mock.mockRejectedValue(new Error('no such command'));

		await expect(importIntoLibrary()).resolves.toEqual({
			status: 'imported',
			path: `${DIR}/${IMPORTED_PROJECT_NAME}.heda`
		});
	});

	it('stores an upgraded copy of a legacy file, keyed by its original name', async () => {
		pick(PICKED, LEGACY_V1_PLAIN_STEM, { name: `${LEGACY_V1_FIXTURE_STEM_SALT}.heda` });

		const result = await importIntoLibrary();

		expect(result).toEqual({ status: 'imported', path: `${DIR}/Legacy Project.heda` });
		const stored = decode(fs.files.get(`${DIR}/Legacy Project.heda`)!.bytes);
		await expect(decryptFilePayload(stored, null, DEVICE_KEY)).resolves.toEqual(
			LEGACY_V1_FIXTURE_PAYLOAD
		);
		expect(decode(fs.files.get(PICKED)!.bytes)).toBe(LEGACY_V1_PLAIN_STEM);
	});

	it('rejects a file the provider reports as too large without reading it', async () => {
		pick(PICKED, 'x', { name: 'movie.mp4', size: IMPORT_SIZE_LIMIT + 1 });
		await expect(importIntoLibrary()).resolves.toEqual({ status: 'rejected', reason: 'too_large' });
		expect(fs.handles).toHaveLength(0);
	});

	it('rejects a file that turns out too large while reading', async () => {
		pick(PICKED, new Uint8Array(IMPORT_SIZE_LIMIT + 1), { name: 'movie.mp4', size: null });
		await expect(importIntoLibrary()).resolves.toEqual({ status: 'rejected', reason: 'too_large' });
		expect(fs.handles.every((handle) => handle.closed)).toBe(true);
	});

	it('rejects an unreadable file', async () => {
		pick(PICKED, 'x', { name: 'Plan.heda' });
		fs.fail_open = true;
		await expect(importIntoLibrary()).resolves.toEqual({
			status: 'rejected',
			reason: 'unreadable'
		});
	});

	it('copies nothing for a file it rejects', async () => {
		pick(PICKED, await packFileV3({ a: 1 }, OTHER_DEVICE_KEY), { name: 'Plan.heda' });
		await expect(importIntoLibrary()).resolves.toEqual({
			status: 'rejected',
			reason: 'other_device'
		});
		expect([...fs.files.keys()]).toEqual([PICKED]);
	});
});
