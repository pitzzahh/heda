/**
 * Formats mixed fractions like "1 1/2" into an HTML-rendered fraction.
 * 
 * @param input - The string containing fractions to be formatted.
 * @returns A string with fractions replaced by HTML markup.
 */
export function formatFraction(input: string): string {
  return input.replace(
    /(\d+)\s*(\d)\/(\d)/g, // Match mixed fractions like "1 1/2"
    (_, whole: string, numerator: string, denominator: string) =>
      `${whole} <sup>${numerator}</sup>&frasl;<sub>${denominator}</sub>` // HTML fraction
  );
}
