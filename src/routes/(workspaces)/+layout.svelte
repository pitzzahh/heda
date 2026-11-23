<script lang="ts" module>
	const SCHEDULE_TAB_LABELS: Record<string, string> = {
		'load-sched': 'Load Schedule',
		'voltage-drop': 'Voltage Drop',
		'short-circuit': 'Short Circuit'
	};
</script>

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
	import type { Node } from '#lib/types/db.js';
	import UndoRedoWrapper from '#lib/components/custom/undo-redo-wrapper.svelte';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import {
		getComputedLoads,
		getCurrentProject,
		getNodeById,
		getRootNode
	} from '#lib/db/queries/index.js';
	import { BalancePhasesMenu } from '#lib/components/custom/table/(components)/index.js';
	import { isThreePhaseSupply, supplyPhaseOf } from '#lib/utils/computations/index.js';
	import { nodeIdFromRouteId } from '#lib/helpers/navigation.js';
	import { page } from '$app/state';
	import {
		CaretRightIcon,
		CheckCircleIcon,
		FlaskIcon,
		LightningAIcon,
		WarningCircleIcon
	} from '#lib/assets/icons.js';
	import { cn } from '#lib/utils/index.js';
	import { isPreviewVersion } from '#lib/helpers/platform.js';
	import * as pj from '../../../package.json';

	let { data, children } = $props();

	const { is_new_file } = $derived(data);

	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();

	const on_load_schedule = $derived(page.url.pathname.includes('load-schedule'));
	const project_id = $derived(page.url.searchParams.get('project_id') ?? undefined);

	// The open schedule's phase and circuits when it is three-phase and its Load Schedule tab
	// shows, for the header's Phases menu.
	const three_phase_schedule = $derived.by(() => {
		const on_load_tab = on_load_schedule && project_state.schedule_tab === 'load-sched';
		const node_id = on_load_tab ? nodeIdFromRouteId(page.params.id) : undefined;
		const node = node_id ? (getNodeById(node_id) ?? undefined) : undefined;
		const supply_phase = supplyPhaseOf(node);
		return {
			node_id,
			supply_phase,
			unbalance: node?.unbalance,
			loads: node_id && isThreePhaseSupply(supply_phase) ? getComputedLoads(node_id) : []
		};
	});

	// Live workspace rows: the session snapshot subscribes to every write
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
				class="sticky top-0 z-10 flex h-[calc(3.5rem+var(--safe-area-top))] shrink-0 items-center justify-between gap-3 border-b bg-background/95 pt-(--safe-area-top) pr-[calc(0.75rem+var(--safe-area-right))] pl-[calc(0.75rem+var(--safe-area-left))] sm:pr-[calc(1rem+var(--safe-area-right))] sm:pl-[calc(1rem+var(--safe-area-left))]"
			>
				<div class="flex min-w-0 items-center gap-2">
					<Sidebar.Trigger class="-ml-1" />
					<Separator orientation="vertical" class="mx-1 hidden h-5 sm:block" />
					<div
						class="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/10 text-primary"
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
							<CaretRightIcon class="size-3.5 shrink-0 text-muted-foreground" />
							<p class="shrink-0 text-sm font-medium whitespace-nowrap text-muted-foreground">
								{SCHEDULE_TAB_LABELS[project_state.schedule_tab] ?? 'Load Schedule'}
							</p>
						{/if}
					</div>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					{#if three_phase_schedule.node_id && three_phase_schedule.loads.length > 0}
						<BalancePhasesMenu
							panel_id={three_phase_schedule.node_id}
							loads={three_phase_schedule.loads}
							supply_phase={three_phase_schedule.supply_phase}
							unbalance={three_phase_schedule.unbalance}
						/>
					{/if}
					{#if isPreviewVersion(pj.version)}
						<!-- Primary, not amber: beside the amber Unsaved pill it must not read as a save warning. -->
						<div
							class="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary sm:flex"
							title="Preview v{pj.version}: not production ready. Check results against PEC 2017 before using them."
						>
							<FlaskIcon class="size-3.5" />
							Preview
						</div>
					{/if}
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
							<span class="size-1.5 rounded-full bg-warning"></span>
							Unsaved
						{:else}
							<CheckCircleIcon class="size-3.5" />
							Saved
						{/if}
					</div>
				</div>
			</header>

			<svelte:boundary>
				<div
					class="flex min-h-0 w-full flex-1 flex-col gap-4 py-4 pr-[calc(1rem+var(--safe-area-right))] pl-[calc(1rem+var(--safe-area-left))]"
				>
					{@render children?.()}
				</div>
				{#snippet failed(error, reset)}
					<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
						<div
							class="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"
						>
							<WarningCircleIcon class="size-7" />
						</div>
						<div class="grid gap-1">
							<p class="text-lg font-bold tracking-tight">Something went wrong</p>
							<p class="max-w-md text-sm text-balance text-muted-foreground">{error}</p>
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
				<Dialog.Title>Choose the Highest Unit for this project</Dialog.Title>
			</Dialog.Header>
			<HighestUnitForm closeDialog={() => (dialogs_state.highestUnit = false)} />
			<Dialog.Close />
		</Dialog.Content>
	</Dialog.Root>
</UndoRedoWrapper>
