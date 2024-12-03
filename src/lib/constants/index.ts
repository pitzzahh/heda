import { getEnumValues } from "@/utils/enum";
import { toLabelValueArray } from "@/utils/mapper";

export const ambient_temperatures = [
  { label: '60', value: '60' },
  { label: '75', value: '75' },
  { label: '90', value: '90' },
  { label: 'temparature limitation', value: 'default' }
] as const;

export const specials = [
  { label: 'None', value: 'none' },
  { label: 'Motor', value: 'motor' },
  { label: 'Welding', value: 'welding' },
  { label: 'UPS', value: 'ups' },
  { label: 'Other', value: 'other' }
] as const;

export const default_loads_description = [
  { label: 'Lighting', value: 'lighting' },
  { label: 'Receptacles', value: 'receptacles' },
  { label: 'HVAC', value: 'hvac' },
  { label: 'Other', value: 'other' }
] as const;

export const default_three_phase_types = {
  WYE: 'wye',
  DELTA: 'delta',
  ALGO: 'algo'
} as const;

export const default_phases = {
  ONE_PHASE: 'one_phase',
  THREE_PHASE_WYE: 'three_phase_wye',
  THREE_PHASE_DELTA: 'three_phase_delta'
} as const;

export const DEFAULT_THREE_PHASE_TYPES_ENUMS = toLabelValueArray(default_three_phase_types);

export const DEFAULT_THREE_PHASE_TYPES_OPTIONS = getEnumValues(default_three_phase_types);

export const DEFAULT_PHASES_ENUMS = toLabelValueArray(default_phases);

export const DEFAULT_PHASES_OPTIONS = getEnumValues(default_phases);

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