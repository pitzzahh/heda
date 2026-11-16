export function getEnumKeys<T extends Record<string, string>>(enumObj: T): (keyof T)[] {
	return Object.keys(enumObj) as (keyof T)[];
}
