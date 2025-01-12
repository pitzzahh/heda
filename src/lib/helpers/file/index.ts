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

/* Parses a filename into its components: base name, number(if any), and extension
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
    console.log(`${counter}||File: ${fileName} exists, renaming into: ${fileName}`)
    counter++;
  }

  console.log('generateUniqueFileName', fileName)

  return fileName;
}