import type { LabelValuePair } from '#lib/types/generic.js';

export function toLabelValueArray<T extends Record<string, string>>(data: T): LabelValuePair<T>[] {
	return Object.keys(data).map((key) => ({
		label: key as keyof T,
		value: data[key as keyof T]
	}));
}
