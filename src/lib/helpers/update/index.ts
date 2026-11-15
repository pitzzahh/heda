import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'svelte-sonner';

/**
 * A function that checks for updates and installs them if the provided function returns true.
 * @param fn A function that returns a boolean value. If the function returns true, the update will be installed.
 */
export async function checkForUpdates() {
	const toast_id = toast.loading('Checking for updates...');
	try {
		return await check();
	} finally {
		toast.dismiss(toast_id);
	}
}

export async function installUpdate(
	update: Update,
	_relaunch: boolean,
	_progress: (downloaded: number, total: number | undefined) => void
) {
	let downloaded = 0;
	let total: number | undefined;
	await update.downloadAndInstall((event) => {
		switch (event.event) {
			case 'Started':
				// a server that sends no size reports 0 or nothing; treat both as unknown
				total = event.data.contentLength || undefined;
				_progress?.(0, total);
				break;
			case 'Progress':
				downloaded += event.data.chunkLength;
				_progress?.(downloaded, total);
				break;
			case 'Finished':
				break;
		}
	});
	if (_relaunch) {
		toast.info('Update installed successfully', {
			description: 'The application will now restart to apply the changes.'
		});
		await relaunch();
	}
}
