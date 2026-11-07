import type { Node } from '#lib/types/db/index.js';

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
} & Node;
