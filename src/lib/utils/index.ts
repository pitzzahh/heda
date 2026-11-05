export { cn } from 'cn';

/**
 * Finds the key corresponding to a given value in an object.
 * @param obj - The object to search in.
 * @param value - The value to match.
 * @returns The key as a string, or undefined if not found.
 */
export function getKeyByValue<T extends Record<string, string>>(
	obj: T,
	value: string
): keyof T | undefined {
	return (Object.keys(obj) as (keyof T)[]).find((key) => obj[key] === value);
}
