export type PasswordRule = {
	id: string;
	label: string;
	test: (password: string) => boolean;
};

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;
const LEVELS: PasswordStrengthLevel[] = [0, 1, 2, 3, 4];
export type PasswordStrength = {
	level: PasswordStrengthLevel;
	/** Rule ids that pass. */
	met: string[];
	/** Shorter than the short length, so the meter holds at its first step. */
	short: boolean;
};

export type PasswordStrengthLabels = Record<
	'empty' | 'tooShort' | 'weak' | 'fair' | 'good' | 'strong',
	string
>;
export const DEFAULT_STRENGTH_LABELS: PasswordStrengthLabels = {
	empty: 'No password yet',
	tooShort: 'Too short',
	weak: 'Weak',
	fair: 'Fair',
	good: 'Good',
	strong: 'Strong'
};

/** Counts code points, so an emoji counts once. */
export const countCodePoints = (password: string) => Array.from(password).length;

/** The usual four rules: length, mixed case, a number and a symbol. */
export function passwordRules(minLength = 12): PasswordRule[] {
	return [
		{
			id: 'length',
			label: `At least ${minLength} characters`,
			test: (password) => countCodePoints(password) >= minLength
		},
		{
			id: 'case',
			label: 'Upper and lowercase letters',
			test: (password) => /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password)
		},
		{
			id: 'number',
			label: 'At least one number',
			test: (password) => /\p{N}/u.test(password)
		},
		{
			id: 'symbol',
			label: 'At least one symbol',
			test: (password) => /[^\p{L}\p{N}\s]/u.test(password)
		}
	];
}

/** Strength is the share of rules met, spread over four steps; short passwords hold at the first. */
export function measurePassword(
	password: string,
	rules: PasswordRule[],
	shortLength = 8
): PasswordStrength {
	const met = rules.filter((rule) => rule.test(password)).map((rule) => rule.id);
	const short = password.length > 0 && countCodePoints(password) < shortLength;
	if (!password) return { level: 0, met, short: false };
	const share = rules.length ? met.length / rules.length : 1;
	const step = short ? 1 : Math.max(1, Math.round(share * 4));
	return { level: LEVELS[Math.min(4, step)] ?? 1, met, short };
}

export function strengthLabel(
	password: string,
	strength: PasswordStrength,
	labels: PasswordStrengthLabels
) {
	if (!password) return labels.empty;
	if (strength.short) return labels.tooShort;
	return (
		[labels.weak, labels.weak, labels.fair, labels.good, labels.strong][strength.level] ??
		labels.weak
	);
}
