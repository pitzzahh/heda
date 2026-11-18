<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import type { VoltageDrop } from '#lib/types/voltage-drop.js';
	import type { ShortCircuit } from '#lib/types/short-circuit.js';

	const TABS = [
		{ value: 'load-sched', label: 'Load Schedule' },
		{ value: 'voltage-drop', label: 'Voltage Drop' },
		{ value: 'short-circuit', label: 'Short Circuit' }
	] as const;
	type TabValue = (typeof TABS)[number]['value'];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable } from '#lib/components/custom/table/index.js';
	import { page } from '$app/state';
	import { DEFAULT_PHASES, default_phases } from '#lib/constants.js';
	import { supplyPhaseOf } from '#lib/utils/computations/index.js';
	import { threePhaseWyeCols } from '#lib/components/custom/table/three-phase-wye-cols.js';
	import { getOptionLabel } from '#lib/utils/format.js';
	import { onePhaseMainOrWyeCols } from '#lib/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import {
		getComputedLoads,
		getComputedShortCircuitsAsync,
		getComputedVoltageDropsAsync,
		getNode,
		getNodeById,
		getRootNode,
		getSnapshotRevision
	} from '#lib/db/queries/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { voltageDropColumns } from '#lib/components/custom/table/voltage-drop-cols/voltage-drop-cols.js';
	import { shortCircuitColumns } from '#lib/components/custom/table/short-circuit-cols/index.js';
	import { ShortCircuitSourceForm } from '#lib/components/custom/short-circuit/index.js';
	import { ArrowSquareOutIcon, LightningAIcon } from '#lib/assets/icons.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Poppable } from '#lib/components/custom/popout/index.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { nodeIdFromRouteId } from '#lib/helpers/navigation.js';
	import { isAndroidApp } from '#lib/helpers/platform.js';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const params = $derived(page.params);
	const node_id = $derived(nodeIdFromRouteId(params.id) as string);
	const project_state = getProjectState();

	let active_tab = $state('load-sched');
	let visited_tabs = $state<Record<string, boolean>>({
		'load-sched': true,
		'voltage-drop': false,
		'short-circuit': false
	});
	let voltage_activated = $state(false);
	// Any tab's content can move into its own window; see Poppable.
	let popouts = $state<Partial<Record<TabValue, Poppable>>>({});
	let popped_tabs = $state<Record<TabValue, boolean>>({
		'load-sched': false,
		'voltage-drop': false,
		'short-circuit': false
	});
	const panels = {
		'load-sched': loadSchedulePanel,
		'voltage-drop': voltageDropPanel,
		'short-circuit': shortCircuitPanel
	} satisfies Record<TabValue, unknown>;

	// A fresh page starts on its first tab; tell the workspace header, which outlives the page.
	onMount(() => {
		project_state.schedule_tab = active_tab;
	});

	// Latch activation from the bound tab value so it's reliable regardless of
	// how the tab changes. One-way state (stays true) — not derivable without
	// losing the latch, and reacting to UI tab state is an external sync.
	$effect(() => {
		if (active_tab === 'voltage-drop') voltage_activated = true;
	});

	// Datasets stay hot once warmed: the tab panels never unmount, so clearing a
	// table would rebuild every row on each switch. Drops warm in the
	// background but the heavy table only mounts once the user visits the tab.
	const current_node = $derived(getNodeById(node_id));
	const parent_node = $derived(
		current_node?.parent_id ? getNode(current_node.parent_id) : undefined
	);
	const unit_name = $derived(
		current_node?.panel_data?.name ?? current_node?.highest_unit_form?.distribution_unit
	);
	const root_node = $derived(getRootNode());
	const source_key = $derived(
		[
			root_node?.id,
			root_node?.highest_unit_form?.utility_sc_kva,
			root_node?.highest_unit_form?.transformer_kva,
			root_node?.highest_unit_form?.transformer_z_percent
		].join('|')
	);
	const loads = $derived(getComputedLoads(node_id));
	let voltage_drops = $state<VoltageDrop[]>([]);
	let drops_ready = $state(false);
	let voltage_mounted = $state(false);

	// Column definitions are expensive to rebuild and invalidate TanStack's
	// row model, so keep them stable across tab switches.
	// A 400Y/230 V panel (or a wye root) lists each circuit's phase and VA per phase.
	const is_wye_schedule = $derived(
		supplyPhaseOf(current_node ?? undefined) === default_phases.THREE_PHASE_WYE
	);
	const load_columns = $derived(
		current_node
			? is_wye_schedule
				? threePhaseWyeCols(current_node as PhaseLoadSchedule)
				: onePhaseMainOrWyeCols(current_node as PhaseLoadSchedule)
			: []
	);
	const voltage_drop_columns = voltageDropColumns();
	const short_circuit_columns = shortCircuitColumns<ShortCircuit>();

	// Recomputed on each snapshot revision only while the tab shows (here or in its
	// popout window); hidden, the table keeps the last result.
	let short_circuits = $state<ShortCircuit[]>([]);
	const short_circuits_shown = $derived(
		active_tab === 'short-circuit' || !!popped_tabs['short-circuit']
	);
	// The engine answers asynchronously; stale answers are dropped (external async, so an effect).
	$effect(() => {
		const revision = getSnapshotRevision();
		if (!short_circuits_shown) return;
		void getComputedShortCircuitsAsync()
			.then((faults) => {
				if (getSnapshotRevision() === revision) short_circuits = faults;
			})
			.catch((error: unknown) => console.error('Short-circuit calculation failed:', error));
	});

	// Engine fetch keyed to the revision, dispatched off the reactive flush.
	// `revision` is read here to track changes; stale results are dropped.
	// External async coordination (not derivable state) requires an effect.
	$effect(() => {
		const revision = getSnapshotRevision();
		const timer = setTimeout(() => {
			void getComputedVoltageDropsAsync()
				.then((drops) => {
					if (getSnapshotRevision() === revision) {
						voltage_drops = drops;
						drops_ready = true;
					}
				})
				.catch(() => {
					drops_ready = true;
				});
		}, 0);
		return () => clearTimeout(timer);
	});

	// Defer the heavy DataTable mount so the tab switch (skeleton/indicator)
	// paints before TanStack builds the full row model. External scheduling for
	// a non-derivable mount gate requires an effect.
	$effect(() => {
		if (voltage_activated && drops_ready && !voltage_mounted) {
			const timer = setTimeout(() => {
				voltage_mounted = true;
			}, 0);
			return () => clearTimeout(timer);
		}
	});

	// Pre-mount the hidden voltage table shortly after warm-up so the first
	// visit only reveals it instead of paying the full mount on the click.
	// External scheduling for a non-derivable mount gate requires an effect.
	$effect(() => {
		if (!drops_ready) return;
		const timer = setTimeout(() => {
			voltage_mounted = true;
		}, 500);
		return () => clearTimeout(timer);
	});

	// Redirects home when the schedule opens without a loaded project.
	$effect(() => {
		if (!project_state.loaded) {
			toast.warning('Project not loaded yet. Redirecting to workspaces...', {
				description: 'Please create a project or load an existing one first.'
			});
			goto(resolve(`/`));
		}
	});

	// Android gives an app one window: no popouts there.
	const can_pop_out = !isAndroidApp();
</script>

<div class="flex min-h-0 w-full flex-1 flex-col gap-4">
	<div
		class="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-(--surface-shadow) sm:gap-4 sm:px-5 sm:py-4 lg:flex-row lg:items-center"
	>
		<div
			class="flex items-center gap-3 border-b pb-3 sm:pb-4 lg:border-r lg:border-b-0 lg:pr-5 lg:pb-0"
		>
			<div
				class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary"
			>
				<LightningAIcon class="size-5" />
			</div>
			<div class="grid gap-0.5">
				<span class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
					>Distribution Unit</span
				>
				<span class="text-base leading-5 font-bold tracking-tight">
					{unit_name ?? 'NOT FOUND'}
				</span>
			</div>
		</div>

		<dl class="grid flex-1 grid-cols-2 gap-4 lg:gap-0">
			<div class="grid gap-0.5 lg:border-r lg:px-5">
				<dt class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
					Phase System
				</dt>
				<dd class="text-sm font-medium">
					{getOptionLabel(DEFAULT_PHASES, root_node?.highest_unit_form?.phase) || '-'}
					{#if root_node?.highest_unit_form?.phase === default_phases.THREE_PHASE_WYE}
						<span class="text-muted-foreground">· 400Y/230 V</span>
					{/if}
				</dd>
			</div>

			<div class="grid gap-0.5 lg:px-5">
				<dt class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
					Supply From
				</dt>
				<dd class="truncate text-sm font-medium">
					{parent_node?.panel_data?.name ??
						parent_node?.highest_unit_form?.distribution_unit ??
						'-'}
				</dd>
			</div>
		</dl>
	</div>
	<Tabs.Root
		bind:value={active_tab}
		onValueChange={(value) => {
			visited_tabs[value] = true;
			project_state.schedule_tab = value;
		}}
		class="min-h-0 w-full flex-1"
	>
		<div class="flex items-center justify-end gap-2">
			<Tabs.List>
				{#each TABS as tab (tab.value)}
					<!-- Tighter on phones, so all three labels fit without scrolling. -->
					<Tabs.Trigger value={tab.value} class="px-2 sm:px-3">{tab.label}</Tabs.Trigger>
				{/each}
			</Tabs.List>
			{#if can_pop_out}
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Open this tab in a new window"
					title="Open in a new window"
					onclick={() => popouts[active_tab as TabValue]?.popOut()}
				>
					<ArrowSquareOutIcon />
				</Button>
			{/if}
		</div>
		{#each TABS as tab (tab.value)}
			<Tabs.Content
				value={tab.value}
				class={['flex min-h-0 flex-1 flex-col', tab.value === 'short-circuit' && 'gap-4']}
			>
				<Poppable
					bind:this={popouts[tab.value]}
					title={unit_name ? `${tab.label} · ${unit_name}` : tab.label}
					onPoppedChange={(popped) => (popped_tabs[tab.value] = popped)}
				>
					{@render panels[tab.value]()}
				</Poppable>
			</Tabs.Content>
		{/each}
	</Tabs.Root>
</div>

{#snippet loadSchedulePanel()}
	{#if current_node}
		<DataTable
			data={loads}
			columns={load_columns}
			highest_unit={root_node?.highest_unit_form}
			is_footer_shown={current_node.node_type !== 'root'}
		/>
	{:else}
		<div class="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
			Could not load the schedule.
		</div>
	{/if}
{/snippet}

{#snippet voltageDropPanel()}
	{#if voltage_mounted && drops_ready}
		<DataTable
			data={voltage_drops}
			is_footer_shown={false}
			columns={voltage_drop_columns}
			is_in_vd_table
		/>
	{:else}
		<div
			class="grid min-h-0 flex-1 place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground"
		>
			Loading voltage drop…
		</div>
	{/if}
{/snippet}

{#snippet shortCircuitPanel()}
	{#if root_node}
		<!-- Remount on undo/redo too, so the inputs never show a source that was undone. -->
		{#key source_key}
			<ShortCircuitSourceForm root={root_node} />
		{/key}
	{/if}
	{#if visited_tabs['short-circuit']}
		<DataTable
			data={short_circuits}
			is_footer_shown={false}
			columns={short_circuit_columns}
			is_in_vd_table
		/>
	{/if}
{/snippet}
