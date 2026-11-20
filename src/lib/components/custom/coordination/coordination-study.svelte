<script lang="ts" module>
	import type { CoordinationPair, CoordinationStatus } from '#lib/types/coordination.js';

	type Group = {
		downstream: CoordinationPair['downstream'];
		section: string;
		pairs: CoordinationPair[];
	};

	/** The pairs of each downstream device together; the engine lists them consecutively. */
	export function groupByDownstream(pairs: CoordinationPair[]): Group[] {
		const groups: Group[] = [];
		for (const pair of pairs) {
			const last = groups.at(-1);
			if (last?.downstream.id === pair.downstream.id) last.pairs.push(pair);
			else groups.push({ downstream: pair.downstream, section: pair.section, pairs: [pair] });
		}
		return groups;
	}

	const STATUS: Record<CoordinationStatus['kind'], { label: string; tone: string }> = {
		exempt: { label: 'Exempt: in series, nothing in parallel', tone: 'text-muted-foreground' },
		not_selective: {
			label: 'Not selective: rated at or above supply side',
			tone: 'text-destructive'
		},
		documented: { label: 'Documented', tone: 'text-primary' },
		needs_documentation: {
			label: 'Needs documented selection',
			tone: 'text-amber-600 dark:text-amber-400'
		}
	};

	const amps = (value: number | null) =>
		value == null ? '-' : `${Math.round(value).toLocaleString()} A`;
</script>

<script lang="ts">
	import { getNode, getCoordinationAsync, getSnapshotRevision } from '#lib/db/queries/index.js';
	import ReferenceForm from './reference-form.svelte';

	let pairs = $state<CoordinationPair[]>([]);
	let loaded = $state(false);
	const groups = $derived(groupByDownstream(pairs));

	// The engine answers asynchronously; stale answers are dropped (external async, so an effect).
	$effect(() => {
		const revision = getSnapshotRevision();
		void getCoordinationAsync()
			.then((study) => {
				if (getSnapshotRevision() !== revision) return;
				pairs = study;
				loaded = true;
			})
			.catch((error: unknown) => console.error('Coordination study failed:', error));
	});
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
	<p class="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
		PEC 2017 requires the overcurrent devices of emergency (7.0.6.3), legally required standby
		(7.1.4.3), critical operations power (7.8.4.5) and critical operations data (6.45.1.27) systems
		to be selectively coordinated with all supply-side devices, selected and documented by a
		licensed professional electrical engineer. Mark those panels by their System; read each pair in
		the manufacturer's selectivity table at the available fault current, and record what you used.
	</p>
	{#if loaded && groups.length === 0}
		<div class="grid flex-1 place-items-center text-sm text-muted-foreground">
			No panel is marked as one of these systems.
		</div>
	{/if}
	{#each groups as group (group.downstream.id)}
		{@const stored = getNode(group.downstream.id)?.coordination_reference}
		<section class="grid gap-3 rounded-2xl border border-border bg-card px-5 py-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h3 class="font-semibold">
					{group.downstream.name}
					<span class="font-normal text-muted-foreground"
						>· {group.downstream.at} AT / {group.downstream.af} AF</span
					>
				</h3>
				<span class="text-xs text-muted-foreground">
					PEC {group.section} · available fault {amps(group.pairs[0].available_fault_current)}
				</span>
			</div>
			<ul class="grid gap-1 text-sm">
				{#each group.pairs as pair (pair.upstream.id)}
					<li class="flex flex-wrap justify-between gap-x-3">
						<span>with {pair.upstream.name} ({pair.upstream.at} AT / {pair.upstream.af} AF)</span>
						<span class={STATUS[pair.status.kind].tone}>{STATUS[pair.status.kind].label}</span>
					</li>
				{/each}
			</ul>
			<!-- Remount on undo/redo too, so the input never shows a reference that was undone. -->
			{#key stored}
				<ReferenceForm node_id={group.downstream.id} reference={stored} />
			{/key}
		</section>
	{/each}
</div>
