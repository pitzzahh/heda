<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import type { RiserTree } from '#lib/types/riser.js';

	interface Props {
		/** The panel (or the project root) the diagram starts from. */
		node_id: string;
	}

	const points = (wire: [number, number][]) => wire.map(([x, y]) => `${x},${y}`).join(' ');

	/** A panelboard and everything below it, from the engine's computed rows. */
	function buildTree(
		row: PhaseLoadSchedule,
		loadsOf: (id: string) => PhaseLoadSchedule[]
	): RiserTree {
		const children = loadsOf(row.id);
		return {
			row,
			panels: children
				.filter((child) => child.node_type === 'panel')
				.map((child) => buildTree(child, loadsOf)),
			branch_ats: children.filter((child) => child.node_type !== 'panel').map((child) => child.at)
		};
	}
</script>

<script lang="ts">
	import { getComputedLoads, getNodeById } from '#lib/db/queries/index.js';
	import { LINE, layoutRiser } from './layout.js';

	let { node_id }: Props = $props();

	const start = $derived(getNodeById(node_id) as PhaseLoadSchedule | null);
	const drawn = $derived.by(() => {
		if (!start) return undefined;
		const tree = buildTree(start, getComputedLoads);
		return start.node_type === 'root'
			? layoutRiser(tree, start.highest_unit_form ?? {})
			: layoutRiser(tree);
	});
</script>

{#if drawn}
	<div class="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card p-2">
		<svg
			width={drawn.width}
			height={drawn.height}
			viewBox="0 0 {drawn.width} {drawn.height}"
			role="img"
			aria-label="Riser diagram"
			class="font-sans text-foreground"
			font-size="12"
		>
			<g fill="none" stroke="currentColor" stroke-width="1.5">
				{#each drawn.wires as wire, i (i)}
					<polyline points={points(wire)} />
				{/each}
			</g>
			{#each drawn.boxes as box (box.id)}
				<!-- PEC 2017 Appendix A 1.14: a panelboard is a plain rectangle. -->
				<rect
					x={box.x}
					y={box.y}
					width={box.width}
					height={box.height}
					rx="2"
					class="fill-card"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<text x={box.x + 12} y={box.y + 12 + LINE - 4} font-weight="700" fill="currentColor"
					>{box.title}</text
				>
				{#each box.lines as line, i (i)}
					<text x={box.x + 12} y={box.y + 12 + LINE * (i + 2) - 4} class="fill-muted-foreground"
						>{line}</text
					>
				{/each}
			{/each}
			{#each drawn.labels as label (label.id)}
				{#each label.lines as line, i (i)}
					<text x={label.x} y={label.y + LINE * i} font-size="11" fill="currentColor">{line}</text>
				{/each}
			{/each}
			{#if drawn.meter}
				{@const [mx, my] = drawn.meter}
				<!-- Appendix A 1.7: kilowatt-hour meter. -->
				<circle cx={mx} cy={my} r="9" class="fill-card" stroke="currentColor" stroke-width="1.5" />
				<text
					x={mx}
					y={my + 4}
					text-anchor="middle"
					font-size="10"
					font-weight="700"
					fill="currentColor">M</text
				>
			{/if}
			{#if drawn.ground}
				{@const [gx, gy] = drawn.ground}
				<!-- Appendix A 1.3: earth ground, for the equipment grounding of 1.3.2.1(G)(4)(c). -->
				<g stroke="currentColor" stroke-width="1.5">
					<line x1={gx + 12} y1={gy} x2={gx + 12} y2={gy + 14} />
					<line x1={gx + 2} y1={gy + 14} x2={gx + 22} y2={gy + 14} />
					<line x1={gx + 6} y1={gy + 18} x2={gx + 18} y2={gy + 18} />
					<line x1={gx + 10} y1={gy + 22} x2={gx + 14} y2={gy + 22} />
				</g>
			{/if}
		</svg>
	</div>
{:else}
	<div class="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
		Could not draw the riser diagram.
	</div>
{/if}
