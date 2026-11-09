import { setState, getState } from '#lib/state/index.svelte.js';
import { FILE_OPEN_STATE_CTX } from '#lib/state/constants.js';

export class FileOpenState {
	/** Path of a `.heda` file the OS asked us to open, awaiting the home page. */
	pending_path = $state<string | null>(null);
}

export function setOpenFileState() {
	return setState(new FileOpenState(), FILE_OPEN_STATE_CTX);
}

export function getFileOpenState() {
	return getState<FileOpenState>(FILE_OPEN_STATE_CTX);
}
