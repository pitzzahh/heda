import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { engineFile } from '#lib/core/api.js';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';
import type { TitleBlock } from '#lib/types/title-block.js';

/**
 * Builds the permit sheet set in the engine (`crates/heda-core/src/sheet_set.rs`) and
 * saves it where the user picks, like the Excel export. The title block is the one stored
 * on the project, so save it there first.
 */
export async function exportSheetSet(project_name: string): Promise<void> {
	const path = await saveDialog({
		defaultPath: `${project_name} Sheet Set.pdf`,
		filters: [{ name: 'PDF document', extensions: ['pdf'] }]
	});
	if (!path) return;
	const bytes = await engineFile('sheet_set', { project_name, date: localDate(new Date()) });
	await writeFile(path, bytes);
	toast.success('Sheet set saved.', {
		// On Android the path is an opaque content:// document link.
		description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
		action: showInFolderAction(path),
		position: 'bottom-center'
	});
}

/**
 * The date drawn (PEC 2017 1.3.2.2(E)) as YYYY-MM-DD on the engineer's own calendar.
 * `toISOString` would give the UTC date, a day behind before 08:00 in the Philippines.
 */
export function localDate(now: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whether `next` differs from the stored title block, field by field (key order aside). */
export function titleBlockChanged(stored: TitleBlock | undefined, next: TitleBlock): boolean {
	const keys = new Set([...Object.keys(stored ?? {}), ...Object.keys(next)]) as Set<
		keyof TitleBlock
	>;
	return [...keys].some((key) => stored?.[key] !== next[key]);
}
