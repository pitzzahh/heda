import type { DefaultLoad, LoadType, QuantityLabel, VariesLabel } from '#lib/types/load.js';
import { getEnumKeys } from '#lib/utils/enum.js';
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

/** Motor load types of either phase, for motor-specific sizing and fault contribution. */
export const MOTOR_LOAD_TYPES: readonly string[] = [
	default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER,
	default_load_types.ONE_P_MOTOR__RATED_CURRENT,
	default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
	default_load_types.THREE_P_MOTOR__RATED_CURRENT
];

// PEC 2017 2.20.1.5(A) and App. D Ex. D6/D8: 400Y/230 V, three-phase 4-wire.
/** The phases of a 400Y/230 V system, in order. */
export const PHASE_ASSIGNMENTS = ['A', 'B', 'C'] as const;

export const WYE_LINE_VOLTAGE = 400;
export const WYE_PHASE_VOLTAGE = 230;
// PEC 2017 App. D Ex. D6 6.3 and D14 step 9.4 use 1.732 for √3.
export const SQRT_3 = 1.732;

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
		varies: '1500',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: 'Laundry Circuit Load',
		varies: '1500',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: 'Bathroom Branch Circuit',
		varies: '1500',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
	},
	{
		description: 'Garage Branch Circuit',
		varies: '1500',
		continuous: true,
		type: default_load_types.CONVENIENCE_OUTLET
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

export const DEFAULT_PHASES = [
	{ value: default_phases.ONE_PHASE, label: '1P' },
	{ value: default_phases.THREE_PHASE_WYE, label: '3P-Y' },
	{ value: default_phases.THREE_PHASE_DELTA, label: '3P-Δ' }
] as const;

/**
 * Panel phases heda computes: a 400Y/230 V supply feeds 3P-Y panels or 230 V
 * single-phase ones (PEC 2017 App. D Ex. D6). Delta is not supported yet.
 */
export const SUPPORTED_PANEL_PHASES = DEFAULT_PHASES.filter(
	(option) => option.value !== default_phases.THREE_PHASE_DELTA
);

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

export const standard_ampere_ratings = [
	15, 20, 30, 40, 50, 60, 70, 80, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 700,
	800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000
] as const;

export const load_type_z_value = {
	[default_load_types.LIGHTING_LOAD]: 1.25,
	[default_load_types.CONVENIENCE_OUTLET]: 1.25,
	[default_load_types.GENERAL_LIGHTING]: 1.25,
	[default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER]: 2.5,
	[default_load_types.ONE_P_MOTOR__RATED_CURRENT]: 2.5,
	[default_load_types.HEATING_EQUIPMENT]: 1.5,
	[default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER]: 2.5,
	[default_load_types.THREE_P_MOTOR__RATED_CURRENT]: 2.5,
	[default_load_types.THREE_P_EQUIPMENT]: 1.25
} as const satisfies Record<LoadType, number>;

export const default_hp_current_relationship = {
	'1/6': '2.2',
	'1/4': '2.9',
	'1/3': '3.6',
	'1/2': '4.9',
	'3/4': '6.9',
	'1': '8',
	'1 1/2': '10',
	'2': '12',
	'3': '17',
	'5': '28',
	'7 1/2': '40',
	'10': '50'
} as const;

// PEC 2017 Table 4.30.14.4: full-load current of three-phase induction motors, 400 V column (A).
export const THREE_PHASE_MOTOR_FLC_400V = {
	'1/2': '1.3',
	'3/4': '1.8',
	'1': '2.3',
	'1 1/2': '3.3',
	'2': '4.3',
	'3': '6.1',
	'5': '9.7',
	'7 1/2': '14',
	'10': '18',
	'15': '27',
	'20': '34',
	'25': '44',
	'30': '51',
	'40': '66',
	'50': '83',
	'60': '103',
	'75': '128',
	'100': '165',
	'125': '208',
	'150': '240',
	'200': '320',
	'250': '403',
	'300': '482',
	'350': '560',
	'400': '636',
	'500': '786'
} as const;

// FOR CONDUCTOR SIZING
export const AMPACITY_RANGES = [
	{ min: 0, max: 15, value: 15 },
	{ min: 15, max: 20, value: 20 },
	{ min: 20, max: 30, value: 30 },
	{ min: 30, max: 40, value: 40 },
	{ min: 40, max: 55, value: 55 },
	{ min: 55, max: 70, value: 70 },
	{ min: 70, max: 85, value: 85 },
	{ min: 85, max: 115, value: 115 },
	{ min: 115, max: 140, value: 140 },
	{ min: 140, max: 155, value: 155 },
	{ min: 155, max: 190, value: 190 },
	{ min: 190, max: 220, value: 220 },
	{ min: 220, max: 255, value: 255 },
	{ min: 255, max: 285, value: 285 },
	{ min: 285, max: 305, value: 305 },
	{ min: 305, max: 325, value: 325 },
	{ min: 325, max: 375, value: 375 },
	{ min: 375, max: 435, value: 435 },
	{ min: 435, max: 470, value: 470 },
	{ min: 470, max: 480, value: 480 },
	{ min: 480, max: Infinity, value: 530 }
];

export const AMBIENT_TEMP_RATINGS = [
	{ max_temp: 10, factor: 1.2 }, // 10 or less
	{ max_temp: 15, factor: 1.15 }, // 11-15
	{ max_temp: 20, factor: 1.11 }, // 16-20
	{ max_temp: 25, factor: 1.05 }, // 21-25
	{ max_temp: 30, factor: 1.0 }, // 26-30
	{ max_temp: 35, factor: 0.94 }, // 31-35
	{ max_temp: 40, factor: 0.88 }, // 36-40
	{ max_temp: 45, factor: 0.82 }, // 41-45
	{ max_temp: 50, factor: 0.75 }, // 46-50
	{ max_temp: 55, factor: 0.67 }, // 51-55
	{ max_temp: 60, factor: 0.58 }, // 56-60
	{ max_temp: 65, factor: 0.47 }, // 61-65
	{ max_temp: 70, factor: 0.33 } // 66-70
];

// FOR EGC SIZING
export const AMPERE_TRIP_TO_COPPER = [
	{ at_threshold: 6000, size: 'error' },
	{ at_threshold: 5000, size: 400 },
	{ at_threshold: 4000, size: 375 },
	{ at_threshold: 3000, size: 250 },
	{ at_threshold: 2500, size: 200 },
	{ at_threshold: 2000, size: 175 },
	{ at_threshold: 1600, size: 125 },
	{ at_threshold: 1200, size: 100 },
	{ at_threshold: 1000, size: 80 },
	{ at_threshold: 800, size: 60 },
	{ at_threshold: 600, size: 50 },
	{ at_threshold: 500, size: 38 },
	{ at_threshold: 300, size: 30 },
	{ at_threshold: 200, size: 22 },
	{ at_threshold: 100, size: 14 },
	{ at_threshold: 60, size: 8 },
	{ at_threshold: 20, size: 5.5 },
	{ at_threshold: 15, size: 3.5 },
	{ at_threshold: 0, size: 2 }
] as const;

export const AMPACITY_TO_CONDUCTOR_SIZE: { [key: number]: number } = {
	15: 2.0,
	20: 3.5,
	30: 5.5,
	40: 8.0,
	55: 14,
	70: 22,
	85: 30,
	115: 38,
	140: 50,
	155: 60,
	190: 80,
	220: 100,
	255: 125,
	285: 150,
	305: 175,
	325: 200,
	375: 250,
	435: 325,
	470: 375,
	480: 400,
	530: 500
};

export const ALTERNATING_CURRENT_REACTANCE: Record<number, number> = {
	2.0: 2.7,
	3.5: 1.7,
	5.5: 1.1,
	8.0: 0.69,
	14: 0.44,
	22: 0.29,
	30: 0.19,
	38: 0.16,
	50: 0.13,
	60: 0.11,
	80: 0.088,
	100: 0.074,
	125: 0.066,
	150: 0.059,
	175: 0.053,
	200: 0.049,
	250: 0.043,
	325: 0.04,
	375: 0.036,
	400: 0.036,
	500: 0.032
};

// PEC 2017 Ch. 10 Table 10.1.1.9: AC resistance and reactance of 600 V cables,
// 3-phase, 60 Hz, 75°C, three single conductors in conduit, in ohms to neutral
// per 305 m. Uncoated copper only.
// shortcut: copper columns only; add the aluminum columns when aluminum conductors are supported.
export const CONDUCTOR_RESISTANCE_REACTANCE: Record<
	number,
	{ xl: number; xl_steel: number; r_pvc: number; r_aluminum: number; r_steel: number }
> = {
	2.0: { xl: 0.058, xl_steel: 0.073, r_pvc: 3.1, r_aluminum: 3.1, r_steel: 3.1 },
	3.5: { xl: 0.054, xl_steel: 0.068, r_pvc: 2.0, r_aluminum: 2.0, r_steel: 2.0 },
	5.5: { xl: 0.05, xl_steel: 0.063, r_pvc: 1.2, r_aluminum: 1.2, r_steel: 1.2 },
	8.0: { xl: 0.052, xl_steel: 0.065, r_pvc: 0.78, r_aluminum: 0.78, r_steel: 0.78 },
	14: { xl: 0.051, xl_steel: 0.064, r_pvc: 0.49, r_aluminum: 0.49, r_steel: 0.49 },
	22: { xl: 0.048, xl_steel: 0.06, r_pvc: 0.31, r_aluminum: 0.31, r_steel: 0.31 },
	30: { xl: 0.045, xl_steel: 0.057, r_pvc: 0.19, r_aluminum: 0.2, r_steel: 0.2 },
	38: { xl: 0.046, xl_steel: 0.057, r_pvc: 0.15, r_aluminum: 0.16, r_steel: 0.16 },
	50: { xl: 0.044, xl_steel: 0.055, r_pvc: 0.12, r_aluminum: 0.13, r_steel: 0.12 },
	60: { xl: 0.043, xl_steel: 0.054, r_pvc: 0.1, r_aluminum: 0.1, r_steel: 0.1 },
	80: { xl: 0.042, xl_steel: 0.052, r_pvc: 0.077, r_aluminum: 0.082, r_steel: 0.079 },
	100: { xl: 0.041, xl_steel: 0.051, r_pvc: 0.062, r_aluminum: 0.067, r_steel: 0.063 },
	125: { xl: 0.041, xl_steel: 0.052, r_pvc: 0.052, r_aluminum: 0.057, r_steel: 0.054 },
	150: { xl: 0.041, xl_steel: 0.051, r_pvc: 0.044, r_aluminum: 0.049, r_steel: 0.045 },
	175: { xl: 0.04, xl_steel: 0.05, r_pvc: 0.038, r_aluminum: 0.043, r_steel: 0.039 },
	200: { xl: 0.04, xl_steel: 0.049, r_pvc: 0.033, r_aluminum: 0.038, r_steel: 0.035 },
	250: { xl: 0.039, xl_steel: 0.048, r_pvc: 0.027, r_aluminum: 0.032, r_steel: 0.029 },
	325: { xl: 0.039, xl_steel: 0.048, r_pvc: 0.023, r_aluminum: 0.028, r_steel: 0.025 },
	375: { xl: 0.038, xl_steel: 0.048, r_pvc: 0.019, r_aluminum: 0.024, r_steel: 0.021 },
	400: { xl: 0.038, xl_steel: 0.048, r_pvc: 0.019, r_aluminum: 0.024, r_steel: 0.021 },
	500: { xl: 0.037, xl_steel: 0.046, r_pvc: 0.015, r_aluminum: 0.019, r_steel: 0.018 }
};

// PEC 2017 2.40.7.4(C): only breakers rated other than 5 000 A must show their interrupting
// rating, so heda takes a breaker with no rating entered as 5,000 A.
export const UNMARKED_BREAKER_INTERRUPTING_RATING_KA = 5;

// PEC 2017 App. D Ex. D14 step 8: average induction motor impedance (per IEEE Std 141), on the motor's own kVA.
export const MOTOR_IMPEDANCE_PU = 0.25;

// PEC 2017 App. D Ex. D14 step 3: source short-circuit level of the Metro Manila grid.
export const METRO_MANILA_UTILITY_SC_KVA = 1_000_000;

export const CONDUIT_TABLE = {
	conduit_columns: [16, 21, 27, 35, 41, 53, 63, 78, 91, 103, 128, 155],
	conductor_rows: [
		{ conductor_size: 2, values: [9, 17, 28, 51, 70, 118, 170, 265, 358, 464, 736, 1055] },
		{ conductor_size: 3.5, values: [6, 12, 20, 37, 51, 86, 124, 193, 261, 338, 537, 770] },
		{ conductor_size: 5.5, values: [4, 7, 13, 23, 32, 54, 78, 122, 164, 213, 338, 485] },
		{ conductor_size: 8, values: [2, 4, 7, 13, 18, 31, 45, 70, 95, 123, 195, 279] },
		{ conductor_size: 14, values: [2, 3, 5, 9, 13, 22, 32, 51, 68, 89, 141, 202] },
		{ conductor_size: 22, values: [1, 1, 3, 6, 8, 14, 20, 33, 42, 54, 86, 124] },
		{ conductor_size: 30, values: [1, 1, 2, 4, 6, 10, 14, 22, 30, 39, 61, 88] },
		{ conductor_size: 38, values: [1, 1, 1, 3, 4, 7, 10, 16, 22, 29, 45, 65] },
		{ conductor_size: 50, values: [0, 1, 1, 2, 3, 6, 9, 14, 18, 24, 38, 55] },
		{ conductor_size: 60, values: [0, 1, 1, 1, 3, 5, 7, 11, 15, 20, 32, 46] },
		{ conductor_size: 80, values: [0, 1, 1, 1, 2, 4, 6, 9, 13, 17, 26, 38] },
		{ conductor_size: 100, values: [0, 0, 1, 1, 2, 3, 5, 8, 11, 15, 23, 34] },
		{ conductor_size: 125, values: [0, 0, 1, 1, 1, 2, 4, 6, 9, 11, 19, 28] },
		{ conductor_size: 150, values: [0, 0, 0, 1, 1, 2, 3, 5, 7, 9, 15, 22] },
		{ conductor_size: 175, values: [0, 0, 0, 1, 1, 1, 3, 5, 6, 8, 13, 19] },
		{ conductor_size: 200, values: [0, 0, 0, 1, 1, 1, 2, 4, 6, 8, 11, 17] },
		{ conductor_size: 250, values: [0, 0, 0, 0, 1, 1, 2, 3, 5, 6, 9, 14] },
		{ conductor_size: 300, values: [0, 0, 0, 0, 1, 1, 2, 3, 4, 5, 8, 12] },
		{ conductor_size: 325, values: [0, 0, 0, 0, 1, 1, 1, 3, 4, 5, 7, 11] },
		{ conductor_size: 350, values: [0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 6, 10] },
		{ conductor_size: 400, values: [0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 6, 9] },
		{ conductor_size: 500, values: [0, 0, 0, 0, 0, 1, 1, 1, 2, 3, 5, 7] }
	]
};

export const DEFAULT_HP_CURRENT_RELATIONSHIP_ARRAY = Object.entries(
	default_hp_current_relationship
).map(([hp, current]) => ({ hp, current }));

export const DEFAULT_THREE_PHASE_TYPES_ENUMS = toLabelValueArray(default_three_phase_types);

export const DEFAULT_HP_CURRENT_RELATIONSHIP_OPTIONS = getEnumKeys(default_hp_current_relationship);

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

export const MIN_LOAD_QUANTITY = 1;
export const MAX_LOAD_QUANTITY = 100;
export const MIN_WIRE_LENGTH = 1;
export const MAX_WIRE_LENGTH = 1000;
export const MIN_VARIES = 0;
export const MAX_VARIES = 100;

export const AMBIENT_TEMPERATURES = Array.from({ length: 70 }, (_, index) => index + 1);
