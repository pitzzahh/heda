import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, exists, open as openFile, FileHandle, readFile, type ExistsOptions } from '@tauri-apps/plugin-fs';
import { encryptData, decryptData } from "@/helpers/security";

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

/**
 * A helper function to get the path of a file.
 * @param filePath the absolute file path.
 * @returns the path of the file.
 */
export function getFilePath(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
}

/* Parses a filename into its components: base name, number(if any), and extension
 * @example
 * parseFileName("Untitled.heda") -> { baseName: "Untitled", number: null, extension: ".heda" }
 * parseFileName("Untitled (1).heda") -> { baseName: "Untitled", number: 1, extension: ".heda" }
 */

export async function getFileMetaData(path: string) {
  try {
    return await invoke('get_file_metadata', { path });
  } catch (err) {
    console.error(`Error reading file attributes: ${JSON.stringify(err)}`);
  }
}

export async function getFileName(path: string): Promise<string | undefined> {
  try {
    return await invoke("get_file_name", { path });
  } catch (err) {
    console.error(`Error fetching environment variable: ${JSON.stringify(err)}`);

    return undefined;
  }
}

export async function doesFileExists(path: string | URL, options?: ExistsOptions): Promise<boolean> {
  try {
    return await exists(path, options);
  } catch (err) {
    console.error(`Error checking if file exists: ${JSON.stringify(err)}`);
    return false;
  }
}

export async function generateUniqueFileName(baseName: string, options?: ExistsOptions): Promise<string> {
  let fileName = `${baseName}.${EXTENSION}`;
  let counter = 1;
  while (await doesFileExists(fileName, options)) {
    fileName = `${baseName}-(${counter}).${EXTENSION}`;
    counter++;
  }
  return fileName;
}

export async function writeEncryptedFile<T>(data: T, secret_key: string, file_path: string, new_file: boolean = false): Promise<void> {
  if (!file_path) {
    throw new Error("No file to write to");
  }
  const file = await openFile(file_path, { write: true, create: true, createNew: new_file });
  await file.write(new TextEncoder().encode(encryptData<T>(data, secret_key)));
  await file.close();
}
export async function readEncryptedFile<T>(filePath: string, secret_key: string): Promise<T | null> {
  const decryptedData: T = decryptData<T>(new TextDecoder().decode(await readFile(filePath)), secret_key);
  console.log("File read successfully!");
  return decryptedData;
}
