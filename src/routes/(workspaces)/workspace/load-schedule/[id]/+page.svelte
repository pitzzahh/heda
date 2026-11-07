<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
</script>

<script lang="ts">
	import { DataTable } from '#lib/components/custom/table';
	import { page } from '$app/state';
	import { onePhaseMainOrWyeCols } from '#lib/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import {
		getComputedLoads,
		getComputedVoltageDrops,
		getNodeById,
		getRootNode
	} from '#lib/db/queries/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { voltageDropColumns } from '#lib/components/custom/table/voltage-drop-cols/voltage-drop-cols.js';
	import { LightningAIcon } from '#lib/assets/icons';
	import { getProjectState } from '#lib/hooks/project-state.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Skeleton } from '#lib/components/ui/skeleton';

	const params = $derived(page.params);
	const node_id = $derived(params.id!.split('_').at(-1) as string);
	const project_state = getProjectState();
	const db_revisions = getDbRevisionsState();

	// Live schedule rows: recomputes only when `dbRevisions.schedule` changes
	// or the route's node id changes. No `$effect`, no `depends`, no invalidate.
	const schedule = $derived.by(async () => {
		void db_revisions.schedule;
		const [current_node, loads, voltage_drops, root_node] = await Promise.all([
			getNodeById(node_id),
			getComputedLoads(node_id),
			getComputedVoltageDrops(),
			getRootNode()
		]);
		return { current_node, loads, voltage_drops, root_node };
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
					{#await getNodeById(node_id)}
						<Skeleton class="h-5 w-36" />
					{:then current_node}
						{current_node?.panel_data?.name ??
							current_node?.highest_unit_form?.distribution_unit ??
							'NOT FOUND'}
					{/await}
				</span>
			</div>
		</div>

		<dl class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-0">
			<div class="grid gap-0.5 lg:border-r lg:px-5">
				<dt class="text-muted-foreground text-[9px] font-semibold tracking-[0.24em] uppercase">
					Phase System
				</dt>
				<dd class="text-sm font-medium">
					{#await getRootNode()}
						<Skeleton class="h-5 w-24" />
					{:then root_node}
						{root_node?.highest_unit_form?.phase ?? '-'}
					{/await}
				</dd>
			</div>

			<div class="grid gap-0.5 lg:px-5">
				<dt class="text-muted-foreground text-[9px] font-semibold tracking-[0.24em] uppercase">
					Supply From
				</dt>
				<dd class="truncate text-sm font-medium">
					{#await getNodeById(node_id)}
						<Skeleton class="h-5 w-36" />
					{:then current_node}
						{@const parent_id = current_node?.parent_id}
						{#if parent_id}
							{#await getNodeById(parent_id)}
								<Skeleton class="h-5 w-36" />
							{:then parent_node}
								{parent_node?.panel_data?.name ??
									parent_node?.highest_unit_form?.distribution_unit ??
									'-'}
							{/await}
						{:else}
							-
						{/if}
					{/await}
				</dd>
			</div>
		</dl>
	</div>
	<Tabs.Root value="load-sched" class="min-h-0 w-full flex-1">
		<Tabs.List class="place-self-end">
			<Tabs.Trigger value="load-sched">Load Schedule</Tabs.Trigger>
			<Tabs.Trigger value="voltage-drop">Voltage Drop</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="load-sched" class="flex min-h-0 flex-1 flex-col">
			{#await schedule}
				<div class="border-border bg-card grid min-h-0 flex-1 place-items-center rounded-xl border">
					<Skeleton class="h-40 w-2/3" />
				</div>
			{:then schedule_data}
				<DataTable
					data={schedule_data.loads && schedule_data.loads.length > 0 ? schedule_data.loads : []}
					columns={onePhaseMainOrWyeCols(
						schedule_data.current_node as PhaseLoadSchedule,
						schedule_data.root_node?.highest_unit_form
					)}
					is_footer_shown={schedule_data.current_node?.node_type !== 'root'}
				/>
			{:catch}
				<div class="text-muted-foreground grid min-h-0 flex-1 place-items-center text-sm">
					Could not load the schedule.
				</div>
			{/await}
		</Tabs.Content>
		<Tabs.Content value="voltage-drop" class="flex min-h-0 flex-1 flex-col">
			{#await schedule}
				<div class="border-border bg-card grid min-h-0 flex-1 place-items-center rounded-xl border">
					<Skeleton class="h-40 w-2/3" />
				</div>
			{:then schedule_data}
				<DataTable
					data={schedule_data.voltage_drops}
					is_footer_shown={false}
					columns={voltageDropColumns()}
				/>
			{:catch}
				<div class="text-muted-foreground grid min-h-0 flex-1 place-items-center text-sm">
					Could not load voltage drops.
				</div>
			{/await}
		</Tabs.Content>
	</Tabs.Root>
</div>
