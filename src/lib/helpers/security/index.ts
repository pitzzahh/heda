import { invoke } from "@tauri-apps/api/core";
import CryptoJS from "crypto-js";

// Encrypt data
export function encryptData<T>(data: T, secret_key: string): string {
  // Generate a random IV
  const iv = CryptoJS.lib.WordArray.random(16);

  // Encrypt the data with the IV
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), CryptoJS.enc.Utf8.parse(secret_key), { iv }).toString();

  // Generate an HMAC for integrity
  const hmac = CryptoJS.HmacSHA256(iv.toString(CryptoJS.enc.Base64) + encrypted, secret_key);

  // Encode IV, HMAC, and encrypted data with custom gibberish encoding
  const ivEncoded = iv.toString(CryptoJS.enc.Base64);
  const hmacEncoded = hmac.toString(CryptoJS.enc.Base64);
  const encryptedEncoded = encrypted;

  return `${ivEncoded}:${hmacEncoded}:${encryptedEncoded}`;
}

// Decrypt data
export function decryptData<T>(encryptedData: string, secret_key: string): T {
  const [ivGibberish, hmacGibberish, encryptedGibberish] = encryptedData.split(":");

  if (!ivGibberish || !hmacGibberish || !encryptedGibberish) {
    throw new Error("Invalid encrypted data format");
  }

  // Parse the IV and HMAC
  const iv = CryptoJS.enc.Base64.parse(ivGibberish);
  const hmac = CryptoJS.enc.Base64.parse(hmacGibberish);

  // Verify the HMAC
  const computedHmac = CryptoJS.HmacSHA256(ivGibberish + encryptedGibberish, secret_key);
  if (CryptoJS.enc.Hex.stringify(hmac) !== CryptoJS.enc.Hex.stringify(computedHmac)) {
    throw new Error("Data integrity check failed");
  }

  // Decrypt the data
  const decryptedBytes = CryptoJS.AES.decrypt(encryptedGibberish, CryptoJS.enc.Utf8.parse(secret_key), { iv });
  const decryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedData) {
    throw new Error("Decryption failed");
  }

  return JSON.parse(decryptedData) as T;
}

export async function getEnv(key: string): Promise<string | null> {
  return await invoke("get_env_var", { key });
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