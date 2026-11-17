import * as v from 'valibot';

/** One computed voltage-drop row, before the load-schedule fields merge in. */
export const VOLTAGE_DROP_RESULT_SCHEMA = v.object({
	from_node_name: v.string(),
	to_node_name: v.string(),
	/** Effective conductor impedance, ohms per 305 m. */
	z: v.number(),
	length: v.number(),
	/** Impedance of this run, ohms. */
	actual_z: v.number(),
	voltage_per_segment: v.number(),
	voltage_at_end_circuit: v.number(),
	voltage_at_receiving_end: v.number(),
	percent_voltage_drop: v.number()
});
