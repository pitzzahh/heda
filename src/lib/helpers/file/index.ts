import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, exists, readDir, type ExistsOptions } from '@tauri-apps/plugin-fs';

export const BASE_DIR = BaseDirectory.Document;
export const BASE_DIR_PATH = 'heda';
export const EXTENSION = 'heda'

export interface ParsedFileName {
  baseName: string;
  number: number | null;
  extension: string;
}

/**
 * Gets the file name without the extension
 * @param path - The full path of the file
 * @param extension - The extension to remove
 * @returns The file name without the extension
 */
export function getFileNameWithoutExtension(path: string, extension: string = EXTENSION): string {
  const fileName = path.split('/').pop() || '';
  const lastDotIndex = fileName.lastIndexOf(`.${extension}`);
  return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
}

/* Parses a filename into its components: base name, number(if any), and extension
 * @example
 * parseFileName("Untitled.heda") -> { baseName: "Untitled", number: null, extension: ".heda" }
 * parseFileName("Untitled (1).heda") -> { baseName: "Untitled", number: 1, extension: ".heda" }
 */

export async function getFileMetaData(path: string) {
  try {
    return await invoke('get_file_metadata', { path });
  } catch (error) {
    console.error('Error reading file attributes:', error);
  }
}

export async function getFileName(path: string): Promise<string | undefined> {
  try {
    return await invoke("get_file_name", { path });
  } catch (err) {
    console.error("Error fetching environment variable:", err);
    return undefined;
  }
}

export async function doesFileExists(path: string | URL, options?: ExistsOptions): Promise<boolean> {
  try {
    return await exists(path, options);
  } catch (err) {
    console.error("Error checking if file exists:", err);
    return false;
  }
}

export async function generateUniqueFileName(baseName: string, baseDir: BaseDirectory): Promise<string> {
  let fileName = `${baseName}.${EXTENSION}`;
  let counter = 1;
  while (await doesFileExists(fileName, { baseDir })) {
    fileName = `${baseName}-(${counter}).${EXTENSION}`;
    counter++;
  }
  return fileName;
}

