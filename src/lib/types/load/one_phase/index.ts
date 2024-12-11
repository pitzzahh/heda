import type { Phase } from '@/types/phase';
import type { LoadType } from '..';
import type { Node } from '@/types/project';

export type MainLoad = {
	id: string;
	name: string;
	wire_length: number;
	main_ambient_temp: string;
	phase_name: Phase;
};

export type LoadDescription = {};

export type OnePhaseLoad = {
	id: string;
	main_load: Omit<MainLoad, 'id'>;
	circuit_number: number;
	load_ambient_temp: number;
	load_type: LoadType;
};

export type OnePhaeLoadCustom = {
	id: string;
	name: string;
	wire_length: number;
	main_ambient_temp: string;
	phase_name: Phase;
};

// NOTE: This is a temporary type for the columns in single-phase and three-phase loads.
export type PhaseLoadSchedule = {
	circuit_number: number;
	load_description: string;
	voltage: number;
	va: number;
	current: number;
	// ab: number;
	// bc: number;
	// ca: number;
	// at: number;
	// pole: number;
	// kaic: number;
	// sets: number;
	// p_plus_p_size: string;
	// p_plus_p_insulation: string;
	// three_phase_size: string;
	// three_phase_insulation: string;
	// egc_size: string;
	// egc_insulation: string;
	// conduit_size: string;
	// conduit_type: string;
} & Node
