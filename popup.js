// State management
let accounts = [];
let currentIndex = 0;
let filteredAccounts = [];
let filterQuery = '';

// DOM elements - will be initialized after DOM is ready
let scanBtn, scanStatus, scanProgress, scanProgressBar, maxAccountsInput;
let statTotal, statReviewed, statKept, statUnfollow;
let searchInput, searchDropdown, accountCard, noAccountsMessage, completedMessage, reviewControls;
let accountAvatar, accountName, accountHandle, accountBio, accountProgress, followsYouBadge;
let backBtn, skipBtn, keepBtn, unfollowBtn;
let exportBtn, clearBtn;

// Initialize DOM element references
function initDOMElements() {
  scanBtn = document.getElementById('scanBtn');
  scanStatus = document.getElementById('scanStatus');
  scanProgress = document.getElementById('scanProgress');
  scanProgressBar = document.getElementById('scanProgressBar');
  maxAccountsInput = document.getElementById('maxAccounts');

  statTotal = document.getElementById('statTotal');
  statReviewed = document.getElementById('statReviewed');
  statKept = document.getElementById('statKept');
  statUnfollow = document.getElementById('statUnfollow');

  searchInput = document.getElementById('searchInput');
  searchDropdown = document.getElementById('searchDropdown');
  accountCard = document.getElementById('accountCard');
  noAccountsMessage = document.getElementById('noAccountsMessage');
  completedMessage = document.getElementById('completedMessage');
  reviewControls = document.getElementById('reviewControls');

  accountAvatar = document.getElementById('accountAvatar');
  accountName = document.getElementById('accountName');
  accountHandle = document.getElementById('accountHandle');
  accountBio = document.getElementById('accountBio');
  accountProgress = document.getElementById('accountProgress');
  followsYouBadge = document.getElementById('followsYouBadge');

  backBtn = document.getElementById('backBtn');
  skipBtn = document.getElementById('skipBtn');
  keepBtn = document.getElementById('keepBtn');
  unfollowBtn = document.getElementById('unfollowBtn');

  exportBtn = document.getElementById('exportBtn');
  clearBtn = document.getElementById('clearBtn');
}

// Initialize
async function init() {
  initDOMElements();
  await loadAccounts();
  await updateUI();
  setupEventListeners();
}

// Load accounts from storage
async function loadAccounts() {
  const data = await chrome.storage.local.get(['accounts', 'currentIndex']);
  accounts = data.accounts || [];
  currentIndex = data.currentIndex || 0;

  console.log(`[FollowSweep Popup] Loaded from storage: ${accounts.length} accounts, currentIndex: ${currentIndex}`);

  // Ensure currentIndex is valid
  if (currentIndex >= accounts.length) {
    currentIndex = 0;
  }

  if (accounts.length > 0 && currentIndex < accounts.length) {
    const currentAccount = accounts[currentIndex];
    console.log(`[FollowSweep Popup] Current account: @${currentAccount.handle}, status: ${currentAccount.status || 'pending'}`);
  }
}

// Save accounts to storage
async function saveAccounts() {
  await chrome.storage.local.set({ accounts, currentIndex });
}

// Show search dropdown with matching accounts
function showSearchDropdown(query) {
  if (!searchDropdown) return;

  if (!query || query.trim() === '') {
    searchDropdown.classList.add('hidden');
    searchDropdown.innerHTML = '';
    return;
  }

  const queryLower = query.toLowerCase();
  const matches = accounts.filter(acc =>
    acc.handle.toLowerCase().includes(queryLower) ||
    (acc.name && acc.name.toLowerCase().includes(queryLower))
  );

  if (matches.length === 0) {
    searchDropdown.classList.add('hidden');
    searchDropdown.innerHTML = '';
    return;
  }

  // Limit to 10 results and deduplicate by handle
  const seenHandles = new Set();
  const uniqueMatches = matches.filter(acc => {
    if (seenHandles.has(acc.handle)) {
      return false;
    }
    seenHandles.add(acc.handle);
    return true;
  }).slice(0, 10);

  searchDropdown.innerHTML = uniqueMatches.map((acc) => {
    // Find the index when building the dropdown for stable reference
    const accountIndex = accounts.findIndex(a => a.handle === acc.handle);
    console.log(`[Search Dropdown] Searched: @${acc.handle}, Found index: ${accountIndex}, Account at that index: @${accounts[accountIndex]?.handle}`);
    return `
      <div class="search-dropdown-item" data-index="${accountIndex}" data-handle="${acc.handle}">
        <img src="${acc.avatar || 'default-avatar.png'}" alt="${acc.handle}">
        <div class="search-dropdown-item-info">
          <div class="search-dropdown-item-name">${acc.name || acc.handle}</div>
          <div class="search-dropdown-item-handle">@${acc.handle}</div>
        </div>
      </div>
    `;
  }).join('');

  searchDropdown.classList.remove('hidden');
}

// Update UI
async function updateUI() {
  updateStats();
  await updateAccountCard();
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
async function updateAccountCard() {
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

  // If current account is not pending, find the next pending account
  // This handles the case where popup reopens after a decision
  let indexChanged = false;
  if (accounts[currentIndex] && accounts[currentIndex].status && accounts[currentIndex].status !== 'pending') {
    console.log(`[FollowSweep Popup] Current account @${accounts[currentIndex].handle} has status: ${accounts[currentIndex].status}, finding next pending...`);

    // Current account has been reviewed, find next pending
    let found = false;
    for (let i = 1; i < accounts.length; i++) {
      const idx = (currentIndex + i) % accounts.length;
      if (!accounts[idx].status || accounts[idx].status === 'pending') {
        console.log(`[FollowSweep Popup] Found next pending account at index ${idx}: @${accounts[idx].handle}`);
        currentIndex = idx;
        indexChanged = true;
        found = true;
        break;
      }
    }

    // If no pending accounts found after current, check from beginning
    if (!found) {
      for (let i = 0; i < currentIndex; i++) {
        if (!accounts[i].status || accounts[i].status === 'pending') {
          console.log(`[FollowSweep Popup] Found pending account from start at index ${i}: @${accounts[i].handle}`);
          currentIndex = i;
          indexChanged = true;
          break;
        }
      }
    }

    if (!found && indexChanged === false) {
      console.log(`[FollowSweep Popup] No pending accounts found`);
    }
  } else {
    console.log(`[FollowSweep Popup] Current account at index ${currentIndex} is pending, showing it`);
  }

  // Save the updated index if it changed during the search
  if (indexChanged) {
    console.log(`[FollowSweep Popup] Saving updated currentIndex: ${currentIndex}`);
    await saveAccounts();
  }

  const account = accounts[currentIndex];

  accountCard.classList.remove('hidden');
  reviewControls.classList.remove('hidden');
  noAccountsMessage.classList.add('hidden');
  completedMessage.classList.add('hidden');

  accountAvatar.src = account.avatar || '';
  accountAvatar.alt = account.name || account.handle;
  accountName.textContent = account.name || account.handle;
  accountHandle.textContent = '@' + account.handle;
  accountBio.textContent = account.bio || '(No bio found)';
  accountProgress.textContent = `Account ${currentIndex + 1} of ${accounts.length}`;

  // Show/hide "Follows you" badge
  if (account.followsYou) {
    followsYouBadge.classList.remove('hidden');
  } else {
    followsYouBadge.classList.add('hidden');
  }

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

  // Click account card to open profile in new tab
  accountCard.addEventListener('click', () => {
    if (accounts.length > 0 && accounts[currentIndex]) {
      const account = accounts[currentIndex];
      const profileUrl = `https://x.com/${account.handle}`;
      chrome.tabs.create({ url: profileUrl });
    }
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    showSearchDropdown(query);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      if (searchDropdown) {
        searchDropdown.classList.add('hidden');
        searchDropdown.innerHTML = '';
      }
    }
  });

  searchInput.addEventListener('focus', (e) => {
    if (e.target.value) {
      showSearchDropdown(e.target.value);
    }
  });

  // Handle dropdown item clicks using event delegation
  searchDropdown.addEventListener('click', async (e) => {
    const dropdownItem = e.target.closest('.search-dropdown-item');
    if (dropdownItem) {
      e.stopPropagation(); // Prevent click-outside handler from firing
      const index = parseInt(dropdownItem.getAttribute('data-index'));
      const handle = dropdownItem.getAttribute('data-handle');

      console.log(`[Search Click] Clicked @${handle}, Using index: ${index}, Account at index: @${accounts[index]?.handle}`);

      if (index !== -1 && index < accounts.length) {
        currentIndex = index;
        searchInput.value = '';
        searchDropdown.classList.add('hidden');
        searchDropdown.innerHTML = '';
        await saveAccounts();
        await updateUI();
      } else {
        console.error(`Invalid account index: ${index}`);
      }
    }
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (searchDropdown && !searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.add('hidden');
    }
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

  await updateUI();
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
  console.log(`[FollowSweep Popup] Decision "${decision}" for @${account.handle} at index ${currentIndex}`);

  switch(decision) {
    case 'keep':
      account.status = 'kept';
      account.decidedAt = Date.now();
      currentIndex = Math.min(currentIndex + 1, accounts.length - 1);
      console.log(`[FollowSweep Popup] Marked as kept, moved to index ${currentIndex}`);
      break;

    case 'unfollow':
      account.status = 'unfollow_requested';
      account.decidedAt = Date.now();
      console.log(`[FollowSweep Popup] Marked as unfollow_requested`);

      currentIndex = Math.min(currentIndex + 1, accounts.length - 1);
      console.log(`[FollowSweep Popup] Moved to index ${currentIndex}`);

      // CRITICAL: Save BEFORE opening new tab, because popup will close immediately
      console.log(`[FollowSweep Popup] Saving before opening profile tab`);
      await saveAccounts();

      // Open profile in new tab (this will close the popup)
      const profileUrl = `https://x.com/${account.handle}`;
      await chrome.tabs.create({ url: profileUrl });
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

  console.log(`[FollowSweep Popup] Saving accounts with currentIndex: ${currentIndex}`);
  await saveAccounts();
  await updateUI();
  console.log(`[FollowSweep Popup] UI updated after decision`);
}

// Handle export to CSV
function handleExport() {
  if (accounts.length === 0) {
    alert('No accounts to export');
    return;
  }

  const csv = [
    ['Handle', 'Name', 'Follows You', 'Status', 'Profile URL', 'Decided At'].join(','),
    ...accounts.map(a => [
      a.handle,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      a.followsYou ? 'Yes' : 'No',
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
  await updateUI();
}

// Initialize on load - wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM is already ready
  init();
}
