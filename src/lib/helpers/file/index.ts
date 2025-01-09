import { invoke } from "@tauri-apps/api/core";

export async function getFileName(path: string): Promise<string | undefined> {
  try {
    return await invoke("get_file_name", { path });
  } catch (err) {
    console.error("Error fetching environment variable:", err);
    return undefined;
  }
}