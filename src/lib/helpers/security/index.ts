import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import CryptoJS from "crypto-js";
import type { ProjectState } from "@/hooks/project-state.svelte";

// Custom encoding map (Base64 to gibberish Unicode)
const customCharMap: { [key: string]: string } = {
  "a": "♜", // Rook
  "B": "♞", // Knight
  "c": "♝", // Bishop
  "D": "♛", // Queen
  "e": "♚", // King
  "F": "♟", // Pawn
  "g": "♖", // Rook
  "H": "♘", // Knight
  "i": "♗", // Bishop
  "J": "♕", // Queen
  "k": "♔", // King
  "L": "♙", // Pawn
  "m": "♠", // Spade
  "N": "♣", // Club
  "o": "♥", // Heart
  "P": "♦", // Diamond
  "q": "♪", // Music Note
  "R": "♫", // Music Note
  "s": "☼", // Sun
  "T": "☾", // Moon
  "u": "☁", // Cloud
  "V": "☂", // Umbrella
  "w": "☃", // Snowman
  "X": "✘", // Cross
  "y": "✔", // Checkmark
  "Z": "✦", // Star
  "0": "⓪",
  "2": "②",
  "4": "④",
  "6": "⑥",
  "8": "⑧",
};

// Function to encode Base64 using custom gibberish map
function encodeToCustomGibberish(base64String: string): string {
  return base64String
    .split("")
    .map((char) => customCharMap[char] || char)
    .join("");
}

// Function to decode gibberish back to Base64
function decodeFromCustomGibberish(gibberishString: string): string {
  const reverseMap = Object.fromEntries(
    Object.entries(customCharMap).map(([k, v]) => [v, k])
  );
  return gibberishString
    .split("")
    .map((char) => reverseMap[char] || char)
    .join("");
}

// Encrypt data
export function encryptData<T>(data: T, secret_key: string): string {
  // Generate a random IV
  const iv = CryptoJS.lib.WordArray.random(16);

  // Encrypt the data with the IV
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), CryptoJS.enc.Utf8.parse(secret_key), { iv }).toString();

  // Generate an HMAC for integrity
  const hmac = CryptoJS.HmacSHA256(iv.toString(CryptoJS.enc.Base64) + encrypted, secret_key);

  // Encode IV, HMAC, and encrypted data with custom gibberish encoding
  const ivEncoded = encodeToCustomGibberish(iv.toString(CryptoJS.enc.Base64));
  const hmacEncoded = encodeToCustomGibberish(hmac.toString(CryptoJS.enc.Base64));
  const encryptedEncoded = encodeToCustomGibberish(encrypted);

  return `${ivEncoded}:${hmacEncoded}:${encryptedEncoded}`;
}

// Decrypt data
export function decryptData<T>(encryptedData: string, secret_key: string): T {
  const [ivGibberish, hmacGibberish, encryptedGibberish] = encryptedData.split(":");

  if (!ivGibberish || !hmacGibberish || !encryptedGibberish) {
    throw new Error("Invalid encrypted data format");
  }

  // Decode gibberish back to Base64
  const ivBase64 = decodeFromCustomGibberish(ivGibberish);
  const hmacBase64 = decodeFromCustomGibberish(hmacGibberish);
  const encryptedBase64 = decodeFromCustomGibberish(encryptedGibberish);

  // Parse the IV and HMAC
  const iv = CryptoJS.enc.Base64.parse(ivBase64);
  const hmac = CryptoJS.enc.Base64.parse(hmacBase64);

  // Verify the HMAC
  const computedHmac = CryptoJS.HmacSHA256(ivBase64 + encryptedBase64, secret_key);
  if (CryptoJS.enc.Hex.stringify(hmac) !== CryptoJS.enc.Hex.stringify(computedHmac)) {
    throw new Error("Data integrity check failed");
  }

  // Decrypt the data
  const decryptedBytes = CryptoJS.AES.decrypt(encryptedBase64, CryptoJS.enc.Utf8.parse(secret_key), { iv });
  const decryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedData) {
    throw new Error("Decryption failed");
  }

  return JSON.parse(decryptedData) as T;
}

export async function writeEncryptedFile<T>(data: T, secret_key: string, project_state: ProjectState): Promise<void> {
  if (!project_state.current_file) {
    throw new Error("No file to write to");
  }
  console.log(`Writing to file: ${project_state.current_file}`);
  await project_state.current_file.write(new TextEncoder().encode(encryptData<T>(data, secret_key)));
  const file_stat = await project_state.current_file.stat()
  console.log(`File written successfully!: ${file_stat}`);
}

export async function readEncryptedFile<T>(filePath: string, secret_key: string): Promise<T | null> {
  const fileBuffer: Uint8Array = await readFile(filePath);
  const encryptedData: string = new TextDecoder().decode(fileBuffer); // Convert binary to string

  const decryptedData: T = decryptData<T>(encryptedData, secret_key);

  console.log("File read successfully!");
  return decryptedData;
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