
/**
 * Deeply compares two objects or undefined values for structural equality.
 *
 * This function supports various types of nested values, including arrays, dates,
 * functions, and other objects. It returns `true` if both objects contain the same
 * keys with identical values and `false` otherwise.
 *
 * - Arrays are considered equal if they contain the same elements in any order.
 * - Dates are equal if their timestamps match.
 * - Functions are considered equal based on their type (i.e., both must be functions).
 * - Nested objects are compared recursively.
 *
 * @typeParam T - A generic type extending a record or undefined.
 * @param o - The first object to compare.
 * @param p - The second object to compare.
 * @returns `true` if both values are deeply equal; otherwise, `false`.
 *
 * @example
 * const obj1 = { name: 'Alice', age: 25 };
 * const obj2 = { name: 'Alice', age: 25 };
 * deepEqual(obj1, obj2); // true
 *
 * const obj3 = { name: 'Alice', age: 30 };
 * deepEqual(obj1, obj3); // false
 */
export function deepEqual<T extends Record<string, any> | undefined>(o: T, p: T): boolean {
	if (o === p) return true; // both are the same reference or both are undefined
	if (!o || !p) return false; // one is undefined while the other is not

	const keysO = Object.keys(o).sort();
	const keysP = Object.keys(p).sort();

	if (keysO.length !== keysP.length) return false;
	if (keysO.join('') !== keysP.join('')) return false;

	for (const key of keysO) {
		const valueO = o[key];
		const valueP = p[key];

		if (Array.isArray(valueO)) {
			if (!Array.isArray(valueP) || valueO.sort().join('') !== valueP.sort().join('')) {
				return false;
			}
		} else if (valueO instanceof Date) {
			if (!(valueP instanceof Date) || valueO.getTime() !== valueP.getTime()) {
				return false;
			}
		} else if (typeof valueO === 'function') {
			if (typeof valueP !== 'function') {
				return false;
			}
		} else if (valueO && typeof valueO === 'object') {
			if (!valueP || typeof valueP !== 'object' || !deepEqual<T>(valueO, valueP)) {
				return false;
			}
		} else if (valueO !== valueP) {
			return false;
		}
	}
	return true;
}

/**
 * Checks if a given date string represents a valid calendar date.
 *
 * This function validates the date string by parsing it to a `Date` object
 * and ensuring that each component (year, month, and day) matches the
 * parsed result. This prevents cases where dates like "February 29" 
 * on non-leap years might be considered valid.
 *
 * @param dateString - The date string in "YYYY-MM-DD" format to validate.
 * @returns `true` if the date string represents a valid date; otherwise, `false`.
 *
 * @example
 * isValidDate('2023-01-01'); // true
 * isValidDate('2024-02-29'); // true (leap year)
 * isValidDate('2023-02-29'); // false (non-leap year)
 * isValidDate('invalid-date'); // false
 * isValidDate(); // false
 */
export function isValidDate(dateString?: string): boolean {
	if (!dateString) return false;

	const parsedDate = new Date(dateString);
	const timestamp = parsedDate.getTime();

	// Check if the dateString was invalid, resulting in NaN timestamp
	if (isNaN(timestamp)) return false;

	// Ensure the components match to verify a valid date (e.g., avoid February 29 on non-leap years)
	const [year, month, day] = dateString.split('-').map(Number);
	return (
		parsedDate.getUTCFullYear() === year &&
		parsedDate.getUTCMonth() + 1 === month && // getUTCMonth is zero-based
		parsedDate.getUTCDate() === day
	);
}


export function hasRequiredKeys<T extends object>(
	obj: T,
	requiredKeys?: Array<keyof T>,
	skipKeys: Array<keyof T> = []
): boolean {
	// Determine the keys to check: either the provided requiredKeys or all keys of the object
	const keysToCheck = requiredKeys ?? (Object.keys(obj) as Array<keyof T>);

	return keysToCheck.every((key) => {
		if (skipKeys.includes(key)) {
			return true;
		}
		return obj[key] !== undefined && obj[key] !== null;
	});
}
