/** Formats "1 1/2" into an HTML-rendered fraction. */
export function formatFraction(input: string): string {
	// Escape first so only matched digits reach the markup below.
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

/** Display label for a stored value; raw value if an older app version wrote it. */
export function getOptionLabel(
	options: readonly { value: string; label: string }[],
	value: string | null | undefined
): string {
	return options.find((option) => option.value === value)?.label ?? value ?? '';
}

export function getOrdinalSuffix(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function convertToNormalText(
	text: unknown,
	include_separators: boolean = false,
	separators: string[] = ['|', '_', '-']
): string {
	const textStr = String(text);
	let trimmedText = textStr.trim().replaceAll('_', ' ').replaceAll('-', ' ');

	if (include_separators && separators.length > 0) {
		for (const separator of separators) {
			trimmedText = trimmedText.replaceAll(separator, ' ');
		}
	}

	return trimmedText.charAt(0).toUpperCase() + trimmedText.slice(1).toLowerCase();
}
