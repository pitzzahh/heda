import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, exists, open as openFile, FileHandle, readFile, type ExistsOptions } from '@tauri-apps/plugin-fs';
import { encryptData, decryptData, getEnv, generateKey, keyToString } from "@/helpers/security";
import { validateEnv } from "@/utils/validation";
import type { FileExport, RecentProject } from "@/types/main";
import { goto } from "$app/navigation";
import { loadCurrentProject } from "@/db/mutations";
import { toast } from "svelte-sonner";
import { open as openDialog } from '@tauri-apps/plugin-dialog';

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
    console.error(`Error reading file attributes: ${JSON.stringify(err, null, 2)}`);
  }
}

export async function getFileName(path: string): Promise<string | undefined> {
  try {
    return await invoke("get_file_name", { path });
  } catch (err) {
    console.error(`Error fetching environment variable: ${JSON.stringify(err, null, 2)}`);

    return undefined;
  }
}

export async function doesFileExists(path: string | URL, options?: ExistsOptions): Promise<boolean> {
  try {
    return await exists(path, options);
  } catch (err) {
    console.error(`Error checking if file exists: ${JSON.stringify(err, null, 2)}`);
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


export async function handleLoadFile(complete_file_path?: string | null, _procesing?: () => void, _idle?: () => void): Promise<RecentProject | undefined | string | number> {
  try {
    _procesing?.();
    const app_pass_phrase = await getEnv('APP_PASS_PHRASE');
    const file_encryption_salt = await getEnv('FILE_ENCRYPTION_SALT');

    if (!validateEnv(app_pass_phrase, file_encryption_salt)) {
      _idle?.();
      return;
    }

    if (!complete_file_path) {
      complete_file_path = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: 'HEDA Files', extensions: ['heda'] }]
      });

      if (!complete_file_path) {
        _idle?.();
        return toast.warning('No file selected', {
          description: 'Cannot proceed, no file is selected.'
        });
      }
    }

    toast.loading(`Loading file: ${complete_file_path}`, {
      description: 'Please wait while the file is being loaded.'
    });

    const loaded_data = await readEncryptedFile<FileExport>(
      complete_file_path,
      keyToString(generateKey(app_pass_phrase!, file_encryption_salt!))
    );

    if (!loaded_data) {
      console.warn(`Failed to load file: ${JSON.stringify(loaded_data)}`);
      _idle?.();
      return toast.warning('Failed to load file', {
        description: 'An error occurred while loading the file.'
      });
    }

    const file_name = await getFileName(complete_file_path);

    if (!file_name) {
      console.error(`Failed to get file name of: ${complete_file_path}`);
      _idle?.();
      return toast.warning(`Failed to get file name of: ${complete_file_path}`, {
        description: 'This is a system error and should not be here, the error has been logged.'
      });
    }

    console.log(`Loaded data: ${JSON.stringify(loaded_data)}`);
    console.log(`Complete file path: ${complete_file_path}`);
    console.log(`File name: ${file_name}`);

    const loaded_project = await loadCurrentProject(loaded_data);

    return {
      id: loaded_project.id,
      project_name: file_name,
      project_path: complete_file_path,
      exists: true
    };
  } catch (err) {
    _idle?.();
    console.error(`Failed to load file: ${JSON.stringify(err, null, 2)}`);
    toast.error(`Failed to load file: ${(err as any)?.message ?? 'something went wrong'}`, {
      description: 'This is a system error and should not be here, the error has been logged.'
    });
  }
}