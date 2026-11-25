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

/** Sets or (with `unoverride` and no value) clears the user's override of a sized field. */
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
	const data = unoverride && !field_data ? undefined : field_data;
	return patchNode(node_id, { [FIELD_TYPE_MAPPING[field_type]]: data });
}

export function updateConductorSets({ node_id, sets }: { node_id: string; sets: number }) {
	return patchNode(node_id, { conductor_sets: sets });
}

/**
 * The breaker's interrupting rating in kA, as marked on it (PEC 2017 1.10.1.9). Stored as
 * the string the field has always held; unmarked breakers stay at the 5 kA default.
 */
export function updateInterruptingRating({ node_id, kaic }: { node_id: string; kaic: number }) {
	return patchNode(node_id, { kaic: String(kaic) });
}

/** Renames a panel, or sets a load's description; a node without that data stays as it is. */
export async function updateLoadDescription({
	node_id,
	load_description,
	node_type
}: {
	node_id: string;
	load_description: string;
	node_type: 'panel' | 'load';
}) {
	const node = findNode(node_id);
	const merge =
		node_type === 'panel'
			? node?.panel_data && { panel_data: { name: load_description } }
			: node?.load_data && { load_data: { load_description } };
	if (merge) await patchNodes([{ id: node_id, merge }]);
	return findNode(node_id);
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
	return patchNode(node_id, { [`${type}_insulation`]: insulation });
}

export function changePole(node_id: string, pole: string) {
	return patchNode(node_id, { pole });
}

export function useAtAsCurrentsValue(node_id: string, is_use: boolean) {
	return patchNode(node_id, { is_at_used_as_currents_value: is_use });
}

/** Sets fields of the root's unit form, keeping its other fields. */
async function mergeUnitForm(root_id: string, fields: object) {
	if (findNode(root_id)?.node_type !== 'root') return undefined;
	await patchNodes([{ id: root_id, merge: { highest_unit_form: fields } }]);
	return findNode(root_id);
}

/** Stores the PEC 2017 App. D Ex. D14 source data on the root node, keeping its other unit fields. */
export function updateShortCircuitSource(root_id: string, source: ShortCircuitSource) {
	return mergeUnitForm(root_id, source);
}

/**
 * Marks whether the utility service supplies the project. When it does, the first
 * panel on the supply holds the service disconnecting means and takes the minimum
 * rating of PEC 2017 2.30.6.10; a supply that is itself a feeder skips it.
 */
export function setServiceEntrance(root_id: string, is_service: boolean) {
	return mergeUnitForm(root_id, { is_service });
}

/**
 * Marks the project as a dwelling unit of at most 50 m². On the one branch circuit PEC
 * 2017 2.10.1.11(C)(5) permits it, its service disconnect takes the 20 A of
 * 2.30.6.10(B) instead of (A)'s 15 A.
 */
export function setSmallDwelling(root_id: string, small_dwelling: boolean) {
	return mergeUnitForm(root_id, { small_dwelling });
}

/** Sets the standby generator's nameplate kVA (PEC 2017 Article 7.2); undefined removes it. */
export function setGeneratorKva(root_id: string, generator_kva: number | undefined) {
	return mergeUnitForm(root_id, { generator_kva: generator_kva ?? null });
}

/** Chooses the panels the standby generator carries (PEC 2017 7.2.1.4(B)). */
export function setStandbyPanels(root_id: string, standby_panels: string[]) {
	return mergeUnitForm(root_id, { standby_panels });
}

/** Overrides the circuit-number phase (or delta line pair) of a circuit; undefined restores the default. */
export function changePhaseAssignment(node_id: string, phase: PhaseAssignment | undefined) {
	return patchNode(node_id, { phase_assignment: phase });
}

/** Sets the phase of several circuits in one undoable step; `undefined` clears an override. */
export function changePhaseAssignments(changes: [node_id: string, PhaseAssignment | undefined][]) {
	return patchNodes(changes.map(([id, phase]) => ({ id, set: { phase_assignment: phase } })));
}
