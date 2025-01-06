import { invoke } from "@tauri-apps/api/core";
import { readFile, create, BaseDirectory } from "@tauri-apps/plugin-fs";
import CryptoJS from "crypto-js";

// Encrypt data
export function encryptData<T>(data: T, secret_key: string): string {
  const jsonData = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonData, secret_key).toString();
}

// Decrypt data
export function decryptData<T>(encryptedData: string, secret_key: string): T {
  const bytes = CryptoJS.AES.decrypt(encryptedData, secret_key);
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedData) as T;
}

export async function writeEncryptedFile<T>(file_name: string, data: T, secret_key: string): Promise<void> {
  try {
    const encryptedData: string = encryptData(data, secret_key);
    const fileBuffer: Uint8Array = new TextEncoder().encode(encryptedData);
    const file = await create(`${file_name}.heda`, {
      baseDir: BaseDirectory.Document
    });
    await file.write(fileBuffer);
    await file.close();
    console.log("File written successfully!");
  } catch (error) {
    console.error("Error writing file:", error);
    throw error;
  }
}

export async function readEncryptedFile<T>(filePath: string, secret_key: string): Promise<T | null> {
  try {
    const fileBuffer: Uint8Array = await readFile(filePath);
    const encryptedData: string = new TextDecoder().decode(fileBuffer); // Convert binary to string
    const decryptedData: T = decryptData<T>(encryptedData, secret_key);
    console.log("File read successfully!");
    return decryptedData;
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}

export async function getEnv(key: string): Promise<string | undefined> {
  try {
    return await invoke("get_env_var", { key })
  } catch (err) {
    console.error(err)
  }
}