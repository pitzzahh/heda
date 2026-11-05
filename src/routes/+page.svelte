<script lang="ts">
	import {
		CertificateIcon,
		CircleNotchIcon,
		FolderOpenIcon,
		LightningAIcon,
		LockKeyIcon,
		MonitorIcon,
		PlusIcon,
		TrashIcon,
		WarningCircleIcon
	} from '#lib/assets/icons';
	import { Button, buttonVariants } from '#lib/components/ui/button';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { heda_logo_for_dark, heda_logo_for_light } from '#lib/assets/index';
	import { toast } from 'svelte-sonner';
	import { handleLoadFile, type NeedPassword } from '#lib/helpers/file';
	import { clearSessionPassword } from '#lib/db/session';
	import { PasswordDialog } from '#lib/components/custom';
	import type { RecentProject } from '#lib/types/main';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Separator } from '#lib/components/ui/separator';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { cn } from '#lib/utils';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { onMount } from 'svelte';
	import * as pj from '../../package.json';

	const project_state = getProjectState();
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();
	const undo_redo_state = getUndoRedoState();

	let component_state = $state({
		status: 'idle' as 'idle' | 'processing'
	});
	let load_dialog_open = $state(false);
	let unlock_open = $state(false);
	let unlock_path = $state('');
	let unlock_error = $state<string | null>(null);
	let unlock_busy = $state(false);

	async function handleLoadFileSuccess(recent_project_data: RecentProject) {
		await goto(
			resolve(`/(workspaces)/workspace?load_file=true&project_id=${recent_project_data.id}`)
		)
			.then(() => {
				if (!project_state.recent_projects?.some((p) => p.id === recent_project_data.id)) {
					project_state.addRecentProject(recent_project_data, true);
				}
				project_state.setCurrentProject(recent_project_data);

				project_state.setProjectLoaded(true);
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

	function isRecentProject(obj: unknown): obj is RecentProject {
		return !!obj && typeof obj === 'object' && 'id' in obj && 'project_name' in obj;
	}

	function isNeedPassword(obj: unknown): obj is NeedPassword {
		return !!obj && typeof obj === 'object' && 'need_password' in obj;
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
			load_dialog_open = false;
			handleLoadFileSuccess(handle_file_result);
		} else if (isNeedPassword(handle_file_result)) {
			unlock_path = handle_file_result.file_path;
			unlock_error = handle_file_result.invalid ? 'Wrong password. Try again.' : null;
			unlock_open = true;
		}
	}

	const spec_rows = [
		{
			icon: CertificateIcon,
			label: 'Standard',
			value: 'PEC 2017 — Philippine Electrical Code'
		},
		{
			icon: LightningAIcon,
			label: 'Analysis',
			value: 'Load schedules · Demand factors · Voltage drop'
		},
		{
			icon: LockKeyIcon,
			label: 'Storage',
			value: 'Encrypted .heda project files'
		}
	] as const;

	// One-time reset when landing on the home page; tracks nothing, so onMount fits.
	onMount(() => {
		project_state.setProjectLoaded(false);
		project_state.removeCurrentProject();
		select_nodes_to_delete_state.removeAllNodeIds();
		undo_redo_state.resetData();
		clearSessionPassword();
	});
</script>

<div class="bg-background text-foreground relative flex min-h-screen flex-col overflow-hidden">
	<!-- Backdrop: faint blueprint grid fading out, plus a soft primary glow. -->
	<div
		aria-hidden="true"
		class="blueprint-grid blueprint-fade pointer-events-none absolute inset-0"
	></div>
	<div
		aria-hidden="true"
		class="bg-primary/10 pointer-events-none absolute -top-48 left-[12%] h-128 w-128 rounded-full blur-3xl"
	></div>

	<header
		class="border-border/70 relative z-10 flex items-center justify-between border-b px-5 py-3 sm:px-8"
	>
		<div class="flex items-center gap-3">
			<img src={heda_logo_for_dark} alt="" class="hidden h-8 w-8 dark:block" />
			<img src={heda_logo_for_light} alt="" class="block h-8 w-8 dark:hidden" />
			<span class="text-sm font-extrabold tracking-[0.28em] uppercase">Heda</span>
			<span class="text-muted-foreground hidden text-[10px] font-medium tracking-wide lg:inline">
				Hierarchical Electrical Design Analyzer
			</span>
		</div>
		<div class="flex items-center gap-2">
			<span
				class="border-border text-muted-foreground rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider"
				>PEC 2017</span
			>
			<span
				class="border-border text-muted-foreground hidden rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider sm:inline"
				>v{pj.version}</span
			>
		</div>
	</header>

	<main
		class="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-12 lg:gap-10 lg:py-0"
	>
		<div class="lg:col-span-7">
			<p
				class="text-primary flex items-center gap-3 text-[11px] font-bold tracking-[0.22em] uppercase"
			>
				<span class="bg-primary/60 inline-block h-px w-10"></span>
				Philippine Electrical Code 2017
			</p>

			<h1
				class="mt-5 text-[clamp(5.5rem,17vw,11.5rem)] leading-[0.82] font-extrabold tracking-[-0.05em] select-none"
			>
				HEDA<span class="text-primary">.</span>
			</h1>

			<p class="text-muted-foreground mt-7 max-w-xl text-lg leading-8">
				Design hierarchical electrical systems — connected load, demand factors, conductor sizing
				and voltage drop — in one code-compliant
				<span class="text-foreground font-medium"> load schedule workspace</span>.
			</p>

			<div class="mt-10 flex flex-wrap items-center gap-3">
				<Button size="xl" href="/workspace?new_file=true" class="rounded-xl">
					<PlusIcon class="size-5" />
					New File
				</Button>
				<Dialog.Root bind:open={load_dialog_open}>
					<Dialog.Trigger
						type="button"
						onclick={() => project_state.validateRecentProjects()}
						class={buttonVariants({
							size: 'xl',
							variant: 'outline',
							className: 'rounded-xl'
						})}
					>
						<FolderOpenIcon class="size-5" />
						Load File
					</Dialog.Trigger>
					<Dialog.Content class="sm:max-w-[34rem]">
						<Dialog.Header>
							<Dialog.Title>Load a project</Dialog.Title>
							<Dialog.Description>
								Pick a recent project below, or open a <span class="font-mono">.heda</span> file from
								your computer.
							</Dialog.Description>
						</Dialog.Header>
						<Button
							variant="outline"
							disabled={component_state.status === 'processing'}
							onclick={() => attemptLoad(undefined)}
							class="h-13 w-full justify-start gap-3 px-3"
						>
							<span
								class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg border"
							>
								<CircleNotchIcon
									class={cn('hidden size-4 animate-spin', {
										block: component_state.status === 'processing'
									})}
								/>
								<MonitorIcon
									class={cn('size-4', {
										hidden: component_state.status === 'processing'
									})}
								/>
							</span>
							<span class="flex flex-col items-start leading-tight">
								<span class="text-sm font-semibold">Browse files…</span>
								<span class="text-muted-foreground text-[11px] font-normal">
									Open a .heda file from disk
								</span>
							</span>
						</Button>

						{#if project_state.recent_projects && project_state.recent_projects.length > 0}
							<div class="flex items-center gap-3 pt-1">
								<Separator class="flex-1" />
								<p
									class="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase"
								>
									Recent
								</p>
								<Separator class="flex-1" />
							</div>
						{/if}
						<ScrollArea class="max-h-72 w-full">
							{#if project_state.recent_projects && project_state?.recent_projects?.length > 0}
								{#each project_state.recent_projects as project (project.id)}
									<div class="group flex w-full items-center gap-2 py-1">
										<Button
											variant={project.exists ? 'outline' : 'warning_soft'}
											class={cn('h-auto min-h-14 flex-1 justify-start gap-3 px-2 py-2', {
												'opacity-60': component_state.status === 'processing'
											})}
											disabled={!project.exists || component_state.status === 'processing'}
											onclick={() => attemptLoad(project.project_path)}
										>
											<span
												class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg border"
											>
												<MonitorIcon class="size-4" />
											</span>
											<span class="flex min-w-0 flex-col items-start leading-tight">
												<span class="w-full truncate text-left text-sm font-semibold"
													>{project?.project_name ?? 'unknown'}</span
												>
												<span
													class="text-muted-foreground w-full truncate text-left text-[11px] font-normal"
													>{project.project_path ?? 'unknown path'}</span
												>
												{#if !project.exists}
													<span
														class="text-warning-strong mt-0.5 text-[10px] font-bold tracking-wider uppercase"
														>File not found</span
													>
												{/if}
											</span>
										</Button>
										<Button
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
											onclick={() => {
												project_state.removeRecentProject(project.id);
												toast.info(`${project.project_name ?? 'Project'} removed successfully`);
											}}
											aria-label="Remove from recent projects"
										>
											<TrashIcon class="size-4" />
										</Button>
									</div>
								{/each}
							{:else}
								<Alert.Root variant="info" class="flex w-full items-center">
									<WarningCircleIcon class="size-4 -translate-y-[0.1rem]" />
									<Alert.Description>No recent projects found</Alert.Description>
								</Alert.Root>
							{/if}
						</ScrollArea>
						<Dialog.Close />
					</Dialog.Content>
				</Dialog.Root>
			</div>

			<p class="text-muted-foreground mt-7 flex items-center gap-2 text-xs">
				<LockKeyIcon class="size-4 shrink-0" />
				<span>
					Every <span class="text-foreground font-mono">.heda</span> file is sealed with your password
					— AES-256-GCM, nothing leaves your machine.
				</span>
			</p>
		</div>

		<div class="hidden lg:col-span-5 lg:block">
			<figure
				class="border-border bg-card/70 relative rounded-3xl border p-8 shadow-[var(--surface-shadow)] backdrop-blur-xs"
			>
				<!-- Corner ticks, drawing-sheet style -->
				<span
					class="border-foreground/30 absolute top-3 left-3 size-5 rounded-tl-md border-t-2 border-l-2"
				></span>
				<span
					class="border-foreground/30 absolute top-3 right-3 size-5 rounded-tr-md border-t-2 border-r-2"
				></span>
				<span
					class="border-foreground/30 absolute bottom-3 left-3 size-5 rounded-bl-md border-b-2 border-l-2"
				></span>
				<span
					class="border-foreground/30 absolute right-3 bottom-3 size-5 rounded-br-md border-r-2 border-b-2"
				></span>

				<div
					class="text-muted-foreground flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase"
				>
					<span>HEDA-001</span>
					<span>Rev 2.6</span>
				</div>

				<div class="grid place-items-center py-8">
					<img src={heda_logo_for_dark} alt="HEDA logo" class="hidden h-44 w-44 dark:block" />
					<img src={heda_logo_for_light} alt="HEDA logo" class="block h-44 w-44 dark:hidden" />
					<p
						class="text-muted-foreground mt-5 text-center text-[10px] leading-5 font-medium tracking-[0.28em] uppercase"
					>
						Hierarchical<br />Electrical<br />Design Analyzer
					</p>
				</div>

				<div class="divide-border/80 divide-y border-t">
					{#each spec_rows as row (row.label)}
						{@const Icon = row.icon}
						<div class="flex items-center gap-4 py-3.5">
							<span
								class="border-border bg-background text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border"
							>
								<Icon class="size-4" />
							</span>
							<span class="flex min-w-0 flex-col">
								<span
									class="text-muted-foreground text-[9px] font-semibold tracking-[0.24em] uppercase"
								>
									{row.label}
								</span>
								<span class="text-foreground truncate text-sm font-medium">{row.value}</span>
							</span>
						</div>
					{/each}
				</div>

				<div
					class="text-muted-foreground flex items-center justify-between border-t pt-4 font-mono text-[9px] tracking-[0.2em] uppercase"
				>
					<span class="flex items-center gap-2">
						<span class="relative flex size-2">
							<span
								class="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
							></span>
							<span class="bg-success relative inline-flex size-2 rounded-full"></span>
						</span>
						Local-first
					</span>
					<span>AES-256-GCM</span>
				</div>
			</figure>
		</div>
	</main>

	<footer
		class="border-border/70 text-muted-foreground relative z-10 flex items-center justify-between gap-4 border-t px-5 py-3 text-[10px] font-semibold tracking-[0.2em] uppercase sm:px-8"
	>
		<span>Heda</span>
		<span class="hidden md:inline">Load Schedules · Voltage Drop · Conductor Sizing</span>
		<span class="font-mono normal-case tabular-nums">v{pj.version}</span>
	</footer>

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
</div>
