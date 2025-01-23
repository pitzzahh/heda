import { toast } from "svelte-sonner";

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

/**
 * Checks if an object has all required keys with valid data.
 * @param obj - The object to check.
 * @param requiredKeys - An array of required keys to verify in the object.
 * @returns True if the object contains all required keys with valid data; false otherwise.
 */
export function hasRequiredData<T extends object>(
	obj: Partial<T>,
	requiredKeys: (keyof T)[]
): boolean {
	return requiredKeys.every((key) => {
		const value = obj[key];
		if (value === null || value === undefined) return false;
		if (typeof value === 'string') return value.trim() !== '';
		if (Array.isArray(value)) {
			return value.length > 0 && value.every(item => {
				if (item === null || item === undefined) return false;
				if (typeof item === 'object') return hasRequiredData<Record<string, unknown>>(item, Object.keys(item));
				return true;
			});
		}
		if (typeof value === 'object') return hasRequiredData<Record<string, unknown>>(value, Object.keys(value));
		return true;
	});
}

type NestedKey = string | string[];

/**
 * Checks if the required keys exist in the object and are not null/undefined.
 * @param obj - The object to check.
 * @param keys - The required keys, including paths to nested keys as arrays.
 * @returns True if all required keys are present and have data, otherwise false.
 */
export function hasRequiredFields<T extends Record<string, any>>(obj: T, keys: NestedKey[]): boolean {
	const isPresent = (value: any): boolean => value !== null && value !== undefined;

	const checkKey = (obj: any, path: NestedKey): boolean => {
		if (typeof path === "string") {
			return isPresent(obj[path]);
		}

		return path.reduce((subObj, key) => (isPresent(subObj) ? subObj[key] : undefined), obj) !== undefined;
	};

	return keys.every((key) => checkKey(obj, key));
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

export function validateEnv(app_pass_phrase: string | null, file_encryption_salt: string | null) {
	if (!app_pass_phrase) {
		return toast.warning('Failed to get the APP_PASS_PHRASE', {
			description:
				'This is a system error and should not be here, the error has been logged.'
		});
	}
	if (!file_encryption_salt) {
		return toast.warning('Failed to get the FILE_ENCRYPTION_SALT', {
			description:
				'This is a system error and should not be here, the error has been logged.'
		});
	}
	return true;
}