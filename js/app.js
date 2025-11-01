// App logic: setup/unlock vault, add/list/show/delete entries

(function () {
  const setupSection = document.getElementById("setup-section");
  const unlockSection = document.getElementById("unlock-section");
  const vaultSection = document.getElementById("vault-section");

  const setupForm = document.getElementById("setup-form");
  const setupMaster = document.getElementById("setup-master");
  const setupConfirm = document.getElementById("setup-confirm");

  const unlockForm = document.getElementById("unlock-form");
  const unlockMaster = document.getElementById("unlock-master");
  const unlockError = document.getElementById("unlock-error");

  const addForm = document.getElementById("add-form");
  const siteInput = document.getElementById("site");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  const entriesBody = document.getElementById("entries-body");
  const toggleAllBtn = document.getElementById("toggle-all-btn");
  const lockBtn = document.getElementById("lock-btn");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const chooseFileBtn = document.getElementById("choose-file-btn");
  const saveFileBtn = document.getElementById("save-file-btn");
  const loadFileBtn = document.getElementById("load-file-btn");

  let masterKey = null; // CryptoKey (in-memory only)
  let showAllState = false;
  let vaultFileHandle = null; // FileSystemFileHandle (not persisted)

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  async function refreshEntries() {
    const entries = await DB.getAllEntries();
    entriesBody.innerHTML = "";
    for (const entry of entries) {
      const tr = document.createElement("tr");

      const tdSite = document.createElement("td");
      tdSite.textContent = entry.site;
      tr.appendChild(tdSite);

      const tdUser = document.createElement("td");
      tdUser.textContent = entry.username;
      tr.appendChild(tdUser);

      const tdPass = document.createElement("td");
      const passWrap = document.createElement("div");
      passWrap.className = "password-cell";
      const passTxt = document.createElement("span");
      passTxt.textContent = "••••••••";
      passTxt.dataset.state = "hidden";
      passTxt.classList.add("masked");
      passWrap.appendChild(passTxt);
      const showBtn = document.createElement("button");
      showBtn.type = "button";
      showBtn.className = "ghost";
      showBtn.textContent = "Show";
      showBtn.addEventListener("click", async () => {
        if (!masterKey) return;
        if (passTxt.dataset.state === "hidden") {
          try {
            const plain = await CryptoUtil.decryptText(entry.passwordCipher, entry.iv, masterKey);
            passTxt.textContent = plain;
            passTxt.dataset.state = "shown";
            passTxt.classList.remove("masked");
            showBtn.textContent = "Hide";
          } catch (e) {
            alert("Failed to decrypt. Try unlocking again.");
          }
        } else {
          passTxt.textContent = "••••••••";
          passTxt.dataset.state = "hidden";
          passTxt.classList.add("masked");
          showBtn.textContent = "Show";
        }
      });
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "ghost";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", async () => {
        if (!masterKey) return;
        try {
          const plain = await CryptoUtil.decryptText(entry.passwordCipher, entry.iv, masterKey);
          await navigator.clipboard.writeText(plain);
          copyBtn.textContent = "Copied";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
        } catch (e) {
          alert("Failed to decrypt. Try unlocking again.");
        }
      });
      passWrap.appendChild(showBtn);
      passWrap.appendChild(copyBtn);
      tdPass.appendChild(passWrap);
      tr.appendChild(tdPass);

      const tdActions = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (confirm("Delete this entry?")) {
          await DB.deleteEntry(entry.id);
          await refreshEntries();
        }
      });
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      entriesBody.appendChild(tr);
    }
  }

  function setLockedUI() {
    hide(vaultSection);
    hide(setupSection);
    show(unlockSection);
    unlockMaster.value = "";
    unlockMaster.focus();
    masterKey = null;
    showAllState = false;
    toggleAllBtn.dataset.state = "hidden";
    toggleAllBtn.textContent = "Show Passwords";
  }

  function setUnlockedUI() {
    hide(setupSection);
    hide(unlockSection);
    show(vaultSection);
    siteInput.focus();
  }

  async function init() {
    const salt = await DB.getSetting("salt");
    if (!salt) {
      hide(unlockSection);
      show(setupSection);
      return;
    }
    setLockedUI();
    await refreshEntries();
  }

  // Setup new vault
  setupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const passA = setupMaster.value.trim();
    const passB = setupConfirm.value.trim();
    if (passA.length < 8) {
      alert("Master password must be at least 8 characters.");
      return;
    }
    if (passA !== passB) {
      alert("Passwords do not match.");
      return;
    }
    const { key, saltB64 } = await CryptoUtil.deriveKeyFromPassword(passA);
    // Create a verification blob: encrypt constant text "ok"
    const ver = await CryptoUtil.encryptText("ok", key);
    await DB.setSetting("salt", saltB64);
    await DB.setSetting("ver", ver);
    setupMaster.value = "";
    setupConfirm.value = "";
    masterKey = key;
    setUnlockedUI();
    await refreshEntries();
  });

  // Unlock existing vault
  unlockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    unlockError.classList.add("hidden");
    const pass = unlockMaster.value;
    const salt = await DB.getSetting("salt");
    const ver = await DB.getSetting("ver");
    try {
      const { key } = await CryptoUtil.deriveKeyFromPassword(pass, salt);
      const txt = await CryptoUtil.decryptText(ver.cipherB64, ver.ivB64, key);
      if (txt !== "ok") throw new Error("bad");
      masterKey = key;
      unlockMaster.value = "";
      setUnlockedUI();
      await refreshEntries();
    } catch (err) {
      unlockError.classList.remove("hidden");
    }
  });

  // Lock
  lockBtn.addEventListener("click", () => {
    setLockedUI();
  });

  // Add entry
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!masterKey) return;
    const site = siteInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!site || !username || !password) return;
    const enc = await CryptoUtil.encryptText(password, masterKey);
    await DB.addEntry({ site, username, passwordCipher: enc.cipherB64, iv: enc.ivB64 });
    siteInput.value = "";
    usernameInput.value = "";
    passwordInput.value = "";
    await refreshEntries();
  });

  // Toggle all
  toggleAllBtn.addEventListener("click", async () => {
    if (!masterKey) return;
    showAllState = !showAllState;
    toggleAllBtn.dataset.state = showAllState ? "shown" : "hidden";
    toggleAllBtn.textContent = showAllState ? "Hide Passwords" : "Show Passwords";
    const rows = entriesBody.querySelectorAll("tr");
    for (const row of rows) {
      const passTxt = row.querySelector(".password-cell span");
      const toggleBtn = row.querySelector(".password-cell button.ghost");
      const site = row.children[0].textContent;
      const username = row.children[1].textContent;
      // We need the entry to decrypt; fetch all and map (simple approach)
    }
    // Re-render instead (simpler):
    await refreshEntries();
    if (showAllState) {
      // Reveal all after refresh
      const entries = await DB.getAllEntries();
      const trs = entriesBody.querySelectorAll("tr");
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const tr = trs[i];
        const passTxt = tr.querySelector(".password-cell span");
        const showBtn = tr.querySelector(".password-cell button.ghost");
        try {
          const plain = await CryptoUtil.decryptText(entry.passwordCipher, entry.iv, masterKey);
          passTxt.textContent = plain;
          passTxt.dataset.state = "shown";
          passTxt.classList.remove("masked");
          showBtn.textContent = "Hide";
        } catch (_) {
          // ignore
        }
      }
    }
  });

  // Export backup to .txt (JSON content)
  exportBtn.addEventListener("click", async () => {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "password-manager-backup.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Import backup from .txt (JSON content)
  importBtn.addEventListener("click", () => {
    importFile.click();
  });
  importFile.addEventListener("change", async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || !payload.settings || !payload.settings.salt || !payload.settings.ver) {
        alert("Invalid backup file.");
        return;
      }
      if (!confirm("Importing will replace current data. Continue?")) return;
      await DB.importAll(payload);
      // After import, require unlock again
      setLockedUI();
      await refreshEntries();
      alert("Import complete. Please unlock with the backup's master password.");
    } catch (e) {
      alert("Failed to import backup.");
    } finally {
      importFile.value = "";
    }
  });

  // File System Access API helpers (single vault file)
  const canUseFS = () => !!(window.showOpenFilePicker && window.showSaveFilePicker && window.FileSystemFileHandle);

  async function pickVaultFile() {
    if (!canUseFS()) {
      alert("Your browser doesn't support choosing a vault file. Use Export/Import instead.");
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "Password Vault", accept: { "text/plain": [".txt"], "application/json": [".json"] } }],
      });
      vaultFileHandle = handle;
      alert("Vault file selected. You can now Save/Load to the same file.");
    } catch (_) {}
  }

  async function saveToVaultFile() {
    if (!canUseFS()) {
      alert("Your browser doesn't support saving to a file. Use Export instead.");
      return;
    }
    try {
      if (!vaultFileHandle) {
        // If no file chosen yet, ask user to create/select one
        vaultFileHandle = await window.showSaveFilePicker({
          suggestedName: "password-manager-vault.txt",
          types: [{ description: "Password Vault", accept: { "text/plain": [".txt"], "application/json": [".json"] } }],
        });
      }
      const data = await DB.exportAll();
      const writable = await vaultFileHandle.createWritable();
      await writable.write(new Blob([JSON.stringify(data, null, 2)], { type: "text/plain" }));
      await writable.close();
      // no alert to keep quiet on auto-saves
    } catch (e) {
      alert("Failed to save to file.");
    }
  }

  async function loadFromVaultFile() {
    if (!canUseFS()) {
      alert("Your browser doesn't support loading from a file. Use Import instead.");
      return;
    }
    try {
      if (!vaultFileHandle) {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Password Vault", accept: { "text/plain": [".txt"], "application/json": [".json"] } }],
        });
        vaultFileHandle = handle;
      }
      const file = await vaultFileHandle.getFile();
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || !payload.settings || !payload.settings.salt || !payload.settings.ver) {
        alert("Invalid vault file.");
        return;
      }
      if (!confirm("Loading will replace current data. Continue?")) return;
      await DB.importAll(payload);
      setLockedUI();
      await refreshEntries();
      alert("Loaded vault. Please unlock with the vault's master password.");
    } catch (e) {
      alert("Failed to load from file.");
    }
  }

  chooseFileBtn.addEventListener("click", pickVaultFile);
  saveFileBtn.addEventListener("click", saveToVaultFile);
  loadFileBtn.addEventListener("click", loadFromVaultFile);

  // Auto-save to chosen vault file after add/delete
  const originalAdd = DB.addEntry;
  DB.addEntry = async function(entry) {
    const id = await originalAdd(entry);
    if (vaultFileHandle) await saveToVaultFile();
    return id;
  };
  const originalDelete = DB.deleteEntry;
  DB.deleteEntry = async function(id) {
    await originalDelete(id);
    if (vaultFileHandle) await saveToVaultFile();
  };

  // Initial
  init();
})();


