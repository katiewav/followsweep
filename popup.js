// State management
let accounts = [];
let currentIndex = 0;
let filteredAccounts = [];
let filterQuery = '';

// DOM elements
const scanBtn = document.getElementById('scanBtn');
const scanStatus = document.getElementById('scanStatus');
const scanProgress = document.getElementById('scanProgress');
const scanProgressBar = document.getElementById('scanProgressBar');
const maxAccountsInput = document.getElementById('maxAccounts');

const statTotal = document.getElementById('statTotal');
const statReviewed = document.getElementById('statReviewed');
const statKept = document.getElementById('statKept');
const statUnfollow = document.getElementById('statUnfollow');

const searchInput = document.getElementById('searchInput');
const accountCard = document.getElementById('accountCard');
const noAccountsMessage = document.getElementById('noAccountsMessage');
const completedMessage = document.getElementById('completedMessage');
const reviewControls = document.getElementById('reviewControls');

const accountAvatar = document.getElementById('accountAvatar');
const accountName = document.getElementById('accountName');
const accountHandle = document.getElementById('accountHandle');
const accountBio = document.getElementById('accountBio');
const accountProgress = document.getElementById('accountProgress');

const backBtn = document.getElementById('backBtn');
const skipBtn = document.getElementById('skipBtn');
const keepBtn = document.getElementById('keepBtn');
const unfollowBtn = document.getElementById('unfollowBtn');

const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

// Initialize
async function init() {
  await loadAccounts();
  updateUI();
  setupEventListeners();
}

// Load accounts from storage
async function loadAccounts() {
  const data = await chrome.storage.local.get(['accounts', 'currentIndex']);
  accounts = data.accounts || [];
  currentIndex = data.currentIndex || 0;

  // Ensure currentIndex is valid
  if (currentIndex >= accounts.length) {
    currentIndex = 0;
  }

  applyFilter();
}

// Save accounts to storage
async function saveAccounts() {
  await chrome.storage.local.set({ accounts, currentIndex });
}

// Apply search filter
function applyFilter() {
  if (!filterQuery) {
    filteredAccounts = accounts;
  } else {
    const query = filterQuery.toLowerCase();
    filteredAccounts = accounts.filter(acc =>
      acc.handle.toLowerCase().includes(query) ||
      (acc.name && acc.name.toLowerCase().includes(query))
    );
  }

  // Find current account in filtered list
  if (filteredAccounts.length > 0 && currentIndex < accounts.length) {
    const currentAccount = accounts[currentIndex];
    const filteredIndex = filteredAccounts.findIndex(a => a.handle === currentAccount.handle);
    if (filteredIndex === -1 && filteredAccounts.length > 0) {
      // Current account not in filtered list, move to first filtered account
      const firstFiltered = filteredAccounts[0];
      currentIndex = accounts.findIndex(a => a.handle === firstFiltered.handle);
    }
  }
}

// Update UI
function updateUI() {
  updateStats();
  updateAccountCard();
}

// Update statistics
function updateStats() {
  statTotal.textContent = accounts.length;

  const reviewed = accounts.filter(a => a.status && a.status !== 'pending').length;
  statReviewed.textContent = reviewed;

  const kept = accounts.filter(a => a.status === 'kept').length;
  statKept.textContent = kept;

  const unfollowRequested = accounts.filter(a => a.status === 'unfollow_requested').length;
  statUnfollow.textContent = unfollowRequested;
}

// Update account card display
function updateAccountCard() {
  if (accounts.length === 0) {
    accountCard.classList.add('hidden');
    reviewControls.classList.add('hidden');
    noAccountsMessage.classList.remove('hidden');
    completedMessage.classList.add('hidden');
    return;
  }

  // Check if all reviewed
  const allReviewed = accounts.every(a => a.status && a.status !== 'pending');
  if (allReviewed) {
    accountCard.classList.add('hidden');
    reviewControls.classList.add('hidden');
    noAccountsMessage.classList.add('hidden');
    completedMessage.classList.remove('hidden');
    return;
  }

  // Find next pending account
  let nextIndex = currentIndex;
  for (let i = 0; i < accounts.length; i++) {
    const idx = (currentIndex + i) % accounts.length;
    if (!accounts[idx].status || accounts[idx].status === 'pending') {
      nextIndex = idx;
      break;
    }
  }
  currentIndex = nextIndex;

  const account = accounts[currentIndex];

  accountCard.classList.remove('hidden');
  reviewControls.classList.remove('hidden');
  noAccountsMessage.classList.add('hidden');
  completedMessage.classList.add('hidden');

  accountAvatar.src = account.avatar || '';
  accountAvatar.alt = account.name || account.handle;
  accountName.textContent = account.name || account.handle;
  accountHandle.textContent = '@' + account.handle;
  accountBio.textContent = account.bio || 'No bio available';
  accountProgress.textContent = `Account ${currentIndex + 1} of ${accounts.length}`;

  // Update button states
  backBtn.disabled = currentIndex === 0;
}

// Setup event listeners
function setupEventListeners() {
  scanBtn.addEventListener('click', handleScan);

  backBtn.addEventListener('click', () => handleDecision('back'));
  skipBtn.addEventListener('click', () => handleDecision('skip'));
  keepBtn.addEventListener('click', () => handleDecision('keep'));
  unfollowBtn.addEventListener('click', () => handleDecision('unfollow'));

  exportBtn.addEventListener('click', handleExport);
  clearBtn.addEventListener('click', handleClear);

  searchInput.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    applyFilter();
    updateUI();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch(e.key.toLowerCase()) {
      case 'k':
        if (!keepBtn.disabled) handleDecision('keep');
        break;
      case 'u':
        if (!unfollowBtn.disabled) handleDecision('unfollow');
        break;
      case 's':
        if (!skipBtn.disabled) handleDecision('skip');
        break;
      case 'b':
        if (!backBtn.disabled) handleDecision('back');
        break;
    }
  });

  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_PROGRESS') {
      handleScanProgress(message.data);
    } else if (message.type === 'SCAN_COMPLETE') {
      handleScanComplete(message.data);
    } else if (message.type === 'SCAN_ERROR') {
      handleScanError(message.data);
    }
  });
}

// Handle scan button click
async function handleScan() {
  const maxAccounts = parseInt(maxAccountsInput.value) || 200;

  // Check if we're on a following page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || (!tab.url.includes('x.com') && !tab.url.includes('twitter.com'))) {
    showStatus('Please navigate to x.com first', 'error');
    return;
  }

  if (!tab.url.includes('/following')) {
    showStatus('Please navigate to your Following page (x.com/[username]/following)', 'error');
    return;
  }

  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';
  showStatus('Starting scan...', '');
  scanProgress.classList.remove('hidden');
  scanProgressBar.style.width = '0%';

  // Send message to content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_SCAN',
      maxAccounts: maxAccounts
    });
  } catch (error) {
    showStatus('Error: Could not communicate with page. Try refreshing.', 'error');
    scanBtn.disabled = false;
    scanBtn.textContent = '🔍 Scan Following';
    scanProgress.classList.add('hidden');
  }
}

// Handle scan progress updates
function handleScanProgress(data) {
  const { current, total } = data;
  showStatus(`Scanning... Found ${current} accounts`, '');

  if (total > 0) {
    const percentage = (current / total) * 100;
    scanProgressBar.style.width = percentage + '%';
  }
}

// Handle scan completion
async function handleScanComplete(data) {
  const { accounts: scannedAccounts, count } = data;

  // Merge with existing accounts, avoiding duplicates
  const existingHandles = new Set(accounts.map(a => a.handle));
  const newAccounts = scannedAccounts.filter(a => !existingHandles.has(a.handle));

  accounts = [...accounts, ...newAccounts.map(a => ({
    ...a,
    status: 'pending',
    scannedAt: Date.now()
  }))];

  currentIndex = 0;
  await saveAccounts();

  showStatus(`✅ Scan complete! Found ${count} accounts (${newAccounts.length} new)`, 'success');
  scanBtn.disabled = false;
  scanBtn.textContent = '🔍 Scan Following';

  setTimeout(() => {
    scanProgress.classList.add('hidden');
  }, 2000);

  updateUI();
}

// Handle scan error
function handleScanError(data) {
  showStatus(`Error: ${data.message}`, 'error');
  scanBtn.disabled = false;
  scanBtn.textContent = '🔍 Scan Following';
  scanProgress.classList.add('hidden');
}

// Show status message
function showStatus(message, type) {
  scanStatus.textContent = message;
  scanStatus.className = 'status';
  if (type) scanStatus.classList.add(type);
  scanStatus.classList.remove('hidden');

  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      scanStatus.classList.add('hidden');
    }, 5000);
  }
}

// Handle review decisions
async function handleDecision(decision) {
  if (accounts.length === 0) return;

  const account = accounts[currentIndex];

  switch(decision) {
    case 'keep':
      account.status = 'kept';
      account.decidedAt = Date.now();
      currentIndex = Math.min(currentIndex + 1, accounts.length - 1);
      break;

    case 'unfollow':
      account.status = 'unfollow_requested';
      account.decidedAt = Date.now();

      // Open profile in new tab
      const profileUrl = `https://x.com/${account.handle}`;
      await chrome.tabs.create({ url: profileUrl });

      currentIndex = Math.min(currentIndex + 1, accounts.length - 1);
      break;

    case 'skip':
      currentIndex = Math.min(currentIndex + 1, accounts.length - 1);
      break;

    case 'back':
      if (currentIndex > 0) {
        currentIndex--;
        // Clear status of previous account if going back
        accounts[currentIndex].status = 'pending';
      }
      break;
  }

  await saveAccounts();
  updateUI();
}

// Handle export to CSV
function handleExport() {
  if (accounts.length === 0) {
    alert('No accounts to export');
    return;
  }

  const csv = [
    ['Handle', 'Name', 'Status', 'Profile URL', 'Decided At'].join(','),
    ...accounts.map(a => [
      a.handle,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      a.status || 'pending',
      `https://x.com/${a.handle}`,
      a.decidedAt ? new Date(a.decidedAt).toISOString() : ''
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `followsweep-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Handle clear all data
async function handleClear() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    return;
  }

  accounts = [];
  currentIndex = 0;
  filterQuery = '';
  searchInput.value = '';

  await chrome.storage.local.clear();
  updateUI();
}

// Initialize on load
init();
