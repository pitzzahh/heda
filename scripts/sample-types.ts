/** The shapes the sample builder works with. */

export type Overrides = {
	at?: number;
	conductor_size?: number;
	egc_size?: number;
	conduit_size?: number;
	ampere_frames?: number;
	length?: number;
	z?: number;
};

export type LoadSpec = {
	circuit: number;
	description: string;
	quantity: number;
	varies: string;
	load_type: string;
	continuous?: boolean;
	length: number;
	terminal_temperature?: string;
	ambient_temperature?: number;
	conductor_sets?: number;
	conductor_qty?: number;
	pole?: string;
	/** Uses the trip rating instead of the load current for the voltage drop. */
	use_at_as_current?: boolean;
	overrides?: Overrides;
};

export type PanelSpec = {
	circuit: number;
	name: string;
	phase: string;
	length: number;
	terminal_temperature?: string;
	ambient_temperature?: number;
	conductor_sets?: number;
	conductor_qty?: number;
	pole?: string;
	overrides?: Overrides;
	children: (PanelSpec | LoadSpec)[];
};

export type SampleSpec = {
	file_name: string;
	project_name: string;
	distribution_unit: string;
	phase: string;
	panels: PanelSpec[];
};

/** A load without its circuit number; the builder numbers them in order. */
export type Circuit = Omit<LoadSpec, 'circuit'>;
