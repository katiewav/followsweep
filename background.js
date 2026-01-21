// Background service worker for FollowSweep
// Handles message routing and extension lifecycle events

// Initialize storage on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('FollowSweep installed');

    // Initialize storage with default values
    chrome.storage.local.set({
      accounts: [],
      currentIndex: 0,
      settings: {
        maxAccounts: 200,
        scanTimeout: 60000
      }
    });
  } else if (details.reason === 'update') {
    console.log('FollowSweep updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type, 'from', sender.tab?.id || 'popup');

  switch (message.type) {
    case 'SCAN_PROGRESS':
    case 'SCAN_COMPLETE':
    case 'SCAN_ERROR':
      // Forward scan messages from content script to popup
      // This ensures popup receives updates even if it wasn't the direct sender
      chrome.runtime.sendMessage(message).catch(err => {
        console.log('Could not forward message to popup:', err.message);
      });
      sendResponse({ success: true });
      break;

    default:
      console.log('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  // Return true to indicate async response
  return true;
});

// Handle tab updates (useful for detecting navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if user navigated to X.com
  if (changeInfo.status === 'complete' && tab.url) {
    const isXCom = tab.url.includes('x.com') || tab.url.includes('twitter.com');

    if (isXCom) {
      console.log('X.com page loaded:', tab.url);
    }
  }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    console.log('Storage changed:', Object.keys(changes));
  }
});

// Cleanup function for when extension is disabled/removed
chrome.runtime.onSuspend.addListener(() => {
  console.log('FollowSweep suspending');
});

console.log('FollowSweep background service worker initialized');
