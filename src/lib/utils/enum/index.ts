import { z } from 'zod';

export function getEnumValues<T extends Record<string, string>>(enumObj: T): T[keyof T][] {
  return Object.values(enumObj) as T[keyof T][];
}

export function getEnumKeys<T extends Record<string, string>>(enumObj: T): (keyof T)[] {
  return Object.keys(enumObj) as (keyof T)[];
}

// TODO: May issue, need to fix, unused function
export function createZodEnum<T extends Record<string, string>>(enumObj: T) {
  return z.enum(Object.values(enumObj) as [T[keyof T], ...T[keyof T][]]);
}