import { invoke } from "@tauri-apps/api/core";
import { readFile, create, BaseDirectory } from "@tauri-apps/plugin-fs";
import CryptoJS from "crypto-js";

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
  const jsonData = JSON.stringify(data);

  // Generate a random IV
  const iv = CryptoJS.lib.WordArray.random(16);

  // Encrypt the data with the IV
  const encrypted = CryptoJS.AES.encrypt(jsonData, CryptoJS.enc.Utf8.parse(secret_key), { iv }).toString();

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

export async function writeEncryptedFile<T>(file_name: string, data: T, secret_key: string): Promise<void> {
  try {
    const encryptedData: string = encryptData(data, secret_key);
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
    return await invoke("get_env_var", { key });
  } catch (err) {
    console.error("Error fetching environment variable:", err);
    return undefined;
  }
}
