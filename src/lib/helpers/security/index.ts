import { invoke } from "@tauri-apps/api/core";
import { readFile, create, BaseDirectory } from "@tauri-apps/plugin-fs";
import CryptoJS from "crypto-js";

export function encryptData<T>(data: T, passphrase: string, file_name: string): string {
  const key = generateKey(passphrase, file_name);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, { iv: iv });
  const hmac = CryptoJS.HmacSHA256(iv.toString(CryptoJS.enc.Base64) + encrypted.toString(), key);

  return [
    iv.toString(CryptoJS.enc.Base64),
    hmac.toString(CryptoJS.enc.Base64),
    encrypted.toString()
  ].join(':');
}

export function decryptData<T>(encryptedData: string, passphrase: string, salt: string): T {
  const [ivBase64, hmacBase64, encryptedBase64] = encryptedData.split(":");

  if (!ivBase64 || !hmacBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted data format");
  }

  // Parse the IV and HMAC
  const iv = CryptoJS.enc.Base64.parse(ivBase64);
  const hmac = CryptoJS.enc.Base64.parse(hmacBase64);

  // Generate the key
  const key = generateKey(passphrase, salt);

  console.log('Key:', keyToString(key));

  // Verify the HMAC
  const computedHmac = CryptoJS.HmacSHA256(ivBase64 + encryptedBase64, key);
  if (CryptoJS.enc.Hex.stringify(hmac) !== CryptoJS.enc.Hex.stringify(computedHmac)) {
    throw new Error("Data integrity check failed");
  }

  // Decrypt the data
  let decryptedData: string;
  try {
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedBase64, key, { iv: iv });
    decryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    throw new Error("Decryption failed: " + err);
  }

  if (!decryptedData) {
    throw new Error("Decryption failed: No data");
  }

  return JSON.parse(decryptedData) as T;
}

export async function writeEncryptedFile<T>(file_name: string, data: T, secret_key: string): Promise<void> {
  try {
    const encryptedData: string = encryptData(data, secret_key, file_name);
    const fileBuffer: Uint8Array = new TextEncoder().encode(encryptedData);

    const file = await create(`${file_name}.heda`, {
      baseDir: BaseDirectory.Document,
    });

    await file.write(fileBuffer);
    await file.close();

    console.log("File written successfully!");
  } catch (error) {
    console.error("Error writing file:", error);
    throw error;
  }
}

export async function readEncryptedFile<T>(filePath: string, pass_phrase: string, salt: string): Promise<T | null> {
  try {
    const fileBuffer: Uint8Array = await readFile(filePath);
    const encryptedData: string = new TextDecoder().decode(fileBuffer); // Convert binary to string
    // get the file name from the path
    const decryptedData: T = decryptData<T>(encryptedData, pass_phrase, salt);

    console.log("File read successfully!");
    return decryptedData;
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}

export async function getEnv(key: string): Promise<string | null> {
  try {
    return await invoke("get_env_var", { key });
  } catch (err) {
    console.error("Error fetching environment variable:", err);
    return null;
  }
}

export function generateKey(passphrase: string, salt: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passphrase, CryptoJS.enc.Hex.parse(salt), {
    keySize: 256 / 32,
    iterations: 1000
  });
}

export function generateRandomSalt(length: number = 16): string {
  return CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Hex);
}

export function keyToString(key: CryptoJS.lib.WordArray): string {
  return key.toString(CryptoJS.enc.Hex);
}

export function stringToKey(keyString: string): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Hex.parse(keyString);
}