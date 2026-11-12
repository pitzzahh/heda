import { findNode, patchNode } from './nodes.js';

export type FieldType =
	'egc_size' | 'conductor_size' | 'at' | 'conduit_size' | 'ampere_frames' | 'length' | 'z';

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
