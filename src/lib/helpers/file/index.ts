import { invoke } from "@tauri-apps/api/core";

export async function getFileName(path: string): Promise<string | undefined> {
  try {
    return await invoke("get_file_name", { path });
  } catch (err) {
    console.error("Error fetching environment variable:", err);
    return undefined;
  }
}

export async function renameFile(old_path: string, new_path: string): Promise<boolean> {
  try {
    await invoke("rename_file", { old_path, new_path });
    return true;
  } catch (err) {
    console.error("Error fetching environment variable:", err);
    return false;
  }
}