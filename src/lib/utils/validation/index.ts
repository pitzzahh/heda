export const FIELD_VALIDATION = {
	TEST: {
		SPECIAL_CHAR: (value: string) => /[-._!"`'#%&,:;<>=@{}~\$\(\)\*\+\/\\\?\[\]\^\|]+/.test(value),
		LOWERCASE: (value: string) => /[a-z]/.test(value),
		UPPERCASE: (value: string) => /[A-Z]/.test(value),
		NUMBER: (value: string) => value && /.*[0-9].*/.test(value),
		ALL_NUMBER: (value: string) => /^[0-9]+$/.test(value),
		NO_NUMBER: (value: string) => !/.*[0-9].*/.test(value)
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
