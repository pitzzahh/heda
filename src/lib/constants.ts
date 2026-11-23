import type { DefaultLoad, LoadType, QuantityLabel, VariesLabel } from '#lib/types/load.js';
import { toLabelValueArray } from '#lib/utils/mapper.js';

export const default_load_types = {
	LIGHTING_LOAD: 'lighting_load',
	CONVENIENCE_OUTLET: 'convenience_outlet',
	GENERAL_LIGHTING: 'general_lighting',
	ONE_P_MOTOR__RATED_HORSE_POWER: 'one_phase_motor_horse_power',
	ONE_P_MOTOR__RATED_CURRENT: 'one_phase_motor_rated_current',
	HEATING_EQUIPMENT: 'heating_equipment',
	THREE_P_MOTOR__RATED_HORSE_POWER: 'three_phase_motor_horse_power',
	THREE_P_MOTOR__RATED_CURRENT: 'three_phase_motor_rated_current',
	THREE_P_EQUIPMENT: 'three_phase_equipment'
} as const;

// PEC 2017 2.10.1.11(C)(1)–(4): the dwelling-unit receptacle circuits that are rated 20 A.
export const DWELLING_CIRCUITS = [
	{ value: 'small_appliance', label: 'Small-appliance, 2.10.1.11(C)(1)' },
	{ value: 'laundry', label: 'Laundry, 2.10.1.11(C)(2)' },
	{ value: 'bathroom', label: 'Bathroom, 2.10.1.11(C)(3)' },
	{ value: 'garage', label: 'Garage, 2.10.1.11(C)(4)' }
] as const;

export const DEFAULT_LOAD_TYPES = [
	{ value: default_load_types.LIGHTING_LOAD, label: 'Lighting Load' },
	{ value: default_load_types.CONVENIENCE_OUTLET, label: 'Convenience Outlet' },
	{ value: default_load_types.GENERAL_LIGHTING, label: 'General Lighting' },
	{
		value: default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER,
		label: '1P Motor - Rated Horse Power'
	},
	{ value: default_load_types.ONE_P_MOTOR__RATED_CURRENT, label: '1P Motor - Rated Current' },
	{ value: default_load_types.HEATING_EQUIPMENT, label: 'Heating Equipment' },
	{
		value: default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
		label: '3P Motor - Rated Horse Power'
	},
	{ value: default_load_types.THREE_P_MOTOR__RATED_CURRENT, label: '3P Motor - Rated Current' },
	{ value: default_load_types.THREE_P_EQUIPMENT, label: '3P Equipment' }
] as const;

/** Three-phase loads: line-to-line at 400 V on a 400Y/230 V system (PEC 2017 App. D Ex. D6; motors per Table 4.30.14.4, 400 V column). */
export const THREE_PHASE_LOAD_TYPES: readonly string[] = [
	default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
	default_load_types.THREE_P_MOTOR__RATED_CURRENT,
	default_load_types.THREE_P_EQUIPMENT
];

// PEC 2017 2.20.1.5(A) and App. D Ex. D6/D8: 400Y/230 V, three-phase 4-wire.
/** The phases of a 400Y/230 V system, in order. */
export const PHASE_ASSIGNMENTS = ['A', 'B', 'C'] as const;

// PEC 2017 2.20.1.5(A) and App. D Ex. D14/D15: 230 V, three-phase 3-wire (delta).
/** The line pairs of a 230 V delta system, where its single-phase circuits connect. */
export const LINE_PAIRS = ['AB', 'BC', 'CA'] as const;

export const STANDARD_TERMINAL_TEMPERATURE = 'standard';

export const DEFAULT_TERMINAL_TEMPERATURES = [
	{ value: '60', label: '60' },
	{ value: '75', label: '75' },
	{ value: '90', label: '90' },
	{ value: STANDARD_TERMINAL_TEMPERATURE, label: 'Standard Temperature' }
] as const;

export const DEFAULT_LOADS = [
	{
		description: 'Lighting Outlet (50W)',
		varies: '50',
		continuous: true,
		type: default_load_types.LIGHTING_LOAD
	},
	{
		description: 'Lighting Outlet (100W)',
		varies: '100',
		continuous: true,
		type: default_load_types.LIGHTING_LOAD
	},
	{
		description: 'Small Appliance Load',
		// PEC 2017 2.20.3.13(A): 1500 VA for each small-appliance circuit.
		varies: '1500',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET,
		dwelling_circuit: 'small_appliance'
	},
	{
		description: 'Laundry Circuit Load',
		// PEC 2017 2.20.3.13(B): at least 1500 VA for each laundry circuit.
		varies: '1500',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET,
		dwelling_circuit: 'laundry'
	},
	{
		description: 'Bathroom Branch Circuit',
		// PEC 2017 2.20.2.5(J)(1): a dwelling's bathroom receptacles are in its 24 VA/m²
		// general lighting load; "No additional load calculations shall be required."
		varies: '0',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET,
		dwelling_circuit: 'bathroom'
	},
	{
		description: 'Garage Branch Circuit',
		// PEC 2017 2.20.2.5(J)(1): general-use receptacles of 20 A or less are in the
		// dwelling's 24 VA/m² general lighting load.
		varies: '0',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET,
		dwelling_circuit: 'garage'
	},
	{
		description: 'Convenience Outlet (Simplex)',
		varies: '180',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: 'Convenience Outlet (Duplex)',
		varies: '180',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: 'Convenience Outlet (Triplex)',
		varies: '180',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: '4-Gang Convenience Outlet',
		varies: '360',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: '5-Gang Convenience Outlet',
		varies: '450',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: 'Dwelling Unit',
		varies: '24',
		continuous: true,
		type: default_load_types.GENERAL_LIGHTING
	},
	{
		description: 'Office Buildings',
		varies: '28',
		continuous: true,
		type: default_load_types.GENERAL_LIGHTING
	}
] as Readonly<DefaultLoad[]>;

export const default_three_phase_types = {
	WYE: 'WYE',
	DELTA: 'DELTA',
	ALGO: 'ALGO'
} as const;

export const default_phases = {
	ONE_PHASE: 'one_phase',
	THREE_PHASE_WYE: 'three_phase_wye',
	THREE_PHASE_DELTA: 'three_phase_delta'
} as const;

/** Nominal voltage of each phase system (PEC 2017 2.20.1.5(A)). */
export const PHASE_SYSTEM_VOLTAGES = {
	[default_phases.ONE_PHASE]: '230 V',
	[default_phases.THREE_PHASE_WYE]: '400Y/230 V',
	[default_phases.THREE_PHASE_DELTA]: '230 V'
} as const;

export const DEFAULT_PHASES = [
	{ value: default_phases.ONE_PHASE, label: '1P' },
	{ value: default_phases.THREE_PHASE_WYE, label: '3P-Y' },
	{ value: default_phases.THREE_PHASE_DELTA, label: '3P-Δ' }
] as const;

export const load_type_to_varies_label = {
	[default_load_types.LIGHTING_LOAD]: 'Unit Wattage',
	[default_load_types.CONVENIENCE_OUTLET]: 'Unit Wattage',
	[default_load_types.GENERAL_LIGHTING]: 'Unit Load',
	[default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER]: 'Horsepower Rating',
	[default_load_types.ONE_P_MOTOR__RATED_CURRENT]: 'Current Rating',
	[default_load_types.HEATING_EQUIPMENT]: 'Unit Wattage',
	[default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER]: 'Horsepower Rating',
	[default_load_types.THREE_P_MOTOR__RATED_CURRENT]: 'Current Rating',
	[default_load_types.THREE_P_EQUIPMENT]: 'Unit Wattage'
} as const satisfies Record<LoadType, VariesLabel>;

export const load_type_to_quantity_label = {
	[default_load_types.GENERAL_LIGHTING]: 'Floor area'
} as const as Record<LoadType, QuantityLabel>;

// PEC 2017 App. D Ex. D14 step 3: source short-circuit level of the Metro Manila grid.
export const METRO_MANILA_UTILITY_SC_KVA = 1_000_000;

export const DEFAULT_THREE_PHASE_TYPES_ENUMS = toLabelValueArray(default_three_phase_types);

export const FIELD_VALIDATION = {
	TEST: {
		SPECIAL_CHAR: (value: string) => /[-._!"`'#%&,:;<>=@{}~$()*+/\\?[\]^|]+/.test(value),
		LOWERCASE: (value: string) => /[a-z]/.test(value),
		UPPERCASE: (value: string) => /[A-Z]/.test(value),
		NUMBER: (value: string) => value && /.*[0-9].*/.test(value),
		ALL_NUMBER: (value: string) => /^[0-9]+$/.test(value)
	},
	MSG: {
		MIN_LEN: 'Must be at least 8 characters long.',
		SPECIAL_CHAR: 'Must contain at least one special character.',
		LOWERCASE: 'Must contain at least one lowercase letter.',
		UPPERCASE: 'Must contain at least one uppercase letter.',
		NUMBER: 'Must contain at least one number.',
		MATCH: 'Must match.'
	}
};

export const AMBIENT_TEMPERATURES = Array.from({ length: 70 }, (_, index) => index + 1);

/**
 * Drawing sheet sizes of PEC 2017 1.3.1.1, landscape, in mm: (A) the three standard
 * sizes, and (C) A3, permitted only for a dwelling unit of at most 50 m² with a total load
 * of at most 3680 VA.
 */
export const SHEET_SIZES = [
	{ value: '760x1000', label: '760 × 1000 mm', width: 1000, height: 760 },
	{ value: '600x900', label: '600 × 900 mm', width: 900, height: 600 },
	{ value: '500x760', label: '500 × 760 mm', width: 760, height: 500 },
	{ value: 'A3', label: 'A3 (297 × 420 mm)', width: 420, height: 297 }
] as const;

/** PEC 2017 1.3.1.1(C): the largest total load an A3 sheet set may show, VA. */
export const A3_SHEET_MAX_VA = 3680;

/**
 * The systems whose overcurrent devices PEC 2017 requires to be selectively coordinated
 * with all supply-side devices; a panel marked with one carries it to everything below.
 */
export const COORDINATION_SYSTEMS = [
	{ value: 'emergency', label: 'Emergency (PEC 7.0.6.3)' },
	{ value: 'legally_required_standby', label: 'Legally required standby (PEC 7.1.4.3)' },
	{ value: 'critical_operations_power', label: 'Critical operations power (PEC 7.8.4.5)' },
	{ value: 'critical_operations_data', label: 'Critical operations data (PEC 6.45.1.27)' }
] as const;
