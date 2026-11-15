import {
	computeAdjustedCurrent,
	computeAmpereTrip,
	computeConductorSize,
	computeVoltAmpere,
	getConduitSize,
	getEgcSize
} from '#lib/utils/computations/index.js';
import type { LoadType } from '#lib/types/load/index.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

export type LoadComputationContext = {
	children_by_parent: Map<string, Node[]>;
	is_dynamic: boolean;
	memo: Map<string, PhaseLoadSchedule>;
};

export function computeNodeLoad(node: Node, context: LoadComputationContext): PhaseLoadSchedule {
	const memoized = context.memo.get(node.id);
	if (memoized) return memoized;

	const voltage = 230;
	const conductor_set = node.conductor_sets as number;
	const conductor_qty = node.conductor_qty as number;
	const load_data = node.load_data;
	const panel_data = node.panel_data;
	const ambient_temp = load_data?.ambient_temperature || 30;

	const va =
		computeVoltAmpere({
			load_type: load_data?.load_type as LoadType,
			quantity: load_data?.quantity ?? 0,
			varies: Number(load_data?.varies) || 0
		}) || 0;
	const current = va / voltage;
	const at = node.overrided_at || computeAmpereTrip(current, load_data?.load_type as LoadType);
	const conductor_size =
		node.overrided_conductor_size ||
		computeConductorSize({
			set: conductor_set,
			qty: conductor_qty,
			current,
			load_type: load_data?.load_type as LoadType | 'Main',
			at,
			ambient_temp,
			is_adjustment_factor_dynamic: context.is_dynamic
		});
	const adjusted_current = computeAdjustedCurrent({
		set: conductor_set,
		qty: conductor_qty,
		current,
		load_type: load_data?.load_type as LoadType | 'Main',
		at,
		ambient_temp,
		is_adjustment_factor_dynamic: context.is_dynamic
	});
	const conduit_size =
		node.overrided_conduit_size ||
		getConduitSize(conductor_size, conductor_set * conductor_qty + 1);

	let computed: PhaseLoadSchedule;

	if (panel_data) {
		const panel_loads = (context.children_by_parent.get(node.id) ?? []).map((child) =>
			computeNodeLoad(child, context)
		);
		const total_va = panel_loads.reduce((total, load) => total + (load.va || 0), 0);
		const total_current = panel_loads.reduce((total, load) => total + (load.current || 0), 0);
		const main_at = node.overrided_at || computeAmpereTrip(total_current);
		const main_current = parseFloat(total_current.toFixed(2));
		const main_conductor_size =
			node.overrided_conductor_size ||
			computeConductorSize({
				set: conductor_set,
				qty: conductor_qty,
				current: main_current,
				load_type: 'Main',
				at: main_at,
				ambient_temp: panel_data.ambient_temperature,
				is_adjustment_factor_dynamic: context.is_dynamic
			});
		const main_adjusted_current = computeAdjustedCurrent({
			set: conductor_set,
			qty: conductor_qty,
			current: main_current,
			load_type: 'Main',
			at: main_at,
			ambient_temp: panel_data.ambient_temperature,
			is_adjustment_factor_dynamic: context.is_dynamic
		});
		const main_conduit_size =
			node.overrided_conduit_size ||
			getConduitSize(main_conductor_size, conductor_set * conductor_qty + 1);

		computed = {
			...node,
			load_description: panel_data.name || '',
			voltage,
			va: total_va,
			at: main_at,
			current: main_current,
			conductor_size: main_conductor_size,
			egc_size: node.overrided_egc_size || getEgcSize(at),
			adjusted_current: main_adjusted_current,
			conduit_size: main_conduit_size,
			ampere_frames: node.overrided_ampere_frames || main_at
		} as PhaseLoadSchedule;
	} else {
		computed = {
			...node,
			load_description: load_data?.load_description || '',
			voltage,
			va,
			at,
			current: parseFloat(current.toFixed(2)),
			conductor_size,
			egc_size: node.overrided_egc_size || getEgcSize(at),
			adjusted_current,
			conduit_size,
			ampere_frames: node.overrided_ampere_frames || at
		} as PhaseLoadSchedule;
	}

	context.memo.set(node.id, computed);
	return computed;
}
