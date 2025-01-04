import type { PhaseLoadSchedule } from '../load/one_phase';

export type VoltageDrop = {
	from_node_name: string;
	to_node_name: string;
	z: number;
	length: number;
	actual_z: number;
	voltage_per_segment: number;
	voltage_at_end_circuit: number;
	voltage_at_receiving_end: number
	percent_voltage_drop: number
} & PhaseLoadSchedule;
