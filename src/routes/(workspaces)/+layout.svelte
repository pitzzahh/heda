<script lang="ts">
	import { AppSidebar } from '#lib/components/custom/sidebar/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { HighestUnitForm, PageProgress } from '#lib/components/custom/index.js';
	import { getState } from '#lib/state/index.svelte.js';
	import { DIALOG_STATE_CTX } from '#lib/state/constants.js';
	import type { DialogState } from '#lib/state/types.js';
	import type { Node } from '#lib/types/db/index.js';
	import UndoRedoWrapper from '#lib/components/custom/undo-redo-wrapper.svelte';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { getCurrentProject, getRootNode } from '#lib/db/queries/index.js';
	import { page } from '$app/state';
	import {
		CaretRightIcon,
		CheckCircleIcon,
		LightningAIcon,
		WarningCircleIcon
	} from '#lib/assets/icons/index.js';
	import { cn } from '#lib/utils/index.js';

	let { data, children } = $props();

	const { is_new_file } = $derived(data);

	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();

	const on_load_schedule = $derived(page.url.pathname.includes('load-schedule'));
	const project_id = $derived(page.url.searchParams.get('project_id') ?? undefined);

	// Live workspace rows: the SignalDB cursor subscribes to collection changes
	// inside this derived, so a mutation recomputes only this layout.
	const workspace = $derived({
		project: getCurrentProject(project_id),
		root_node: getRootNode()
	});

	// Reacts to navigation: opens the new-file dialog. (Project loads announce
	// themselves from the home page; a loading toast here could never dismiss.)
	$effect(() => {
		dialogs_state.highestUnit = is_new_file;
	});
</script>

<PageProgress />
<UndoRedoWrapper>
	<Sidebar.Provider class="h-svh overflow-hidden">
		<AppSidebar project={workspace.project} root_node={workspace.root_node as Node} />
		<Sidebar.Inset class="overflow-y-auto">
			<header
				class="bg-background/80 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 backdrop-blur-xl backdrop-saturate-150 sm:px-4"
			>
				<div class="flex min-w-0 items-center gap-2">
					<Sidebar.Trigger class="-ml-1" />
					<Separator orientation="vertical" class="mx-1 hidden h-5 sm:block" />
					<div
						class="bg-primary/10 text-primary border-primary/15 grid size-8 shrink-0 place-items-center rounded-lg border"
					>
						<LightningAIcon class="size-4" />
					</div>
					<div class="flex min-w-0 items-center gap-1.5">
						<p class="truncate text-sm font-semibold tracking-tight">
							{#if project_state.current_project_name}
								{project_state.current_project_name}
							{:else}
								Untitled project
							{/if}
						</p>
						{#if on_load_schedule}
							<CaretRightIcon class="text-muted-foreground size-3.5 shrink-0" />
							<p
								class="text-muted-foreground hidden text-sm font-medium whitespace-nowrap md:inline"
							>
								Load Schedule
							</p>
						{/if}
					</div>
				</div>

				<div
					class={cn(
						'hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:flex',
						undo_redo_state.has_unsaved_actions
							? 'border-warning/30 bg-warning/10 text-warning-strong'
							: 'border-success/30 bg-success/10 text-success-strong'
					)}
					role="status"
					aria-live="polite"
				>
					{#if undo_redo_state.has_unsaved_actions}
						<span class="bg-warning size-1.5 rounded-full"></span>
						Unsaved
					{:else}
						<CheckCircleIcon class="size-3.5" />
						Saved
					{/if}
				</div>
			</header>

			<svelte:boundary>
				<div class="flex min-h-0 w-full flex-1 flex-col gap-4 p-4">
					{@render children?.()}
				</div>
				{#snippet failed(error, reset)}
					<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
						<div
							class="bg-destructive/10 text-destructive grid size-14 place-items-center rounded-2xl"
						>
							<WarningCircleIcon class="size-7" />
						</div>
						<div class="grid gap-1">
							<p class="text-lg font-bold tracking-tight">Something went wrong</p>
							<p class="text-muted-foreground max-w-md text-sm text-balance">{error}</p>
						</div>
						<Button onclick={reset} variant="outline">Try again</Button>
					</div>
				{/snippet}
			</svelte:boundary>
		</Sidebar.Inset>
	</Sidebar.Provider>

	<Dialog.Root bind:open={dialogs_state.highestUnit}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title class="text-center font-bold">
					Choose the Highest Unit for this project
				</Dialog.Title>
			</Dialog.Header>
			<HighestUnitForm closeDialog={() => (dialogs_state.highestUnit = false)} />
			<Dialog.Close />
		</Dialog.Content>
	</Dialog.Root>
</UndoRedoWrapper>
