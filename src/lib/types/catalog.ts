/** Full-load currents by horsepower, `[horsepower, amperes]` in the table's order. */
export type MotorTable = readonly (readonly [horsepower: string, amperes: number])[];

/** The PEC 2017 choices the engine serves (`Catalog` in `crates/heda-core/src/catalog.rs`). */
export type Catalog = {
	/** Table 2.40.1.6(A), ascending (A). */
	breaker_ratings: readonly number[];
	/** Table 3.10.2.6(B)(16), copper, ascending (mm²). */
	conductor_sizes: readonly number[];
	/** Table 2.50.6.13, copper, ascending (mm²). */
	egc_sizes: readonly number[];
	/** Table 10.1.1.4 trade sizes, ascending (mm). */
	conduit_sizes: readonly number[];
	motor_flc: {
		/** Table 4.30.14.2, 230 V. */
		one_phase_230: MotorTable;
		/** Table 4.30.14.4, 230 V (delta supplies). */
		three_phase_230: MotorTable;
		/** Table 4.30.14.4, 400 V (400Y/230 V supplies). */
		three_phase_400: MotorTable;
	};
	/** Most nodes one copy may create; the copy dialog caps its count by it. */
	max_copy_nodes: number;
};
