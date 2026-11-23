<script lang="ts" module>
	import type { RiserLayout } from '#lib/types/riser.js';
	import type { View } from './viewport.js';

	interface Props {
		/** The panel (or the project root) the diagram starts from. */
		node_id: string;
	}

	const ZOOM_STEP = 1.25;
	const PAN_STEP = 48;
	/** Arrow keys move the view, so the diagram moves the other way. */
	const PAN_KEYS: Partial<Record<string, [number, number]>> = {
		ArrowLeft: [PAN_STEP, 0],
		ArrowRight: [-PAN_STEP, 0],
		ArrowUp: [0, PAN_STEP],
		ArrowDown: [0, -PAN_STEP]
	};

	const transformOf = (view: View) => `translate(${view.x} ${view.y}) scale(${view.k})`;
</script>

<script lang="ts">
	import {
		CornersOutIcon,
		ExportIcon,
		MagnifyingGlassMinusIcon,
		MagnifyingGlassPlusIcon
	} from '#lib/assets/icons.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getRiserAsync } from '#lib/db/queries/index.js';
	import { getSnapshotRevision } from '#lib/db/queries/snapshot.js';
	import { exportRiserSvg } from '#lib/helpers/export/riser-svg.js';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import RiserDrawing from './riser-drawing.svelte';
	import { visibleItems } from './layout.js';
	import { DETAIL_ZOOM, fitView, visibleRect, zoomAt } from './viewport.js';

	let { node_id }: Props = $props();
	let frame = $state<HTMLDivElement>();
	let frame_size = $state({ width: 0, height: 0 });
	let view = $state<View>({ x: 0, y: 0, k: 1 });
	let dragging = $state(false);

	// Laid out by the engine once per data change; panning and zooming only move one transform.
	let drawn = $state<RiserLayout | null>();
	// The node `drawn` is for, and the last one fitted: each new diagram is fitted once.
	let drawn_id: string | undefined;
	let fitted_id: string | undefined;
	// The engine answers asynchronously; stale answers are dropped (external async, so an effect).
	$effect(() => {
		const revision = getSnapshotRevision();
		const id = node_id;
		void getRiserAsync(id)
			.then((layout) => {
				if (getSnapshotRevision() !== revision || id !== node_id) return;
				drawn = layout;
				drawn_id = id;
				autoFit();
			})
			.catch((error: unknown) => {
				console.error('Riser layout failed:', error);
				drawn = null;
			});
	});
	const detail = $derived(view.k >= DETAIL_ZOOM);
	// Only what the frame shows goes into the DOM; zoomed out, outlines are one path anyway.
	const items = $derived(
		drawn && detail ? visibleItems(drawn, visibleRect(view, frame_size)) : undefined
	);

	// Pointers down on the frame, for drag (one) and pinch (two).
	const pointers = new SvelteMap<number, { x: number; y: number }>();
	// The next view, committed once per animation frame however many events arrive.
	let pending: View | undefined;
	let frame_request = 0;

	function setView(next: View) {
		pending = next;
		frame_request ||= requestAnimationFrame(() => {
			frame_request = 0;
			if (pending) view = pending;
			pending = undefined;
		});
	}

	function current(): View {
		return pending ?? view;
	}

	function fit() {
		// A frame with no size yet (hidden) has nothing to fit to.
		if (!frame?.clientWidth || !drawn) return;
		setView(fitView(drawn, { width: frame.clientWidth, height: frame.clientHeight }));
	}

	// Fits a newly drawn node once the frame has a size; later data changes keep the view.
	function autoFit() {
		if (!frame?.clientWidth || !drawn || drawn_id === fitted_id) return;
		fitted_id = drawn_id;
		fit();
	}

	function zoomCentre(factor: number) {
		if (!frame) return;
		setView(zoomAt(current(), factor, frame.clientWidth / 2, frame.clientHeight / 2));
	}

	function local(event: PointerEvent | WheelEvent) {
		const rect = frame!.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	// The frame: fits the diagram once it has a size, and takes wheel zoom (a
	// non-passive listener, so the page does not scroll under the diagram). It is an ARIA
	// application that handles its own keys; Svelte's a11y checks do not list that role as
	// interactive, so its focus and key listener are set up here rather than in markup.
	function attachFrame(element: HTMLDivElement) {
		frame = element;
		element.tabIndex = 0;
		untrack(autoFit);
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const { x, y } = local(event);
			// Trackpad pinches arrive as ctrl+wheel with small deltas; scale either the same way.
			setView(zoomAt(current(), Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002)), x, y));
		};
		element.addEventListener('wheel', onWheel, { passive: false });
		element.addEventListener('keydown', onKeyDown);
		const resize = new ResizeObserver(() => {
			frame_size = { width: element.clientWidth, height: element.clientHeight };
			autoFit();
		});
		resize.observe(element);
		return () => {
			resize.disconnect();
			element.removeEventListener('wheel', onWheel);
			element.removeEventListener('keydown', onKeyDown);
			cancelAnimationFrame(frame_request);
			frame = undefined;
		};
	}

	function onPointerDown(event: PointerEvent) {
		frame!.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, local(event));
		dragging = true;
	}

	function onPointerMove(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		const point = local(event);
		const others = [...pointers].filter(([id]) => id !== event.pointerId);
		pointers.set(event.pointerId, point);
		const base = current();
		if (others.length === 0) {
			setView({ ...base, x: base.x + point.x - previous.x, y: base.y + point.y - previous.y });
			return;
		}
		// Pinch: zoom by the change in finger spread about their midpoint.
		const other = others[0]![1];
		const before = Math.hypot(previous.x - other.x, previous.y - other.y);
		const after = Math.hypot(point.x - other.x, point.y - other.y);
		if (before > 0) {
			setView(zoomAt(base, after / before, (point.x + other.x) / 2, (point.y + other.y) / 2));
		}
	}

	function onPointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		dragging = pointers.size > 0;
	}

	function onKeyDown(event: KeyboardEvent) {
		const base = current();
		const move = PAN_KEYS[event.key];
		if (event.key === '+' || event.key === '=') zoomCentre(ZOOM_STEP);
		else if (event.key === '-') zoomCentre(1 / ZOOM_STEP);
		else if (event.key === '0') fit();
		else if (move) {
			const [dx, dy] = move;
			setView({ ...base, x: base.x + dx, y: base.y + dy });
		} else return;
		event.preventDefault();
	}

	async function saveSvg() {
		if (!drawn) return;
		try {
			await exportRiserSvg(node_id);
		} catch (error) {
			console.error('Riser export failed:', error);
			toast.error('Could not save the riser diagram');
		}
	}
</script>

{#if drawn}
	<div class="relative flex min-h-80 flex-1 flex-col">
		<!-- Floats over the canvas as a sibling, so its clicks never start a drag. -->
		<div
			class="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg border border-border bg-background/80 p-1 shadow-sm backdrop-blur"
		>
			<Button
				size="icon-sm"
				variant="outline"
				aria-label="Zoom out"
				title="Zoom out (−)"
				onclick={() => zoomCentre(1 / ZOOM_STEP)}
			>
				<MagnifyingGlassMinusIcon />
			</Button>
			<span class="w-12 text-center text-xs text-muted-foreground tabular-nums" aria-live="polite">
				{Math.round(view.k * 100)}%
			</span>
			<Button
				size="icon-sm"
				variant="outline"
				aria-label="Zoom in"
				title="Zoom in (+)"
				onclick={() => zoomCentre(ZOOM_STEP)}
			>
				<MagnifyingGlassPlusIcon />
			</Button>
			<Button
				size="icon-sm"
				variant="outline"
				aria-label="Fit to view"
				title="Fit (0)"
				onclick={fit}
			>
				<CornersOutIcon />
			</Button>
			<Button size="sm" variant="outline" class="ml-1" onclick={saveSvg}>
				<ExportIcon class="size-4" />
				Save SVG
			</Button>
		</div>
		<div
			{@attach attachFrame}
			class={[
				'relative min-h-0 flex-1 touch-none overflow-hidden rounded-xl border border-border bg-card outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
				dragging ? 'cursor-grabbing' : 'cursor-grab'
			]}
			role="application"
			aria-roledescription="pannable diagram"
			aria-label="Riser diagram. Drag to pan, wheel or pinch to zoom; arrow keys pan, + and − zoom, 0 fits."
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<RiserDrawing
				layout={drawn}
				items={items ?? drawn}
				{detail}
				transform={transformOf(view)}
				class="absolute inset-0 size-full font-sans text-foreground"
			/>
		</div>
	</div>
{:else if drawn === null}
	<div class="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
		Could not draw the riser diagram.
	</div>
{:else}
	<div class="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">
		Drawing the riser diagram…
	</div>
{/if}
