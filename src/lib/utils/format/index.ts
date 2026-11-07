/**
 * Formats mixed fractions like "1 1/2" into an HTML-rendered fraction.
 *
 * @param input - The string containing fractions to be formatted.
 * @returns A string with fractions replaced by HTML markup.
 */
export function formatFraction(input: string): string {
	// Escape first so only matched digits reach the markup below; fraction
	// rendering of plain numeric input is unchanged.
	return (
		input
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			// Match mixed fractions
			.replace(
				/(\d+)\s+(\d+)\/(\d+)/g,
				(_, whole: string, numerator: string, denominator: string) =>
					`${whole} <sup>${numerator}</sup>&frasl;<sub>${denominator}</sub>`
			)
			// Match simple fractions
			.replace(
				/(\d+)\/(\d+)/g,
				(_, numerator: string, denominator: string) =>
					`<sup>${numerator}</sup>&frasl;<sub>${denominator}</sub>`
			)
	);
}

/**
 * Resolves the display label for an option value. Falls back to the raw value
 * so data written by older app versions still renders.
 *
 * @param options - Options carrying canonical values and display labels.
 * @param value - The stored value to resolve.
 * @returns The display label, the raw value, or an empty string.
 */
export function getOptionLabel(
	options: readonly { value: string; label: string }[],
	value: string | null | undefined
): string {
	return options.find((option) => option.value === value)?.label ?? value ?? '';
}

/**
 * Formats a number into an ordinal suffix.
 *
 * @param n - The number to be formatted.
 * @returns The number with an ordinal suffix.
 */
export function getOrdinalSuffix(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
