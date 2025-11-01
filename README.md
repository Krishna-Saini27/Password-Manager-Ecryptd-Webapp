# My Password Manager (Client-Only)

A tiny, beginner-friendly password manager that runs entirely in your browser.

- Frontend only: HTML, CSS, JavaScript
- Storage: IndexedDB (encrypted entries)
- Crypto: Web Crypto API (PBKDF2 + AES-GCM)

How it works

1. On first run, you create a master password. A random salt is generated, and a small verification value (the word "ok") is encrypted and stored so we can verify the password later.
2. When you unlock, your password is used to derive an AES key (PBKDF2). We decrypt the verification value to confirm your password is correct.
3. Each saved password is encrypted with AES-GCM using your in-memory key and a fresh IV. The website and username are stored in plaintext for easier searching.

Notes

- There is no recovery if you forget your master password.
- Your data never leaves the device. Clearing browser storage will remove your vault.
- For simplicity, only the password field is encrypted. You can extend this to encrypt other fields too.

Getting Started

1. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
2. Create your master password (at least 8 chars).
3. Add entries. Click "Show Passwords" or per-row "Show" to reveal.



