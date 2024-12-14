import type { LabelValuePair, LabelKeyPair } from "@/types/generic";

/**
 * A generic function to convert an object to a label-value pair array.
 * @param data The object to convert to a label-value pair array.
 * @returns  An array of label-value pairs.
 */
export function toLabelValueArray<T extends Record<string, string>>(data: T): LabelValuePair<T>[] {
  return Object.keys(data).map((key) => ({
    label: key as keyof T,
    value: data[key as keyof T]
  }));
}

/**
 * A generic function to convert an object to a label-key pair array.
 * @param data The object to convert to a label-key pair array.
 * @returns  An array of label-key pairs.
 */
export function toLabelKeyArray<T extends Record<string, string>>(data: T): LabelKeyPair<T>[] {
  return Object.keys(data).map((key) => ({
    label: key as keyof T,
    key: key
  }));
}

/**
 * A generic function to compare two objects and return the properties that have changed.
 * If newData is empty, it will return all properties from originalData as changes.
 *
 * @param originalData - The original object (e.g., current data from the database).
 * @param newData - The new object (e.g., the updated data to be compared).
 * @returns A partial object containing only the properties that have changed between the two objects.
 *          If no changes are found and newData is empty, return all properties from originalData.
 *          If no changes are found but newData is not empty, return an empty object.
 * 
 * @template T - The type of the objects being compared.
 */
export function getChangedData<T>(originalData: T, newData: Partial<T>): Partial<T> {
  const changedData: Partial<T> = {};

  // If newData is empty, return all properties from originalData as changes
  if (Object.keys(newData).length === 0) {
    return { ...originalData };
  }

  // Iterate over the keys in newData to check for changes
  for (const key in newData) {
    // Check if the key exists in newData (to avoid comparing prototype keys)
    if (Object.prototype.hasOwnProperty.call(newData, key)) {
      // If the value has changed, add it to the changedData object
      if (newData[key] !== originalData[key]) {
        changedData[key] = newData[key];
      }
    }
  }

  // Return an empty object if no changes are found
  return Object.keys(changedData).length === 0 ? {} : changedData;
}