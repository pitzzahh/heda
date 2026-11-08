<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable } from '#lib/components/custom/table/index.js';
	import { page } from '$app/state';
	import { DEFAULT_PHASES } from '#lib/constants/index.js';
	import { getOptionLabel } from '#lib/utils/format/index.js';
	import { onePhaseMainOrWyeCols } from '#lib/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import {
		getComputedLoads,
		getComputedVoltageDrops,
		getComputedVoltageDropsAsync,
		getNode,
		getNodeById,
		getRootNode
	} from '#lib/db/queries/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { voltageDropColumns } from '#lib/components/custom/table/voltage-drop-cols/voltage-drop-cols.js';
	import { LightningAIcon } from '#lib/assets/icons/index.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const params = $derived(page.params);
	const node_id = $derived(params.id!.split('_').at(-1) as string);
	const project_state = getProjectState();

	let active_tab = $state('load-sched');
	let visited_tabs = $state<Record<string, boolean>>({
		'load-sched': true,
		'voltage-drop': false
	});

	// Datasets stay hot once warmed: the tab panels never unmount, so clearing a
	// table would rebuild every row on each switch. Drops warm up while idle.
	const current_node = $derived(getNodeById(node_id));
	const parent_node = $derived(
		current_node?.parent_id ? getNode(current_node.parent_id) : undefined
	);
	const root_node = $derived(getRootNode());
	const loads = $derived(getComputedLoads(node_id));
	const voltage_drops = $derived(visited_tabs['voltage-drop'] ? getComputedVoltageDrops() : []);

	// Column definitions are expensive to rebuild and invalidate TanStack's
	// row model, so keep them stable across tab switches.
	const load_columns = $derived(
		current_node ? onePhaseMainOrWyeCols(current_node as PhaseLoadSchedule) : []
	);
	const voltage_drop_columns = voltageDropColumns();

	onMount(() => {
		// Computing the whole tree and building its row model is the expensive
		// part of the first switch to Voltage Drop. Warm both while idle (and
		// off the main thread when a worker is available) so the switch itself
		// only reveals already-rendered rows.
		const warm_voltage_drops = () => {
			void getComputedVoltageDropsAsync()
				.then(() => {
					visited_tabs['voltage-drop'] = true;
				})
				.catch(() => {
					visited_tabs['voltage-drop'] = true;
				});
		};
		if (typeof requestIdleCallback === 'function') {
			const idle_id = requestIdleCallback(warm_voltage_drops, { timeout: 500 });
			return () => cancelIdleCallback(idle_id);
		}
		const timeout_id = setTimeout(warm_voltage_drops, 150);
		return () => clearTimeout(timeout_id);
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
</script>

<div class="flex min-h-0 w-full flex-1 flex-col gap-2">
	<div
		class="border-border bg-card flex flex-col gap-4 rounded-2xl border px-5 py-4 shadow-(--surface-shadow) lg:flex-row lg:items-center"
	>
		<div class="flex items-center gap-3 border-b pb-4 lg:border-r lg:border-b-0 lg:pr-5 lg:pb-0">
			<div
				class="bg-primary/10 text-primary border-primary/15 grid size-11 shrink-0 place-items-center rounded-xl border"
			>
				<LightningAIcon class="size-5" />
			</div>
			<div class="grid gap-0.5">
				<span class="text-muted-foreground text-[9px] font-semibold tracking-[0.24em] uppercase"
					>Distribution Unit</span
				>
				<span class="text-base leading-5 font-bold tracking-tight">
					{current_node?.panel_data?.name ??
						current_node?.highest_unit_form?.distribution_unit ??
						'NOT FOUND'}
				</span>
			</div>
		</div>

		<dl class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-0">
			<div class="grid gap-0.5 lg:border-r lg:px-5">
				<dt class="text-muted-foreground text-[9px] font-semibold tracking-[0.24em] uppercase">
					Phase System
				</dt>
				<dd class="text-sm font-medium">
					{getOptionLabel(DEFAULT_PHASES, root_node?.highest_unit_form?.phase) || '-'}
				</dd>
			</div>

			<div class="grid gap-0.5 lg:px-5">
				<dt class="text-muted-foreground text-[9px] font-semibold tracking-[0.24em] uppercase">
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
		onValueChange={(value) => (visited_tabs[value] = true)}
		class="min-h-0 w-full flex-1"
	>
		<Tabs.List class="place-self-end">
			<Tabs.Trigger value="load-sched">Load Schedule</Tabs.Trigger>
			<Tabs.Trigger value="voltage-drop">Voltage Drop</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="load-sched" class="flex min-h-0 flex-1 flex-col">
			{#if current_node}
				<DataTable
					data={loads}
					columns={load_columns}
					highest_unit={root_node?.highest_unit_form}
					is_footer_shown={current_node.node_type !== 'root'}
				/>
			{:else}
				<div class="text-muted-foreground grid min-h-0 flex-1 place-items-center text-sm">
					Could not load the schedule.
				</div>
			{/if}
		</Tabs.Content>
		<Tabs.Content value="voltage-drop" class="flex min-h-0 flex-1 flex-col">
			<DataTable
				data={voltage_drops}
				is_footer_shown={false}
				columns={voltage_drop_columns}
				is_in_vd_table
			/>
		</Tabs.Content>
	</Tabs.Root>
</div>
