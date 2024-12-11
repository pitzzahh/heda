import type { DefaultLoad } from '@/types/load';
import { getEnumValues } from '@/utils/enum';
import { toLabelValueArray } from '@/utils/mapper';

export const default_terminal_temperatures = {
	60: "60",
	75: '75',
	90: "90",
	STANDARD_TEMPERATURE: "STANDARD_TEMPERATURE"
} as const;


export const DEFAULT_LOADS = [
	{
		description: 'Lighting Outlet (50W)',
		varies: 50,
		continuous: true,
		type: 'Lighting Load'
	},
	{
		description: 'Lighting Outlet (100W)',
		varies: 100,
		continuous: true,
		type: 'Lighting Load'
	},
	{
		description: "Small Appliance Load",
		varies: 1500,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Laundry Circuit Load",
		varies: 1500,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Bathroom Branch Circuit",
		varies: 1500,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Garage Branch Circuit",
		varies: 1500,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Convenience Outlet (Simplex)",
		varies: 180,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Convenience Outlet (Duplex)",
		varies: 180,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Convenience Outlet (Triplex)",
		varies: 180,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "4-Gang Convenience Outlet",
		varies: 360,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "5-Gang Convenience Outlet",
		varies: 450,
		continuous: true,
		type: 'Convenience Outlet'
	},
	{
		description: "Dwelling Unit",
		varies: 24,
		continuous: true,
		type: 'General Lighting'
	},
	{
		description: "Office Buildings",
		varies: 28,
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
	LIGHTING_LOAD: "Lighting Load",
	CONVENIENCE_OUTLET: "Convenience Outlet",
	GENERAL_LIGHTING: "General Lighting",
	ONE_P_MOTOR__RATED_HORSE_POWER: "1P Motor - Rated Horse Power",
	ONE_P_MOTOR__RATED_CURRENT: "1P Motor - Rated Current",
	HEATING_EQUIPMENT: "Heating Equipment",
} as const;

export const DEFAULT_THREE_PHASE_TYPES_ENUMS = toLabelValueArray(default_three_phase_types);

export const DEFAULT_THREE_PHASE_TYPES_OPTIONS = getEnumValues(default_three_phase_types);

export const DEFAULT_PHASES_ENUMS = toLabelValueArray(default_phases);

export const DEFAULT_PHASES_OPTIONS = getEnumValues(default_phases);

export const DEFAULT_TERMINAL_TEMPERATURE_ENUMS = toLabelValueArray(default_terminal_temperatures);

export const DEFAULT_TERMINAL_TEMPERATURE_OPTIONS = getEnumValues(default_terminal_temperatures);

export const DEFAULT_LOAD_TYPES_ENUMS = toLabelValueArray(default_load_types);

export const DEFAULT_LOAD_TYPES_OPTIONS = getEnumValues(default_load_types);

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
