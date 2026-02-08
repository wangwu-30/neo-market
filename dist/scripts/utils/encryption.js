"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptDelivery = encryptDelivery;
exports.decryptDelivery = decryptDelivery;
exports.revealKey = revealKey;
const eth_crypto_1 = __importDefault(require("eth-crypto"));
const crypto_1 = __importDefault(require("crypto"));
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
async function encryptDelivery(fileBuffer, buyerPublicKey) {
    // 1. Generate a random symmetric key (32 bytes for AES-256)
    const fileKey = crypto_1.default.randomBytes(32);
    // 2. Encrypt the file with the symmetric key using AES-GCM
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, fileKey, iv);
    let encryptedData = cipher.update(fileBuffer);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Combine IV + AuthTag + EncryptedData into a single buffer for storage
    // Format: [IV (12 bytes)] [AuthTag (16 bytes)] [EncryptedData (variable)]
    const encryptedFile = Buffer.concat([iv, authTag, encryptedData]);
    // 3. Encrypt the symmetric key with the buyer's public key (ECIES)
    // EthCrypto.encryptWithPublicKey returns an object { iv, ephemPublicKey, ciphertext, mac }
    // We need to stringify it to store/transmit easily as the "envelope"
    const encryptedKeyObject = await eth_crypto_1.default.encryptWithPublicKey(buyerPublicKey, fileKey.toString('hex') // key must be string for EthCrypto
    );
    const keyEnvelope = eth_crypto_1.default.cipher.stringify(encryptedKeyObject);
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
async function decryptDelivery(encryptedFile, keyEnvelope, buyerPrivateKey) {
    // 1. Decrypt the symmetric key from the envelope
    const encryptedKeyObject = eth_crypto_1.default.cipher.parse(keyEnvelope);
    const fileKeyHex = await eth_crypto_1.default.decryptWithPrivateKey(buyerPrivateKey, encryptedKeyObject);
    const fileKey = Buffer.from(fileKeyHex, 'hex');
    // 2. Parse the encrypted file buffer
    // Format: [IV (12 bytes)] [AuthTag (16 bytes)] [EncryptedData (variable)]
    const iv = encryptedFile.subarray(0, IV_LENGTH);
    const authTag = encryptedFile.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encryptedData = encryptedFile.subarray(IV_LENGTH + 16);
    // 3. Decrypt the file content using AES-GCM
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, fileKey, iv);
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
async function revealKey(keyEnvelope, buyerPrivateKey) {
    const encryptedKeyObject = eth_crypto_1.default.cipher.parse(keyEnvelope);
    const fileKeyHex = await eth_crypto_1.default.decryptWithPrivateKey(buyerPrivateKey, encryptedKeyObject);
    return fileKeyHex;
}
