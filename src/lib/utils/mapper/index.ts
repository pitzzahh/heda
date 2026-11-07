import type { LabelValuePair, LabelKeyPair } from '#lib/types/generic/index.js';

export function toLabelValueArray<T extends Record<string, string>>(data: T): LabelValuePair<T>[] {
	return Object.keys(data).map((key) => ({
		label: key as keyof T,
		value: data[key as keyof T]
	}));
}

export function toLabelKeyArray<T extends Record<string, string>>(data: T): LabelKeyPair<T>[] {
	return Object.keys(data).map((key) => ({
		label: key as keyof T,
		key: key
	}));
}
