import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, exists, readDir, type ExistsOptions } from '@tauri-apps/plugin-fs';

export const BASE_DIR = BaseDirectory.Document;
export const BASE_DIR_PATH = 'heda';

export interface ParsedFileName {
  baseName: string;
  number: number | null;
  extension: string;
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
  } catch (error) {
    return false;
  }
}

/**
 * Parses a filename into its components: base name, number (if any), and extension
 * @example
 * parseFileName("Untitled.heda") -> { baseName: "Untitled", number: null, extension: ".heda" }
 * parseFileName("Untitled (1).heda") -> { baseName: "Untitled", number: 1, extension: ".heda" }
 */
function parseFileName(fileName: string): ParsedFileName {
  const regex = /^(.*?)(?: \((\d+)\))?(\.[^.]+)?$/;
  const match = fileName.match(regex);

  if (!match) {
    return {
      baseName: fileName,
      number: null,
      extension: ''
    };
  }

  return {
    baseName: match[1],
    number: match[2] ? parseInt(match[2], 10) : null,
    extension: match[3] || ''
  };
}

function constructFileName(parts: ParsedFileName): string {
  const numberSuffix = parts.number !== null ? ` (${parts.number})` : '';
  return `${parts.baseName}${numberSuffix}${parts.extension}`;
}

/**
 * Gets all existing files that match the base pattern in the specified directory
 */
async function getExistingFiles(
  basePattern: string,
  extension: string,
  path: string,
  baseDir: BaseDirectory
): Promise<ParsedFileName[]> {
  try {
    const entries = await readDir(path, { baseDir });

    return entries
      .filter(entry => !entry.isDirectory && entry.name?.endsWith(extension))
      .map(entry => parseFileName(entry.name))
      .filter(parsed => parsed.baseName === basePattern);
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

/**
 * Generates a unique filename by appending a number if necessary
 */
export async function generateUniqueFileName(
  fileName: string,
  path: string,
  baseDir: BaseDirectory
): Promise<string> {
  const extension = '.heda';
  const parsed = parseFileName(fileName);
  const basePattern = parsed.baseName;

  const existingFiles = await getExistingFiles(basePattern, extension, path, baseDir);

  if (existingFiles.length === 0) {
    return constructFileName({
      baseName: basePattern,
      number: null,
      extension
    });
  }

  const highestNumber = Math.max(
    0,
    ...existingFiles.map(file => file.number || 0)
  );

  return constructFileName({
    baseName: basePattern,
    number: highestNumber + 1,
    extension
  });
}

/**
 * Checks if a file exists in the specified directory
 */
async function fileExists(
  fileName: string,
  path: string,
  baseDir: BaseDirectory
): Promise<boolean> {
  try {
    const entries = await readDir(path, { baseDir });
    return entries.some(entry => !entry.isDirectory && entry.name === fileName);
  } catch {
    return false;
  }
}