import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, exists, readFile, type ExistsOptions } from '@tauri-apps/plugin-fs';

export const BASE_DIR = BaseDirectory.Document;

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

export async function generateUniqueFileName(file_name: string, baseDir: BaseDirectory): Promise<string> {
  let finalFileName = `${file_name}.heda`;
  let count = 1;

  // Check if file exists and append count if necessary
  while (await fileExists(finalFileName, baseDir)) {
    const match = finalFileName.match(/^(.*?)(?: \((\d+)\))?\.heda$/);
    if (match) {
      const baseName = match[1];
      count = match[2] ? parseInt(match[2]) + 1 : count + 1;
      finalFileName = `${baseName} (${count}).heda`;
    } else {
      finalFileName = `${file_name} (${count}).heda`;
    }
  }

  return finalFileName;
}

export async function fileExists(filePath: string, baseDir: BaseDirectory): Promise<boolean> {
  try {
    await readFile(filePath, { baseDir });
    return true;
  } catch (error) {
    return false;
  }
}
