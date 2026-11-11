import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	open_mock,
	write_mock,
	close_mock,
	read_file_mock,
	write_file_mock,
	exists_file_mock,
	remove_file_mock,
	getCurrentProject_mock,
	getAllChildNodes_mock,
	getSessionPassword_mock,
	getSessionProtection_mock,
	invoke_mock,
	load_current_project_mock
} = vi.hoisted(() => ({
	open_mock: vi.fn(),
	write_mock: vi.fn(),
	close_mock: vi.fn(),
	read_file_mock: vi.fn(),
	write_file_mock: vi.fn(),
	exists_file_mock: vi.fn(),
	remove_file_mock: vi.fn(),
	getCurrentProject_mock: vi.fn(),
	getAllChildNodes_mock: vi.fn(),
	getSessionPassword_mock: vi.fn(),
	getSessionProtection_mock: vi.fn(),
	invoke_mock: vi.fn(),
	load_current_project_mock: vi.fn()
}));
vi.mock('#lib/db/session.js', () => ({
	getSessionPassword: getSessionPassword_mock,
	setSessionPassword: vi.fn(),
	getSessionProtection: getSessionProtection_mock,
	setSessionProtection: vi.fn()
}));
vi.mock('#lib/helpers/security/device-key.js', () => ({
	getDeviceKey: vi.fn().mockResolvedValue('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	BaseDirectory: { Document: 1 },
	exists: exists_file_mock,
	open: open_mock,
	readFile: read_file_mock,
	writeFile: write_file_mock,
	remove: remove_file_mock
}));
vi.mock('#lib/db/queries/index.js', () => ({
	getCurrentProject: getCurrentProject_mock,
	getAllChildNodes: getAllChildNodes_mock
}));
vi.mock('#lib/db/mutations/index.js', () => ({ loadCurrentProject: load_current_project_mock }));
vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invoke_mock }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import {
	handleLoadFile,
	migrateHedaFile,
	saveCurrentProject,
	writeEncryptedFile
} from './index.js';
import { decryptFilePayload, packFileV3 } from './format.js';
import {
	LEGACY_V1_FIXTURE_FIXED_SALT,
	LEGACY_V1_FIXTURE_PASSPHRASE,
	LEGACY_V1_FIXTURE_PAYLOAD,
	LEGACY_V1_PLAIN_FIXED
} from './legacy/fixtures.js';
import { toast } from 'svelte-sonner';

const LEGACY_PATH = '/tmp/Legacy Project.heda';
const NEW_PASSWORD = 'new-file-password';
const DEVICE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function legacyBytes(): Uint8Array {
	return new TextEncoder().encode(LEGACY_V1_PLAIN_FIXED);
}

describe('writeEncryptedFile', () => {
	it('truncates on overwrite so no stale tail survives', async () => {
		open_mock.mockResolvedValue({ write: write_mock, close: close_mock });
		await writeEncryptedFile({ a: 1 }, 'pw', '/tmp/x.heda');
		expect(open_mock).toHaveBeenCalledWith(
			'/tmp/x.heda',
			expect.objectContaining({ truncate: true })
		);
	});

	it('creates new files exclusively', async () => {
		open_mock.mockResolvedValue({ write: write_mock, close: close_mock });
		await writeEncryptedFile({ a: 1 }, 'pw', '/tmp/x.heda', true);
		expect(open_mock).toHaveBeenCalledWith(
			'/tmp/x.heda',
			expect.objectContaining({ createNew: true, truncate: true })
		);
	});
});

describe('saveCurrentProject', () => {
	const undo_redo_state = { resetUnsavedActions: vi.fn() };

	beforeEach(() => {
		vi.clearAllMocks();
		open_mock.mockResolvedValue({ write: write_mock, close: close_mock });
		getCurrentProject_mock.mockReturnValue({ id: 'p1', root_node_id: 'n1' });
		getAllChildNodes_mock.mockReturnValue([{ id: 'n1' }]);
		getSessionPassword_mock.mockReturnValue('secret');
		getSessionProtection_mock.mockReturnValue('password');
	});

	it('writes the current project and clears the unsaved flag', async () => {
		await expect(saveCurrentProject('/tmp/x.heda', undo_redo_state)).resolves.toBe(true);
		expect(open_mock).toHaveBeenCalledWith(
			'/tmp/x.heda',
			expect.objectContaining({ truncate: true })
		);
		expect(undo_redo_state.resetUnsavedActions).toHaveBeenCalledTimes(1);
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('fails without a loaded project', async () => {
		getCurrentProject_mock.mockReturnValue(undefined);
		await expect(saveCurrentProject('/tmp/x.heda', undo_redo_state)).resolves.toBe(false);
		expect(open_mock).not.toHaveBeenCalled();
		expect(undo_redo_state.resetUnsavedActions).not.toHaveBeenCalled();
		expect(toast.warning).toHaveBeenCalledTimes(1);
	});

	it('fails without a session password', async () => {
		getSessionPassword_mock.mockReturnValue(null);
		await expect(saveCurrentProject('/tmp/x.heda', undo_redo_state)).resolves.toBe(false);
		expect(open_mock).not.toHaveBeenCalled();
		expect(undo_redo_state.resetUnsavedActions).not.toHaveBeenCalled();
		expect(toast.warning).toHaveBeenCalledTimes(1);
	});

	it('reports a failed write instead of clearing the unsaved flag', async () => {
		write_mock.mockRejectedValueOnce(new Error('disk full'));
		await expect(saveCurrentProject('/tmp/x.heda', undo_redo_state)).resolves.toBe(false);
		expect(undo_redo_state.resetUnsavedActions).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledTimes(1);
	});

	it('serializes overlapping saves', async () => {
		const [first, second] = await Promise.all([
			saveCurrentProject('/tmp/a.heda', undo_redo_state),
			saveCurrentProject('/tmp/b.heda', undo_redo_state)
		]);
		expect([first, second]).toEqual([true, true]);
		expect(open_mock.mock.calls.map(([path]) => path)).toEqual(['/tmp/a.heda', '/tmp/b.heda']);
		expect(undo_redo_state.resetUnsavedActions).toHaveBeenCalledTimes(2);
	});

	it('drops a queued save when another project took its place', async () => {
		getCurrentProject_mock.mockReturnValueOnce({ id: 'p1', root_node_id: 'n1' });
		getCurrentProject_mock.mockReturnValue({ id: 'p2', root_node_id: 'n2' });
		await expect(saveCurrentProject('/tmp/x.heda', undo_redo_state)).resolves.toBe(false);
		expect(open_mock).not.toHaveBeenCalled();
		expect(undo_redo_state.resetUnsavedActions).not.toHaveBeenCalled();
		expect(toast.warning).not.toHaveBeenCalled();
	});

	it('writes the snapshotted project when another loads mid-save', async () => {
		const writes: Uint8Array[] = [];
		let release_write: (() => void) | undefined;
		const write_started = new Promise<void>((resolve) => {
			write_mock.mockImplementation(async (bytes: Uint8Array) => {
				writes.push(bytes);
				resolve();
				await new Promise<void>((resolve_release) => (release_write = resolve_release));
			});
		});
		getCurrentProject_mock.mockReturnValue({
			id: 'p1',
			root_node_id: 'n1',
			project_name: 'Old Project'
		});
		getAllChildNodes_mock.mockReturnValue([{ id: 'n1' }]);

		const save = saveCurrentProject('/tmp/old.heda', undo_redo_state);
		await write_started;
		// Home cleared the old project and a new one loaded mid-write.
		getCurrentProject_mock.mockReturnValue({ id: 'p2', root_node_id: 'n2' });
		release_write?.();
		await expect(save).resolves.toBe(false);
		expect(undo_redo_state.resetUnsavedActions).not.toHaveBeenCalled();

		const written = await decryptFilePayload<{ project: { project_name: string } }>(
			new TextDecoder().decode(writes[0]),
			'secret'
		);
		expect(written.project.project_name).toBe('Old Project');
	});
});

function installFileSystem(entries: Record<string, Uint8Array>): Map<string, Uint8Array> {
	const files = new Map(Object.entries(entries));
	read_file_mock.mockImplementation(async (path: string) => {
		const bytes = files.get(path);
		if (!bytes) throw new Error(`ENOENT: ${path}`);
		return bytes;
	});
	write_file_mock.mockImplementation(async (path: string, bytes: Uint8Array) => {
		files.set(path, bytes.slice());
	});
	exists_file_mock.mockImplementation(async (path: string) => files.has(path));
	remove_file_mock.mockImplementation(async (path: string) => {
		files.delete(path);
	});
	return files;
}

describe('handleLoadFile', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		invoke_mock.mockResolvedValue('Project');
		load_current_project_mock.mockResolvedValue({ id: 'p1' });
	});

	it('reads an encrypted file exactly once', async () => {
		const path = '/tmp/device.heda';
		const raw = await packFileV3(
			{ project: { id: 'p1', project_name: 'Project' }, nodes: [] },
			DEVICE_KEY
		);
		installFileSystem({ [path]: new TextEncoder().encode(raw) });

		await expect(handleLoadFile(path)).resolves.toMatchObject({
			id: 'p1',
			project_name: 'Project',
			project_path: path,
			protection: 'device'
		});
		expect(read_file_mock).toHaveBeenCalledTimes(1);
		expect(load_current_project_mock).toHaveBeenCalledWith({
			project: { id: 'p1', project_name: 'Project' },
			nodes: []
		});
	});
});

describe('legacy v1 migration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
		vi.stubEnv('VITE_LEGACY_FILE_PASSPHRASE', LEGACY_V1_FIXTURE_PASSPHRASE);
		vi.stubEnv('VITE_LEGACY_FILE_SALT', LEGACY_V1_FIXTURE_FIXED_SALT);
	});

	it('asks the home page to migrate a legacy file', async () => {
		installFileSystem({ [LEGACY_PATH]: legacyBytes() });
		await expect(handleLoadFile(LEGACY_PATH)).resolves.toEqual({
			need_migration: true,
			file_path: LEGACY_PATH
		});
		expect(read_file_mock).toHaveBeenCalledTimes(1);
		expect(toast.warning).not.toHaveBeenCalled();
	});

	it('refuses migration when the build has no legacy keys', async () => {
		vi.stubEnv('VITE_LEGACY_FILE_PASSPHRASE', '');
		vi.stubEnv('VITE_LEGACY_FILE_SALT', '');
		installFileSystem({ [LEGACY_PATH]: legacyBytes() });

		await handleLoadFile(LEGACY_PATH);

		expect(toast.warning).toHaveBeenCalledWith('Legacy file cannot be upgraded', expect.anything());
	});

	it('does not offer migration for bytes that are not a v1 envelope', async () => {
		installFileSystem({ [LEGACY_PATH]: new TextEncoder().encode('not a heda file') });

		await handleLoadFile(LEGACY_PATH);

		expect(toast.warning).toHaveBeenCalledWith('Failed to load file', expect.anything());
	});

	it('writes a verified v2 file and keeps the v1 backup', async () => {
		const original = legacyBytes();
		const files = installFileSystem({ [LEGACY_PATH]: original });

		const result = await migrateHedaFile(LEGACY_PATH, NEW_PASSWORD);

		expect(result.backup_path).toBe(`${LEGACY_PATH}.v1.bak`);
		expect(files.get(`${LEGACY_PATH}.v1.bak`)).toEqual(original);
		expect(files.has(`${LEGACY_PATH}.v2.tmp`)).toBe(false);
		await expect(
			decryptFilePayload(new TextDecoder().decode(files.get(LEGACY_PATH)), NEW_PASSWORD)
		).resolves.toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
	});

	it('upgrades to device encryption by default', async () => {
		const original = legacyBytes();
		const files = installFileSystem({ [LEGACY_PATH]: original });

		const result = await migrateHedaFile(LEGACY_PATH);

		expect(result.backup_path).toBe(`${LEGACY_PATH}.v1.bak`);
		expect(files.get(`${LEGACY_PATH}.v1.bak`)).toEqual(original);
		expect(files.has(`${LEGACY_PATH}.v3.tmp`)).toBe(false);
		await expect(
			decryptFilePayload(
				new TextDecoder().decode(files.get(LEGACY_PATH)),
				null,
				'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
			)
		).resolves.toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
	});
});
