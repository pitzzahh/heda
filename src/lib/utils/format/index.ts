/**
 * Formats mixed fractions like "1 1/2" into an HTML-rendered fraction.
 * 
 * @param input - The string containing fractions to be formatted.
 * @returns A string with fractions replaced by HTML markup.
 */
export function formatFraction(input: string): string {
  return input
    // Match mixed fractions
    .replace(/(\d+)\s+(\d+)\/(\d+)/g, (_, whole: string, numerator: string, denominator: string) =>
      `${whole} <sup>${numerator}</sup>&frasl;<sub>${denominator}</sub>`
    )
    // Match simple fractions
    .replace(/(\d+)\/(\d+)/g, (_, numerator: string, denominator: string) =>
      `<sup>${numerator}</sup>&frasl;<sub>${denominator}</sub>`
    )
    // Match single digits (if specific formatting is needed)
    .replace(/\b(\d+)\b/g, '$1');
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
