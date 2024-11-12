export const ambient_temperatures = [
  { label: '60', value: '60' },
  { label: '75', value: '75' },
  { label: '90', value: '90' },
  { label: 'temparature limitation', value: 'default' }
] as const;

export const FIELD_VALIDATION = {
  TEST: {
    SPECIAL_CHAR: (value: string) => /[-._!"`'#%&,:;<>=@{}~\$\(\)\*\+\/\\\?\[\]\^\|]+/.test(value),
    LOWERCASE: (value: string) => /[a-z]/.test(value),
    UPPERCASE: (value: string) => /[A-Z]/.test(value),
    NUMBER: (value: string) => value && /.*[0-9].*/.test(value),
    ALL_NUMBER: (value: string) => /^[0-9]+$/.test(value)
  },
  MSG: {
    MIN_LEN: 'Password must be at least 8 characters long.',
    SPECIAL_CHAR: 'Password must contain at least one special character.',
    LOWERCASE: 'Password must contain at least one lowercase letter.',
    UPPERCASE: 'Password must contain at least one uppercase letter.',
    NUMBER: 'Password must contain at least one number.',
    MATCH: 'Passwords must match.'
  }
};

export const MIN_LOAD_QUANTITY = 1;
export const MAX_LOAD_QUANTITY = 100;
export const MIN_WIRE_LENGTH = 1;
export const MAX_WIRE_LENGTH = 1000;
export const MIN_VARIES = 0;
export const MAX_VARIES = 100;