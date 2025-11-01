// Crypto utilities using Web Crypto API (AES-GCM + PBKDF2)

const CryptoUtil = (() => {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  function getRandomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function toBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
  }

  function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveKeyFromPassword(password, saltB64) {
    const salt = saltB64 ? fromBase64(saltB64) : getRandomBytes(16);
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 150000,
        hash: "SHA-256",
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    return { key: aesKey, saltB64: toBase64(salt) };
  }

  async function encryptText(plaintext, key) {
    const iv = getRandomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      textEncoder.encode(plaintext)
    );
    return { ivB64: toBase64(iv), cipherB64: toBase64(new Uint8Array(ciphertext)) };
  }

  async function decryptText(cipherB64, ivB64, key) {
    const iv = fromBase64(ivB64);
    const data = fromBase64(cipherB64);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return textDecoder.decode(plaintext);
  }

  return {
    deriveKeyFromPassword,
    encryptText,
    decryptText,
  };
})();


