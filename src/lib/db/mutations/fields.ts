import { findNode, patchNode, patchNodes } from './nodes.js';
import type { ShortCircuitSource } from '#lib/types/short-circuit.js';
import type { FieldType } from '#lib/types/misc.js';
import type { PhaseAssignment } from '#lib/types/phase.js';

export type { FieldType };

const FIELD_TYPE_MAPPING: Record<FieldType, string> = {
	egc_size: 'overrided_egc_size',
	conductor_size: 'overrided_conductor_size',
	at: 'overrided_at',
	conduit_size: 'overrided_conduit_size',
	ampere_frames: 'overrided_ampere_frames',
	length: 'overrided_length',
	z: 'overrided_z'
};

export function overrideField({
	node_id,
	field_data,
	unoverride = false,
	field_type
}: {
	node_id: string;
	field_data?: number;
	unoverride?: boolean;
	field_type: FieldType;
}) {
	try {
		const data = unoverride && !field_data ? undefined : field_data;
		const field_to_update = FIELD_TYPE_MAPPING[field_type];

		return patchNode(node_id, { [field_to_update]: data });
	} catch (err) {
		console.error(`Error overriding data: ${JSON.stringify(err)}`);
	}
}

export function updateConductorSets({ node_id, sets }: { node_id: string; sets: number }) {
	try {
		return patchNode(node_id, { conductor_sets: sets });
	} catch (err) {
		console.error(`Error updating conductor sets: ${JSON.stringify(err)}`);
	}
}

/**
 * The breaker's interrupting rating in kA, as marked on it (PEC 2017 1.10.1.9). Stored as
 * the string the field has always held; unmarked breakers stay at the 5 kA default.
 */
export function updateInterruptingRating({ node_id, kaic }: { node_id: string; kaic: number }) {
	try {
		return patchNode(node_id, { kaic: String(kaic) });
	} catch (err) {
		console.error(`Error updating the interrupting rating: ${JSON.stringify(err)}`);
	}
}

export function updateLoadDescription({
	node_id,
	load_description,
	node_type
}: {
	node_id: string;
	load_description: string;
	node_type: 'panel' | 'load';
}) {
	try {
		const node_data = findNode(node_id);

		return patchNode(node_id, {
			...(node_type === 'panel' &&
				node_data?.panel_data && {
					panel_data: { ...node_data.panel_data, name: load_description }
				}),
			...(node_type === 'load' &&
				node_data?.load_data && {
					load_data: { ...node_data.load_data, load_description }
				})
		});
	} catch (err) {
		console.error(`Error updating conductor load_description: ${JSON.stringify(err)}`);
	}
}

export function changeInsulation({
	node_id,
	insulation,
	type
}: {
	node_id: string;
	insulation: string;
	type: 'egc' | 'conductor';
}) {
	try {
		return patchNode(node_id, {
			...(type === 'egc' && { egc_insulation: insulation }),
			...(type === 'conductor' && { conductor_insulation: insulation })
		});
	} catch (err) {
		console.error(`Error changing insulation: ${JSON.stringify(err)}`);
	}
}

export function changePole(node_id: string, pole: string) {
	try {
		return patchNode(node_id, { pole });
	} catch (err) {
		console.error(`Error changing pole: ${JSON.stringify(err)}`);
	}
}

export function useAtAsCurrentsValue(node_id: string, is_use: boolean) {
	try {
		return patchNode(node_id, { is_at_used_as_currents_value: is_use });
	} catch (err) {
		console.error(`Error changing data: ${JSON.stringify(err)}`);
	}
}

/** Stores the PEC 2017 App. D Ex. D14 source data on the root node, keeping its other unit fields. */
export function updateShortCircuitSource(root_id: string, source: ShortCircuitSource) {
	try {
		const root = findNode(root_id);
		if (root?.node_type !== 'root') return undefined;
		return patchNode(root_id, { highest_unit_form: { ...root.highest_unit_form, ...source } });
	} catch (err) {
		console.error(`Error updating short-circuit source: ${JSON.stringify(err)}`);
	}
}

/**
 * Marks whether the utility service supplies the project. When it does, the first
 * panel on the supply holds the service disconnecting means and takes the minimum
 * rating of PEC 2017 2.30.6.10; a supply that is itself a feeder skips it.
 */
export function setServiceEntrance(root_id: string, is_service: boolean) {
	try {
		const root = findNode(root_id);
		if (root?.node_type !== 'root') return undefined;
		return patchNode(root_id, { highest_unit_form: { ...root.highest_unit_form, is_service } });
	} catch (err) {
		console.error(`Error updating the service entrance: ${JSON.stringify(err)}`);
	}
}

/** Overrides the circuit-number phase (or delta line pair) of a circuit; undefined restores the default. */
export function changePhaseAssignment(node_id: string, phase: PhaseAssignment | undefined) {
	try {
		return patchNode(node_id, { phase_assignment: phase });
	} catch (err) {
		console.error(`Error changing phase assignment: ${JSON.stringify(err)}`);
	}
}

/** Sets the phase of several circuits in one write; `undefined` clears an override. */
export function changePhaseAssignments(changes: [node_id: string, PhaseAssignment | undefined][]) {
	try {
		return patchNodes(changes.map(([node_id, phase]) => [node_id, { phase_assignment: phase }]));
	} catch (err) {
		console.error(`Error changing phase assignments: ${JSON.stringify(err)}`);
		return [];
	}
}
