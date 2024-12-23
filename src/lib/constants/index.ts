import type { DefaultLoad, LoadType, QuantityLabel, VariesLabel } from '@/types/load';
import { getEnumValues, getEnumKeys } from '@/utils/enum';
import { toLabelKeyArray, toLabelValueArray } from '@/utils/mapper';

export const default_terminal_temperatures = {
	60: '60',
	75: '75',
	90: '90',
	STANDARD_TEMPERATURE: 'Standard Temperature'
} as const;

export const DEFAULT_LOADS = [
	{
		description: 'Lighting Outlet (50W)',
		varies: "50",
		continuous: true,
		type: 'Lighting Load'
	},
	{
		description: 'Lighting Outlet (100W)',
		varies: "100",
		continuous: true,
		type: 'Lighting Load'
	},
	{
		description: "Small Appliance Load",
		varies: "1500",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Laundry Circuit Load",
		varies: "1500",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Bathroom Branch Circuit",
		varies: "1500",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Garage Branch Circuit",
		varies: "1500",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Convenience Outlet (Simplex)",
		varies: "180",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Convenience Outlet (Duplex)",
		varies: "180",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Convenience Outlet (Triplex)",
		varies: "180",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "4-Gang Convenience Outlet",
		varies: "360",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "5-Gang Convenience Outlet",
		varies: "450",
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Dwelling Unit",
		varies: "24",
		continuous: true,
		type: 'General Lighting'
	},
	{
		description: "Office Buildings",
		varies: "28",
		continuous: true,
		type: 'General Lighting'
	}
] as Readonly<DefaultLoad[]>;

export const default_three_phase_types = {
	WYE: 'WYE',
	DELTA: 'DELTA',
	ALGO: 'ALGO'
} as const;

export const default_phases = {
	ONE_PHASE: '1P',
	THREE_PHASE_WYE: '3P-Y',
	THREE_PHASE_DELTA: '3P-Δ'
} as const;

export const default_load_types = {
	LIGHTING_LOAD: 'Lighting Load',
	CONVENIENCE_OUTLET: 'Convenience Outlet',
	GENERAL_LIGHTING: 'General Lighting',
	ONE_P_MOTOR__RATED_HORSE_POWER: '1P Motor - Rated Horse Power',
	ONE_P_MOTOR__RATED_CURRENT: '1P Motor - Rated Current',
	HEATING_EQUIPMENT: 'Heating Equipment'
} as const;

export const load_type_to_varies_label = {
	[default_load_types.LIGHTING_LOAD]: 'Unit Wattage',
	[default_load_types.CONVENIENCE_OUTLET]: 'Unit Wattage',
	[default_load_types.GENERAL_LIGHTING]: 'Unit Load',
	[default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER]: 'Horsepower Rating',
	[default_load_types.ONE_P_MOTOR__RATED_CURRENT]: 'Current Rating',
	[default_load_types.HEATING_EQUIPMENT]: 'Unit Wattage'
} as const satisfies Record<LoadType, VariesLabel>;

export const load_type_to_quantity_label = {
	[default_load_types.GENERAL_LIGHTING]: 'Floor area',
} as const as Record<LoadType, QuantityLabel>;

export const standard_ampere_ratings = [
	15, 20, 30, 40, 50, 60, 70, 80, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 700, 800,
	1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000
] as const;

export const load_type_z_value = {
	[default_load_types.LIGHTING_LOAD]: 1.25,
	[default_load_types.CONVENIENCE_OUTLET]: 1.25,
	[default_load_types.GENERAL_LIGHTING]: 1.25,
	[default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER]: 2.5,
	[default_load_types.ONE_P_MOTOR__RATED_CURRENT]: 2.5,
	[default_load_types.HEATING_EQUIPMENT]: 1.5
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
    { max_temp: 10, factor: 1.20 },    // 10 or less
    { max_temp: 15, factor: 1.15 },    // 11-15
    { max_temp: 20, factor: 1.11 },    // 16-20
    { max_temp: 25, factor: 1.05 },    // 21-25
    { max_temp: 30, factor: 1.00 },    // 26-30
    { max_temp: 35, factor: 0.94 },    // 31-35
    { max_temp: 40, factor: 0.88 },    // 36-40
    { max_temp: 45, factor: 0.82 },    // 41-45
    { max_temp: 50, factor: 0.75 },    // 46-50
    { max_temp: 55, factor: 0.67 },    // 51-55
    { max_temp: 60, factor: 0.58 },    // 56-60
    { max_temp: 65, factor: 0.47 },    // 61-65
    { max_temp: 70, factor: 0.33 }     // 66-70
]

// FOR EGC SIZING
export const AMPERE_TRIP_TO_COPPER = [
    { at_threshold: 6000, size: "error" },
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

export const DEFAULT_HP_CURRENT_RELATIONSHIP_ARRAY = Object.entries(
	default_hp_current_relationship
).map(([hp, current]) => ({ hp, current }));

export const DEFAULT_THREE_PHASE_TYPES_ENUMS = toLabelValueArray(default_three_phase_types);

export const DEFAULT_THREE_PHASE_TYPES_OPTIONS = getEnumValues(default_three_phase_types);

export const DEFAULT_PHASES_ENUMS = toLabelValueArray(default_phases);

export const DEFAULT_PHASES_OPTIONS = getEnumValues(default_phases);

export const DEFAULT_TERMINAL_TEMPERATURE_ENUMS = toLabelValueArray(default_terminal_temperatures);

export const DEFAULT_TERMINAL_TEMPERATURE_OPTIONS = getEnumValues(default_terminal_temperatures);

export const DEFAULT_LOAD_TYPES_ENUMS = toLabelValueArray(default_load_types);

export const DEFAULT_LOAD_TYPES_OPTIONS = getEnumValues(default_load_types);

export const DEFAULT_LOAD_TYPE_TO_VARIES_LABEL_ENUMS = toLabelValueArray(load_type_to_varies_label);

export const DEFAULT_LOAD_TYPE_TO_VARIES_LABEL_OPTIONS = getEnumValues(load_type_to_varies_label);

export const DEFAULT_LOAD_TYPE_TO_QUANTITY_LABEL_ENUMS = toLabelValueArray(load_type_to_quantity_label);

export const DEFAULT_LOAD_TYPE_TO_QUANTITY_LABEL_OPTIONS = getEnumValues(load_type_to_quantity_label);

export const DEFAULT_HP_CURRENT_RELATIONSHIP_ENUMS = toLabelKeyArray(default_hp_current_relationship);
export const DEFAULT_HP_CURRENT_RELATIONSHIP_OPTIONS = getEnumKeys(default_hp_current_relationship);

export const FIELD_VALIDATION = {
	TEST: {
		SPECIAL_CHAR: (value: string) => /[-._!"`'#%&,:;<>=@{}~\$\(\)\*\+\/\\\?\[\]\^\|]+/.test(value),
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
