import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * A function that checks for updates and installs them if the provided function returns true.
 * @param fn A function that returns a boolean value. If the function returns true, the update will be installed.
 */
export async function checkForUpdates() {
  return await check();
}

export async function installUpdate(update: Update, fn: (fn: () => Promise<void>) => void) {
  console.log(
    `found update ${update.version} from ${update.date} with notes ${update.body}`
  );
  let downloaded = 0;
  let contentLength = 0;
  // alternatively we could also call update.download() and update.install() separately
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength ?? 0;
        console.log(`started downloading ${contentLength} bytes`);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        console.log(`downloaded ${downloaded} from ${contentLength}`);
        break;
      case 'Finished':
        console.log('download finished');
        break;
    }
  });
  console.log('update installed');
  fn && fn(async () => await relaunch());
}
