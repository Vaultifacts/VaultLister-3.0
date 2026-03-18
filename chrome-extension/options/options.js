// VaultLister Extension — Options Page

const LOCAL_URL = 'http://localhost:3000/api';
const PROD_URL = 'https://vaultlister.com/api';

const radioLocal = document.getElementById('radio-local');
const radioProd = document.getElementById('radio-prod');
const optionLocal = document.getElementById('option-local');
const optionProd = document.getElementById('option-prod');
const saveBtn = document.getElementById('save-btn');
const toast = document.getElementById('toast');

let toastTimer = null;

function setSelected(value) {
    const isLocal = value === LOCAL_URL || value === '';
    radioLocal.checked = isLocal;
    radioProd.checked = !isLocal;
    optionLocal.classList.toggle('selected', isLocal);
    optionProd.classList.toggle('selected', !isLocal);
}

function showToast(message, type = 'success') {
    if (toastTimer) {
        clearTimeout(toastTimer);
    }
    toast.textContent = message;
    toast.className = 'toast visible ' + type;
    toastTimer = setTimeout(() => {
        toast.className = 'toast';
    }, 2500);
}

async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['api_base_url']);
        setSelected(result.api_base_url || LOCAL_URL);
    } catch {
        setSelected(LOCAL_URL);
    }
}

async function saveSettings() {
    const selected = document.querySelector('input[name="api_target"]:checked');
    if (!selected) return;

    try {
        await chrome.storage.local.set({ api_base_url: selected.value });
        showToast('Settings saved', 'success');
    } catch {
        showToast('Failed to save — try again', 'error');
    }
}

// Update selected highlight when radio changes via keyboard or click
document.querySelectorAll('input[name="api_target"]').forEach(radio => {
    radio.addEventListener('change', () => setSelected(radio.value));
});

saveBtn.addEventListener('click', saveSettings);

loadSettings();
