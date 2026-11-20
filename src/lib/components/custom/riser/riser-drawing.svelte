<script lang="ts" module>
	import type { RiserItems, RiserLayout } from '#lib/types/riser.js';

	interface Props {
		layout: RiserLayout;
		/** What to draw one element each, culled to the view (the engine writes the export, `riser_svg.rs`). */
		items: RiserItems;
		/** Text, breakers and wire counts; off when zoomed out too far to read them. */
		detail: boolean;
		/** Pan and zoom, on screen. */
		transform?: string;
		class?: string;
	}
</script>

<script lang="ts">
	import { BREAKER_HEIGHT, LINE, TRANSFORMER_HEIGHT, boxPath, wirePath } from './layout.js';

	let { layout, items, detail, transform, class: className }: Props = $props();

	// One path each, rebuilt only when the layout changes, never while panning.
	const wires = $derived(wirePath(layout.wires));
	const outlines = $derived(detail ? '' : boxPath(layout.boxes));
	// Zoomed out, lines keep their width on screen instead of thinning to nothing.
	const stroke_effect = $derived(detail ? undefined : 'non-scaling-stroke');
</script>

<svg class={className} role="img" aria-label="Riser diagram" font-size="12">
	<defs>
		<!-- PEC 2017 Appendix A 1.11: circuit breaker, terminals and the arc between. -->
		<symbol id="riser-breaker" overflow="visible">
			<circle r="2.5" fill="currentColor" />
			<path d="M0 0 A11 11 0 0 1 0 {BREAKER_HEIGHT}" fill="none" />
			<circle cy={BREAKER_HEIGHT} r="2.5" fill="currentColor" />
		</symbol>
		<!-- Appendix A 1.37: one cross-line per wire. -->
		<symbol id="riser-tick" overflow="visible">
			<line x1="-5" y1="3" x2="5" y2="-3" />
		</symbol>
		<!-- Appendix A 3.1: transformer with two separate windings. -->
		<symbol id="riser-transformer" overflow="visible">
			<line x1="0" y1="0" x2="0" y2="11" />
			<path d="M-15 16 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0" fill="none" />
			<path d="M-15 24 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0" fill="none" />
			<line x1="0" y1="29" x2="0" y2={TRANSFORMER_HEIGHT} />
		</symbol>
	</defs>
	<g data-viewport {transform} stroke="currentColor" stroke-width="1.5">
		<path d={wires} fill="none" vector-effect={stroke_effect} />
		{#if layout.transformer}
			<use href="#riser-transformer" x={layout.transformer[0]} y={layout.transformer[1]} />
		{/if}
		{#if detail}
			{#each items.breakers as [x, y] (`${x},${y}`)}
				<use href="#riser-breaker" {x} {y} />
			{/each}
			{#each items.ticks as tick (`${tick.x},${tick.y}`)}
				{#each { length: tick.count }, n (n)}
					<use href="#riser-tick" x={tick.x} y={tick.y + n * 5} />
				{/each}
			{/each}
			{#each items.boxes as box (box.id)}
				<!-- Appendix A 1.14: a panelboard is a plain rectangle. -->
				<rect x={box.x} y={box.y} width={box.width} height={box.height} rx="2" class="fill-card" />
				<text
					x={box.x + 12}
					y={box.y + 12 + LINE - 4}
					font-weight="700"
					fill="currentColor"
					stroke="none">{box.title}</text
				>
				{#each box.lines as line, i (i)}
					<text
						x={box.x + 12}
						y={box.y + 12 + LINE * (i + 2) - 4}
						class="fill-muted-foreground"
						stroke="none">{line}</text
					>
				{/each}
			{/each}
			{#each items.labels as label (label.id)}
				{#each label.lines as line, i (i)}
					<text x={label.x} y={label.y + LINE * i} font-size="11" fill="currentColor" stroke="none"
						>{line}</text
					>
				{/each}
			{/each}
		{:else}
			<path d={outlines} class="fill-card" vector-effect={stroke_effect} />
		{/if}
		{#if layout.meter}
			{@const [mx, my] = layout.meter}
			<!-- Appendix A 1.7: kilowatt-hour meter. -->
			<circle cx={mx} cy={my} r="9" class="fill-card" />
			<text
				x={mx}
				y={my + 4}
				text-anchor="middle"
				font-size="10"
				font-weight="700"
				fill="currentColor"
				stroke="none">M</text
			>
		{/if}
		{#if layout.ground}
			{@const [gx, gy] = layout.ground}
			<!-- Appendix A 1.3: earth ground, for the equipment grounding of 1.3.2.1(G)(4)(c). -->
			<line x1={gx + 12} y1={gy} x2={gx + 12} y2={gy + 14} />
			<line x1={gx + 2} y1={gy + 14} x2={gx + 22} y2={gy + 14} />
			<line x1={gx + 6} y1={gy + 18} x2={gx + 18} y2={gy + 18} />
			<line x1={gx + 10} y1={gy + 22} x2={gx + 14} y2={gy + 22} />
		{/if}
	</g>
</svg>
