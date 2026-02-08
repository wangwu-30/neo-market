import EthCrypto from 'eth-crypto';
import crypto from 'crypto';

// Use AES-256-GCM for symmetric encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length

/**
 * Encrypts a file using a random symmetric key, and encrypts that key with the buyer's public key.
 * 
 * @param fileBuffer - The content of the file to encrypt.
 * @param buyerPublicKey - The buyer's public key (secp256k1).
 * @returns An object containing the encrypted file buffer and the encrypted key envelope.
 */
export async function encryptDelivery(
  fileBuffer: Buffer,
  buyerPublicKey: string
): Promise<{ encryptedFile: Buffer; keyEnvelope: string }> {
  // 1. Generate a random symmetric key (32 bytes for AES-256)
  const fileKey = crypto.randomBytes(32);

  // 2. Encrypt the file with the symmetric key using AES-GCM
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, fileKey, iv);
  
  let encryptedData = cipher.update(fileBuffer);
  encryptedData = Buffer.concat([encryptedData, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + EncryptedData into a single buffer for storage
  // Format: [IV (12 bytes)] [AuthTag (16 bytes)] [EncryptedData (variable)]
  const encryptedFile = Buffer.concat([iv, authTag, encryptedData]);

  // 3. Encrypt the symmetric key with the buyer's public key (ECIES)
  // EthCrypto.encryptWithPublicKey returns an object { iv, ephemPublicKey, ciphertext, mac }
  // We need to stringify it to store/transmit easily as the "envelope"
  const encryptedKeyObject = await EthCrypto.encryptWithPublicKey(
    buyerPublicKey,
    fileKey.toString('hex') // key must be string for EthCrypto
  );
  
  const keyEnvelope = EthCrypto.cipher.stringify(encryptedKeyObject);

  return {
    encryptedFile,
    keyEnvelope
  };
}

/**
 * Decrypts the delivery using the buyer's private key.
 * 
 * @param encryptedFile - The encrypted file buffer (IV + AuthTag + Ciphertext).
 * @param keyEnvelope - The stringified encrypted key envelope.
 * @param buyerPrivateKey - The buyer's private key.
 * @returns The decrypted file buffer.
 */
export async function decryptDelivery(
  encryptedFile: Buffer,
  keyEnvelope: string,
  buyerPrivateKey: string
): Promise<Buffer> {
  // 1. Decrypt the symmetric key from the envelope
  const encryptedKeyObject = EthCrypto.cipher.parse(keyEnvelope);
  const fileKeyHex = await EthCrypto.decryptWithPrivateKey(
    buyerPrivateKey,
    encryptedKeyObject
  );
  const fileKey = Buffer.from(fileKeyHex, 'hex');

  // 2. Parse the encrypted file buffer
  // Format: [IV (12 bytes)] [AuthTag (16 bytes)] [EncryptedData (variable)]
  const iv = encryptedFile.subarray(0, IV_LENGTH);
  const authTag = encryptedFile.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encryptedData = encryptedFile.subarray(IV_LENGTH + 16);

  // 3. Decrypt the file content using AES-GCM
  const decipher = crypto.createDecipheriv(ALGORITHM, fileKey, iv);
  decipher.setAuthTag(authTag);

  let decryptedData = decipher.update(encryptedData);
  decryptedData = Buffer.concat([decryptedData, decipher.final()]);

  return decryptedData;
}

/**
 * Reveals the symmetric key used for encryption (for arbitration or testing).
 * 
 * @param keyEnvelope - The stringified encrypted key envelope.
 * @param buyerPrivateKey - The buyer's private key.
 * @returns The symmetric key as a hex string.
 */
export async function revealKey(
  keyEnvelope: string,
  buyerPrivateKey: string
): Promise<string> {
  const encryptedKeyObject = EthCrypto.cipher.parse(keyEnvelope);
  const fileKeyHex = await EthCrypto.decryptWithPrivateKey(
    buyerPrivateKey,
    encryptedKeyObject
  );
  return fileKeyHex;
}
