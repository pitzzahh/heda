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

// PEC 2017 Table 2.40.1.6(A): standard ampere ratings for fuses and inverse time circuit breakers.
export const standard_ampere_ratings = [
	15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350,
	400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000
] as const;

// PEC 2017 Table 4.30.14.2: full-load current of single-phase AC motors, 230 V column (A).
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

// PEC 2017 Table 4.30.14.4: full-load current of three-phase induction motors, 230 V column (A),
// for 220–240 V systems (the table's note): a 230 V delta supply. 250–500 HP are marked
// "Based on UL 508" in the table.
export const THREE_PHASE_MOTOR_FLC_230V = {
	'1/2': '2.2',
	'3/4': '3.2',
	'1': '4.2',
	'1 1/2': '6',
	'2': '6.8',
	'3': '9.6',
	'5': '15.2',
	'7 1/2': '22',
	'10': '28',
	'15': '42',
	'20': '54',
	'25': '68',
	'30': '80',
	'40': '104',
	'50': '130',
	'60': '154',
	'75': '192',
	'100': '248',
	'125': '312',
	'150': '360',
	'200': '480',
	'250': '604',
	'300': '722',
	'350': '828',
	'400': '954',
	'450': '1030',
	'500': '1180'
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

// FOR EGC SIZING
// PEC 2017 Table 2.50.6.13: minimum copper equipment grounding conductor (mm²) by OCPD rating.
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
	100: 38,
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

// PEC 2017 App. D Ex. D14 step 3: source short-circuit level of the Metro Manila grid.
export const METRO_MANILA_UTILITY_SC_KVA = 1_000_000;

// PEC 2017 Ch. 10 Table 10.1.1.4, Article 3.52 Rigid PVC Conduit, Schedule 80: raceway size (mm)
// and the area (mm²) allowed by Table 10.1.1.1 for 1 conductor (53%), 2 (31%) and over 2 (40%).
export const CONDUIT_FILL_AREAS = [
	{ size: 15, one: 75, two: 44, over_two: 56 },
	{ size: 20, one: 139, two: 82, over_two: 105 },
	{ size: 25, one: 236, two: 138, over_two: 178 },
	{ size: 32, one: 424, two: 248, over_two: 320 },
	{ size: 40, one: 585, two: 342, over_two: 442 },
	{ size: 50, one: 983, two: 575, over_two: 742 },
	{ size: 65, one: 1410, two: 825, over_two: 1064 },
	{ size: 80, one: 2200, two: 1287, over_two: 1660 },
	{ size: 90, one: 2972, two: 1738, over_two: 2243 },
	{ size: 100, one: 3852, two: 2253, over_two: 2907 },
	{ size: 130, one: 6105, two: 3571, over_two: 4607 },
	{ size: 150, one: 8752, two: 5119, over_two: 6605 }
] as const;

export const CONDUIT_SIZES = CONDUIT_FILL_AREAS.map((row) => row.size);

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
