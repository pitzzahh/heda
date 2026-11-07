import type { Node } from '#lib/types/db/index.js';

// NOTE: This is a temporary type for the columns in single-phase and three-phase loads.
export type PhaseLoadSchedule = {
	circuit_number: number;
	load_description: string;
	voltage: number;
	va: number;
	current: number;
	at: number;
	conductor_size: number;
	egc_size: number;
	adjusted_current: number;
	conduit_size: number;
	ampere_frames: number;
	// ab: number;
	// bc: number;
	// ca: number;
	// pole: number;
	// kaic: number;
	// sets: number;
	// p_plus_p_size: string;
	// p_plus_p_insulation: string;
	// three_phase_size: string;
	// three_phase_insulation: string;
} & Node;
