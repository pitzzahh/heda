import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import type {
	RiserBox,
	RiserItems,
	RiserLabel,
	RiserLayout,
	RiserSource,
	RiserTree
} from '#lib/types/riser.js';
import type { Rect } from './viewport.js';
import { DEFAULT_PHASES, default_phases } from '#lib/constants.js';
import { getOptionLabel } from '#lib/utils/format.js';

/**
 * Layout of the riser (one-line) diagram, PEC 2017 1.3.2.1(G): each panelboard with
 * its main and branch circuit ratings ((1)(a)), each feeder labelled with its wire
 * size and type, raceway, protective device and allowable ampacity over design load
 * current as a ratio ((3)(a)–(d)), and the load center's incoming supply ((4)).
 * Every value comes from the engine's computed rows; this only places text.
 */

export const COLUMN = 300;
export const BOX_WIDTH = 240;
export const LINE = 16;
const PADDING = 12;
const MARGIN = 24;
/** Feeder labels have five lines; the drop to each panel leaves room for them. */
const DROP = 5 * LINE + 40;
const BUS = 24;
const BRANCHES_PER_LINE = 4;
/** Feeder labels start beside their drop and can run past the last column. */
const LABEL_OVERHANG = 100;
/** The circuit breaker symbol (Appendix A 1.11) breaks the feeder this far below the bus. */
const BREAKER_AT = 8;
export const BREAKER_HEIGHT = 22;
/** Where the cross-lines counting the wires (Appendix A 1.37) sit on a feeder. */
const TICKS_AT = 48;
/** Room above the service for the transformer (Appendix A 3.1). */
const TRANSFORMER_SPACE = 64;
/** Height of the transformer symbol, leads included. */
export const TRANSFORMER_HEIGHT = 40;

/** Like the Excel export: -1 (none in the table) prints as "-". */
const size = (value: number | string | undefined) =>
	value === undefined ? '-' : value === -1 ? '-' : String(value);

/** Branch breakers by rating, largest first: "6 × 20 AT". */
export function branchSummary(ats: number[]): string[] {
	const counts = new Map<number, number>();
	for (const at of ats) counts.set(at, (counts.get(at) ?? 0) + 1);
	const groups = [...counts].sort(([a], [b]) => b - a).map(([at, count]) => `${count} × ${at} AT`);
	const lines: string[] = [];
	for (let i = 0; i < groups.length; i += BRANCHES_PER_LINE) {
		lines.push(groups.slice(i, i + BRANCHES_PER_LINE).join(', '));
	}
	return lines.length ? ['Branch CBs:', ...lines] : ['No branch circuits'];
}

/** The five lines beside a feeder, PEC 2017 1.3.2.1(G)(3). */
export function feederLines(row: PhaseLoadSchedule): string[] {
	const sets = row.conductor_sets ?? 1;
	const ratio =
		row.ampacity !== undefined && row.current > 0
			? `${row.ampacity} A / ${row.current} A = ${(row.ampacity / row.current).toFixed(2)}`
			: '-';
	return [
		`CKT ${row.circuit_number ?? '-'}: ${row.at ?? '-'} AT / ${row.ampere_frames ?? '-'} AF, ${row.pole ?? '-'}P`,
		`${sets > 1 ? `${sets} sets × ` : ''}${row.conductor_qty ?? '-'} × ${size(row.conductor_size)} mm² ${row.conductor_insulation ?? ''}`.trim(),
		['+ 1 ×', size(row.egc_size), 'mm²', row.egc_insulation, 'EGC'].filter(Boolean).join(' '),
		`in ${size(row.conduit_size)} mm ø ${row.conduit_type ?? ''}`.trim(),
		`Ampacity/load: ${ratio}`
	];
}

function panelBox(tree: RiserTree): Pick<RiserBox, 'id' | 'title' | 'lines'> {
	const { row } = tree;
	const phase = getOptionLabel(DEFAULT_PHASES, row.panel_data?.phase);
	return {
		id: row.id,
		title: row.panel_data?.name ?? row.load_description ?? 'Panel',
		lines: [
			[phase, row.voltage ? `${row.voltage} V` : ''].filter(Boolean).join(' · '),
			`Main: ${row.at ?? '-'} AT / ${row.ampere_frames ?? '-'} AF`,
			...branchSummary(tree.branch_ats)
		]
	};
}

const boxHeight = (lines: number) => PADDING * 2 + LINE * (lines + 1);

function leaves(tree: RiserTree): number {
	return tree.panels.length ? tree.panels.reduce((sum, p) => sum + leaves(p), 0) : 1;
}

/**
 * Places the panels top-down, each centred over the panels it feeds. With a `source`,
 * `tree` is the service (the project root) and its box shows the supply; otherwise
 * `tree` is a panel and its own feeder is drawn coming in from above.
 */
export function layoutRiser(tree: RiserTree, source?: RiserSource): RiserLayout {
	const boxes: RiserBox[] = [];
	const wires: [number, number][][] = [];
	const labels: RiserLabel[] = [];
	const breakers: [number, number][] = [];
	const ticks: RiserLayout['ticks'] = [];
	const source_lines = source ? sourceLines(source) : [];
	const linesOf = (node: RiserTree, depth: number) =>
		source && depth === 0 ? source_lines : panelBox(node).lines;

	// A level starts below the tallest box of the one above it.
	const level_height: number[] = [];
	(function measure(node: RiserTree, depth: number) {
		const height = boxHeight(linesOf(node, depth).length);
		level_height[depth] = Math.max(level_height[depth] ?? 0, height);
		for (const panel of node.panels) measure(panel, depth + 1);
	})(tree, 0);
	const level_y: number[] = [];
	const has_transformer = !!source?.transformer_kva;
	let bottom = MARGIN + (source ? (has_transformer ? TRANSFORMER_SPACE : 0) : DROP);
	for (const height of level_height) {
		level_y.push(bottom);
		bottom += height + BUS + DROP;
	}

	/** A feeder from `top` down to its panel at `bottom`: breaker, wire count, label. */
	function feeder(row: RiserTree['row'], x: number, top: number, bottom: number) {
		const breaker_top = top + BREAKER_AT;
		wires.push(
			[
				[x, top],
				[x, breaker_top]
			],
			[
				[x, breaker_top + BREAKER_HEIGHT],
				[x, bottom]
			]
		);
		breakers.push([x, breaker_top]);
		if (row.conductor_qty) ticks.push({ x, y: top + TICKS_AT, count: row.conductor_qty });
		labels.push({ id: row.id, x: x + 16, y: top + LINE + 4, lines: feederLines(row) });
	}

	(function place(node: RiserTree, depth: number, left: number): number {
		const cx = left + (leaves(node) * COLUMN) / 2;
		const top = level_y[depth]!;
		const box =
			source && depth === 0
				? { id: node.row.id, title: source.distribution_unit ?? 'Service', lines: source_lines }
				: panelBox(node);
		const height = boxHeight(box.lines.length);
		boxes.push({ ...box, x: cx - BOX_WIDTH / 2, y: top, width: BOX_WIDTH, height });

		if (depth === 0 && has_transformer) {
			wires.push([
				[cx, MARGIN + TRANSFORMER_HEIGHT],
				[cx, top]
			]);
		}
		if (depth === 0 && !source) {
			// The start panel's own feeder, from a supply the diagram does not draw.
			feeder(node.row, cx, top - DROP, top);
		}

		let child_left = left;
		const centres = node.panels.map((panel) => {
			const child_cx = place(panel, depth + 1, child_left);
			child_left += leaves(panel) * COLUMN;
			return child_cx;
		});
		if (centres.length) {
			const bus_y = top + height + BUS;
			wires.push(
				[
					[cx, top + height],
					[cx, bus_y]
				],
				[
					[Math.min(cx, ...centres), bus_y],
					[Math.max(cx, ...centres), bus_y]
				]
			);
			node.panels.forEach((panel, i) => {
				feeder(panel.row, centres[i]!, bus_y, level_y[depth + 1]!);
			});
		}
		return cx;
	})(tree, 0, MARGIN);

	const service = source ? boxes[0] : undefined;
	return {
		width: leaves(tree) * COLUMN + MARGIN * 2 + LABEL_OVERHANG,
		height: bottom - BUS - DROP + MARGIN,
		boxes,
		wires,
		labels,
		breakers,
		ticks,
		...(service &&
			has_transformer && {
				transformer: [service.x + service.width / 2, MARGIN] as [number, number]
			}),
		...(service && {
			ground: [service.x, service.y + service.height] as [number, number],
			meter: [service.x + service.width / 2, service.y + service.height + BUS / 2] as [
				number,
				number
			]
		})
	};
}

/** System voltages of PEC 2017 2.20.1.5(A), as the schedule header shows them. */
const SUPPLY_VOLTAGE: Record<string, string> = {
	[default_phases.ONE_PHASE]: '230 V',
	[default_phases.THREE_PHASE_WYE]: '400Y/230 V',
	[default_phases.THREE_PHASE_DELTA]: '230 V'
};

function sourceLines(source: RiserSource): string[] {
	const phase = getOptionLabel(DEFAULT_PHASES, source.phase);
	return [
		[phase, SUPPLY_VOLTAGE[source.phase ?? '']].filter(Boolean).join(' · '),
		source.transformer_kva ? `Transformer: ${source.transformer_kva} kVA` : '',
		source.utility_sc_kva ? `Utility fault level: ${source.utility_sc_kva} kVA` : ''
	].filter(Boolean);
}

/** Widest a feeder label runs from its x (five lines of about 40 characters at 11 px). */
const LABEL_WIDTH = 240;

/** Everything of the layout that falls in `rect`; all of it when `rect` is omitted. */
export function visibleItems(layout: RiserLayout, rect?: Rect): RiserItems {
	if (!rect) return layout;
	const within = (left: number, top: number, right: number, bottom: number) =>
		right >= rect.left && left <= rect.right && bottom >= rect.top && top <= rect.bottom;
	return {
		boxes: layout.boxes.filter((b) => within(b.x, b.y, b.x + b.width, b.y + b.height)),
		labels: layout.labels.filter((l) =>
			within(l.x, l.y - LINE, l.x + LABEL_WIDTH, l.y + LINE * l.lines.length)
		),
		breakers: layout.breakers.filter(([x, y]) => within(x - 12, y, x + 12, y + BREAKER_HEIGHT)),
		ticks: layout.ticks.filter((t) => within(t.x - 6, t.y - 4, t.x + 6, t.y + t.count * 5))
	};
}

/** Every wire as one path, so the browser draws them as a single element. */
export function wirePath(wires: RiserLayout['wires']): string {
	return wires
		.map((wire) => wire.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''))
		.join('');
}

/** Every panelboard outline as one path, for the zoomed-out view. */
export function boxPath(boxes: RiserBox[]): string {
	return boxes.map((b) => `M${b.x} ${b.y}h${b.width}v${b.height}h${-b.width}Z`).join('');
}
