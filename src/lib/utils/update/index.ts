import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'svelte-sonner';

/**
 * A function that checks for updates and installs them if the provided function returns true.
 * @param fn A function that returns a boolean value. If the function returns true, the update will be installed.
 */
export async function checkForUpdates() {
  toast.loading('Checking for updates...');
  return await check();
}

export async function installUpdate(update: Update, _relaunch: boolean, _progress: (progress: number) => void) {
  let downloaded = 0;
  let contentLength = 0;
  // alternatively we could also call update.download() and update.install() separately
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength ?? 0;
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        _progress && _progress((downloaded / contentLength) * 100);
        break;
      case 'Finished':
        break;
    }
  });
  if (_relaunch) {
    toast.info('Update installed successfully', {
      description: 'The application will now restart to apply the changes.',
    });
    await relaunch();
  }
}
