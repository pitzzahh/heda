export function convertToNormalText(
  text: unknown,
  include_separators: boolean = false,
  separators: string[] = []
): string {
  let textStr = String(text);
  let trimmedText = textStr.trim().replaceAll('_', ' ').replaceAll('-', ' ');

  if (include_separators && separators.length > 0) {
    for (const separator of separators) {
      trimmedText = trimmedText.replaceAll(separator, ' ');
    }
  }

  return trimmedText.charAt(0).toUpperCase() + trimmedText.slice(1).toLowerCase();
}

/**
 * Extracts the first token from a given path string.
 *
 * @param path - The input path string.
 * @returns The first token in the path.
 */
export const extractMainRoute = (path: string): string => {
  if (path === '/') {
    return '/';
  }

  const tokens = path.split('/').filter((token) => token);

  return tokens.length > 0 ? `/${tokens[0]}` : '';
};