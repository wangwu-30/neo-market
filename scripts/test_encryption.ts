import EthCrypto from 'eth-crypto';
import { encryptDelivery, decryptDelivery, revealKey } from './utils/encryption';
import crypto from 'crypto';

async function main() {
  console.log('--- Starting Encryption Test ---');

  // 1. Generate Mock Buyer Identity
  const buyerIdentity = EthCrypto.createIdentity();
  console.log('Buyer Public Key:', buyerIdentity.publicKey);
  console.log('Buyer Address:', buyerIdentity.address);

  // 2. Create Mock File
  const originalContent = 'This is a secret delivery for the Agent Market V0.5!';
  const fileBuffer = Buffer.from(originalContent, 'utf-8');
  console.log('Original Content:', originalContent);

  // 3. Encrypt Delivery
  console.log('\n--- Encrypting ---');
  const { encryptedFile, keyEnvelope } = await encryptDelivery(
    fileBuffer,
    buyerIdentity.publicKey
  );
  console.log('Encrypted File Size:', encryptedFile.length, 'bytes');
  console.log('Key Envelope:', keyEnvelope);

  // 4. Decrypt Delivery (Buyer Side)
  console.log('\n--- Decrypting ---');
  try {
    const decryptedBuffer = await decryptDelivery(
      encryptedFile,
      keyEnvelope,
      buyerIdentity.privateKey
    );
    const decryptedContent = decryptedBuffer.toString('utf-8');
    console.log('Decrypted Content:', decryptedContent);

    if (decryptedContent === originalContent) {
      console.log('✅ SUCCESS: Decrypted content matches original!');
    } else {
      console.error('❌ FAILURE: Content mismatch!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ FAILURE: Decryption threw an error:', error);
    process.exit(1);
  }

  // 5. Test Key Reveal (Arbitration)
  console.log('\n--- Testing Key Reveal ---');
  try {
    const revealedKeyHex = await revealKey(keyEnvelope, buyerIdentity.privateKey);
    console.log('Revealed Key (Hex):', revealedKeyHex);
    
    // Verify the key is valid (32 bytes = 64 hex chars)
    if (revealedKeyHex.length === 64) {
       console.log('✅ SUCCESS: Key revealed successfully and has correct length.');
    } else {
       console.error('❌ FAILURE: Revealed key has incorrect length.');
       process.exit(1);
    }
  } catch (error) {
    console.error('❌ FAILURE: Key reveal threw an error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
