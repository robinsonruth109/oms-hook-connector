import "dotenv/config";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.OMS_ENCRYPTION_KEY?.trim();

  if (!encodedKey) {
    throw new Error(
      "OMS_ENCRYPTION_KEY is missing. Add it to your environment variables.",
    );
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new Error(
      "OMS_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function encryptSecret(plainText: string): string {
  if (!plainText) {
    throw new Error("Cannot encrypt an empty value.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptSecret(encryptedValue: string): string {
  const parts = encryptedValue.split(".");

  if (parts.length !== 4) {
    throw new Error("Encrypted value has an invalid format.");
  }

  const [version, ivValue, authTagValue, cipherTextValue] = parts;

  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported encryption format: ${version}`);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivValue, "base64");
  const authTag = Buffer.from(authTagValue, "base64");
  const cipherText = Buffer.from(cipherTextValue, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Encrypted value contains an invalid IV.");
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Encrypted value contains an invalid authentication tag.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}