<script lang="ts" module>
	import type { LibraryProject } from '#lib/types/main.js';
	import type { ImportResult } from '#lib/helpers/file/library.js';

	const MODIFIED = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<script lang="ts">
	import {
		FileIcon,
		FlaskIcon,
		FolderOpenIcon,
		LockKeyIcon,
		PlusIcon,
		TrashIcon,
		WarningCircleIcon
	} from '#lib/assets/icons.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { heda_logo_for_dark, heda_logo_for_light } from '#lib/assets/index.js';
	import { toast } from 'svelte-sonner';
	import {
		handleLoadFile,
		migrateHedaFile,
		type NeedMigration,
		type NeedPassword
	} from '#lib/helpers/file/index.js';
	import {
		clearSessionPassword,
		getSessionPassword,
		setSessionProtection
	} from '#lib/db/session.js';
	import { convertHedaFileToDevice } from '#lib/helpers/file/index.js';
	import { ConfirmationDialog, PasswordDialog } from '#lib/components/custom/index.js';
	import {
		IMPORT_REJECTIONS,
		deleteLibraryProject,
		importIntoLibrary,
		listLibraryProjects
	} from '#lib/helpers/file/library.js';
	import { isAndroidApp, isPreviewVersion } from '#lib/helpers/platform.js';
	import type { RecentProject } from '#lib/types/main.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getFileOpenState } from '#lib/hooks/file-open.svelte.js';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { onMount } from 'svelte';
	import * as pj from '../../package.json';

	const project_state = getProjectState();
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();
	const undo_redo_state = getUndoRedoState();
	const open_file_state = getFileOpenState();

	let component_state = $state({
		status: 'idle' as 'idle' | 'processing'
	});
	const busy = $derived(component_state.status === 'processing');
	// Stored oldest first; the home list shows the newest first.
	const recent_projects = $derived([...(project_state.recent_projects ?? [])].reverse());
	let unlock_open = $state(false);
	let unlock_path = $state('');
	let unlock_error = $state<string | null>(null);
	let unlock_busy = $state(false);
	let migrate_open = $state(false);
	let migrate_path = $state('');
	let migrate_error = $state<string | null>(null);
	let migrate_busy = $state(false);
	// Android: the projects in the app's own folder, listed instead of recent files.
	let library = $state<LibraryProject[]>([]);
	let delete_target = $state<LibraryProject | null>(null);
	let delete_open = $state(false);

	async function convertLoadedFile(recent_project_data: RecentProject) {
		try {
			await convertHedaFileToDevice(recent_project_data.project_path, getSessionPassword() ?? '');
			setSessionProtection('device');
			toast.success('File now opens without a password', {
				description: 'A verified .v2.bak backup was kept next to the file.'
			});
		} catch (err) {
			console.error(`Failed to convert file: ${(err as Error)?.message ?? 'unknown error'}`);
			toast.error('Could not convert this file to device encryption', {
				description: 'The file still opens with its password.'
			});
		}
	}

	async function handleLoadFileSuccess({
		pec_2017_migrated,
		...recent_project_data
	}: RecentProject & { pec_2017_migrated: boolean }) {
		await goto(
			resolve(`/(workspaces)/workspace?load_file=true&project_id=${recent_project_data.id}`)
		)
			.then(() => {
				// Re-append so the list (stored oldest first) tracks last-opened order.
				project_state.removeRecentProject(recent_project_data.id);
				project_state.addRecentProject(recent_project_data, true);

				project_state.setProjectLoaded(true);
				if (pec_2017_migrated) {
					// The migration only lives in memory until saved: flag it so Save is enabled,
					// auto-save writes it, and closing asks first.
					undo_redo_state.setHasUnsavedActions();
					toast.info('Sizes recalculated with PEC 2017', {
						description:
							'Breakers, conductors and conduits now follow PEC 2017: conductors by insulation, ambient and conduit fill (3.10.2.6(B)) and terminal rating (1.10.1.14(C)), 125% only on continuous loads (2.10.2.3(A)), 20 A dwelling circuits (2.10.1.11(C)), and motor feeders by 4.30.2.4 and 4.30.5. Review the schedule, then save to keep the update.',
						duration: 15_000
					});
				}
				if (recent_project_data.protection === 'password') {
					return toast.success('Project loaded successfully', {
						description: 'This file uses a password. Convert it so it opens without one.',
						action: {
							label: 'Convert',
							onClick: () => void convertLoadedFile(recent_project_data)
						}
					});
				}
				return toast.success('Project loaded successfully', {
					description: 'The file has been loaded successfully.'
				});
			})
			.catch((err) => {
				console.error(`Failed to load file: ${(err as Error)?.message ?? 'something went wrong'}`);
				toast.error(`Failed to load file: ${(err as Error)?.message ?? 'something went wrong'}`, {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			})
			.finally(() => (component_state.status = 'idle'));
	}

	function isRecentProject(obj: unknown): obj is RecentProject & { pec_2017_migrated: boolean } {
		return !!obj && typeof obj === 'object' && 'id' in obj && 'project_name' in obj;
	}

	function isNeedPassword(obj: unknown): obj is NeedPassword {
		return !!obj && typeof obj === 'object' && 'need_password' in obj;
	}

	function isNeedMigration(obj: unknown): obj is NeedMigration {
		return !!obj && typeof obj === 'object' && 'need_migration' in obj;
	}

	async function attemptLoad(path: string | undefined, password: string | null = null) {
		const handle_file_result = await handleLoadFile(
			path,
			() => (component_state.status = 'processing'),
			() => (component_state.status = 'idle'),
			password
		);
		if (isRecentProject(handle_file_result)) {
			unlock_open = false;
			handleLoadFileSuccess(handle_file_result);
		} else if (isNeedPassword(handle_file_result)) {
			unlock_path = handle_file_result.file_path;
			unlock_error = handle_file_result.invalid ? 'Wrong password. Try again.' : null;
			unlock_open = true;
		} else if (isNeedMigration(handle_file_result)) {
			migrate_path = handle_file_result.file_path;
			migrate_error = null;
			migrate_open = true;
		}
	}

	async function refreshLibrary() {
		try {
			library = await listLibraryProjects();
		} catch (err) {
			console.error(`Could not list the projects on this device: ${String(err)}`);
		}
	}

	async function importFile() {
		component_state.status = 'processing';
		let result: ImportResult;
		try {
			result = await importIntoLibrary();
		} catch (err) {
			console.error(`Failed to import file: ${String(err)}`);
			return toast.error('Failed to import file', {
				description: (err as Error)?.message ?? 'Something went wrong.'
			});
		} finally {
			component_state.status = 'idle';
		}
		if (result.status === 'cancelled') {
			return toast.warning('No file selected', {
				description: 'Cannot proceed, no file is selected.'
			});
		}
		if (result.status === 'rejected') {
			const { title, description } = IMPORT_REJECTIONS[result.reason];
			return toast.warning(title, { description });
		}
		// Listed now, so it shows even if the password prompt is dismissed.
		await refreshLibrary();
		await attemptLoad(result.path);
	}

	async function deleteProject(project: LibraryProject) {
		try {
			await deleteLibraryProject(project.path);
			toast.success(`${project.name} deleted`);
		} catch (err) {
			toast.error(`Could not delete ${project.name}`, {
				description: (err as Error)?.message ?? 'Something went wrong.'
			});
		} finally {
			await refreshLibrary();
		}
	}

	async function handleMigrationSubmit() {
		const path = migrate_path;
		migrate_busy = true;
		migrate_error = null;
		try {
			const { backup_path } = await migrateHedaFile(path);
			const backup_name = backup_path.replace(/\\/g, '/').split('/').pop() ?? backup_path;
			migrate_open = false;
			toast.success('Legacy file upgraded', {
				description: `A verified backup was saved as ${backup_name}.`
			});
			await attemptLoad(path);
		} catch (err) {
			migrate_error = (err as Error)?.message ?? 'The legacy file could not be upgraded.';
		} finally {
			migrate_busy = false;
		}
	}

	// One-time reset when landing on the home page; tracks nothing, so onMount fits.
	onMount(() => {
		project_state.setProjectLoaded(false);
		project_state.removeCurrentProject();
		select_nodes_to_delete_state.removeAllNodeIds();
		// Unsaved changes belong to the project being left; a new one must not
		// inherit the flag (which would fire an immediate auto-save).
		undo_redo_state.resetUnsavedActions();
		clearSessionPassword();
		void project_state.validateRecentProjects();
		if (android) void refreshLibrary();
	});

	// Consumes a .heda path the OS asked us to open; clearing it is an event
	// handshake with the root layout, so an effect is the only fitting spot.
	$effect(() => {
		const path = open_file_state.pending_path;
		if (!path) return;
		open_file_state.pending_path = null;
		void attemptLoad(path);
	});

	const android = isAndroidApp();
</script>

<div class="relative flex min-h-svh flex-col bg-background text-foreground">
	<div
		aria-hidden="true"
		class="blueprint-grid blueprint-fade pointer-events-none absolute inset-0"
	></div>

	<!-- Same bar as the workspace header, so home and app read as one product. -->
	<header
		class="relative z-10 flex h-[calc(3.5rem+var(--safe-area-top))] shrink-0 items-center justify-between border-b bg-background/95 pt-(--safe-area-top) pr-[calc(1rem+var(--safe-area-right))] pl-[calc(1rem+var(--safe-area-left))] sm:pr-[calc(1.5rem+var(--safe-area-right))] sm:pl-[calc(1.5rem+var(--safe-area-left))]"
	>
		<div class="flex items-center gap-2.5">
			<img src={heda_logo_for_dark} alt="" class="hidden size-7 dark:block" />
			<img src={heda_logo_for_light} alt="" class="block size-7 dark:hidden" />
			<span class="text-sm font-semibold tracking-tight">HEDA</span>
		</div>
		<div class="flex items-center gap-2">
			{#if isPreviewVersion(pj.version)}
				<span
					class="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
					title="Not production ready: check results against PEC 2017 before using them."
				>
					<FlaskIcon class="size-3.5" />
					Preview
				</span>
			{/if}
			<span class="font-mono text-[11px] text-muted-foreground tabular-nums">v{pj.version}</span>
		</div>
	</header>

	<main
		class="relative z-10 mx-auto grid w-full max-w-5xl flex-1 content-center items-center gap-10 pt-10 pr-[calc(1.5rem+var(--safe-area-right))] pb-[calc(2.5rem+var(--safe-area-bottom))] pl-[calc(1.5rem+var(--safe-area-left))] lg:grid-cols-2 lg:gap-16"
	>
		<section>
			<h1 class="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
				Hierarchical Electrical Design Analyzer
			</h1>
			<p class="mt-4 max-w-md leading-7 text-muted-foreground">
				Load schedules, voltage drop and short-circuit checks for your whole panel hierarchy,
				computed to the Philippine Electrical Code 2017.
			</p>

			<div class="mt-8 flex flex-wrap items-center gap-3">
				<Button size="lg" href="/workspace?new_file=true">
					<PlusIcon class="size-4" />
					New project
				</Button>
				<Button
					size="lg"
					variant="outline"
					disabled={busy}
					loading={busy}
					onclick={() => (android ? importFile() : attemptLoad(undefined))}
				>
					<FolderOpenIcon class="size-4" />
					{android ? 'Import file…' : 'Open file…'}
				</Button>
			</div>

			<p class="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
				<LockKeyIcon class="size-4 shrink-0" />
				{android
					? 'Projects are saved as encrypted .heda files on this device. Export a password-protected copy to share one.'
					: 'Projects are saved as encrypted .heda files and never leave this computer.'}
			</p>
		</section>

		<section
			aria-labelledby="recent-heading"
			class="rounded-xl border bg-card shadow-(--surface-shadow)"
		>
			<h2 id="recent-heading" class="border-b px-4 py-3 text-sm font-semibold tracking-tight">
				{android ? 'Projects on this device' : 'Recent projects'}
			</h2>
			{#if android}
				{#if library.length}
					<ScrollArea class="max-h-80">
						<ul class="p-2">
							{#each library as project (project.path)}
								<li class="flex items-center gap-1">
									<Button
										variant="ghost"
										class="h-auto min-w-0 flex-1 justify-start gap-3 px-2 py-2"
										disabled={busy}
										onclick={() => attemptLoad(project.path)}
									>
										<span
											class="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/10 text-primary"
										>
											<FileIcon class="size-4" />
										</span>
										<span class="flex min-w-0 flex-col items-start leading-tight">
											<span class="w-full truncate text-left text-sm font-medium">
												{project.name}
											</span>
											{#if project.modified}
												<span
													class="w-full truncate text-left text-[11px] font-normal text-muted-foreground"
												>
													Saved {MODIFIED.format(project.modified)}
												</span>
											{/if}
										</span>
									</Button>
									<!-- Always visible: a touch screen has no hover to reveal it. -->
									<Button
										variant="ghost"
										size="icon"
										class="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										disabled={busy}
										onclick={() => {
											delete_target = project;
											delete_open = true;
										}}
										aria-label="Delete {project.name}"
									>
										<TrashIcon class="size-4" />
									</Button>
								</li>
							{/each}
						</ul>
					</ScrollArea>
				{:else}
					<p class="px-4 py-10 text-center text-sm text-muted-foreground">
						Projects you create or import will appear here.
					</p>
				{/if}
			{:else if recent_projects.length}
				<ScrollArea class="max-h-80">
					<ul class="p-2">
						{#each recent_projects as project (project.id)}
							<li class="group flex items-center gap-1">
								<Button
									variant="ghost"
									class="h-auto min-w-0 flex-1 justify-start gap-3 px-2 py-2"
									disabled={!project.exists || busy}
									onclick={() => attemptLoad(project.project_path)}
								>
									<span
										class="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/10 text-primary"
									>
										<FileIcon class="size-4" />
									</span>
									<span class="flex min-w-0 flex-col items-start leading-tight">
										<span class="w-full truncate text-left text-sm font-medium">
											{project.project_name ?? 'Untitled project'}
										</span>
										<span
											class="w-full truncate text-left text-[11px] font-normal text-muted-foreground"
										>
											{project.exists ? project.project_path : 'File not found'}
										</span>
									</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="shrink-0 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
									onclick={() => {
										project_state.removeRecentProject(project.id);
										toast.info(`${project.project_name ?? 'Project'} removed from recent projects`);
									}}
									aria-label="Remove {project.project_name ?? 'project'} from recent projects"
								>
									<TrashIcon class="size-4" />
								</Button>
							</li>
						{/each}
					</ul>
				</ScrollArea>
			{:else}
				<p class="px-4 py-10 text-center text-sm text-muted-foreground">
					Projects you open or save will appear here.
				</p>
			{/if}
		</section>
	</main>

	{#if android}
		<ConfirmationDialog
			bind:open_dialog_state={delete_open}
			trigger_variant="destructive"
			trigger_text="Delete"
			title="Delete {delete_target?.name ?? 'this project'}?"
			description="The project file is removed from this device, along with its backups. Copies you exported are kept."
			onConfirm={() => {
				if (delete_target) void deleteProject(delete_target);
			}}
		/>
	{/if}

	<PasswordDialog
		bind:open={unlock_open}
		mode="unlock"
		error={unlock_error}
		busy={unlock_busy}
		onSubmit={async (password) => {
			unlock_busy = true;
			unlock_error = null;
			await attemptLoad(unlock_path, password);
			unlock_busy = false;
		}}
	/>

	<Dialog.Root bind:open={migrate_open}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<div class="flex items-center gap-3">
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"
					>
						<LockKeyIcon class="size-5" />
					</div>
					<div class="grid gap-0.5">
						<Dialog.Title>Upgrade legacy file</Dialog.Title>
					</div>
				</div>
			</Dialog.Header>
			<Dialog.Description class={migrate_error ? 'mb-4' : undefined}>
				This file uses the old format. Upgrade it to device encryption so it opens without a
				password. A verified backup of the original is kept next to it.
			</Dialog.Description>
			{#if migrate_error}
				<div
					class="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
					role="alert"
				>
					<WarningCircleIcon class="mt-0.5 size-4 shrink-0" />
					<span>{migrate_error}</span>
				</div>
			{/if}
			<Dialog.Footer>
				<Button variant="ghost" onclick={() => (migrate_open = false)} disabled={migrate_busy}
					>Cancel</Button
				>
				<Button onclick={handleMigrationSubmit} disabled={migrate_busy} loading={migrate_busy}>
					Upgrade file
				</Button>
			</Dialog.Footer>
			<Dialog.Close />
		</Dialog.Content>
	</Dialog.Root>
</div>
