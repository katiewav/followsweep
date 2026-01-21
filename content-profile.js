// Content script for X.com profile pages
// Provides visual guidance for unfollowing but NEVER automatically clicks confirm
//
// ⚠️ X.com UI Dependency Notice:
// This script finds the "Following" button to guide users. If X updates their UI, update these selectors:
// - Following button: button[aria-label*="Following"] (most reliable - accessibility label)
// - Alternative: [data-testid*="unfollow"] (check X DevTools if button not found)
// - Fallback: Button text matching "Following" or "Siguiendo" (Spanish)
// See findFollowingButton() function (line ~49) for selector logic
//
// 🔒 Safety: This script NEVER clicks the final unfollow confirmation button

(function() {
  'use strict';

  let guidanceOverlay = null;
  let isGuiding = false;

  // Check if this profile is marked for unfollow
  async function checkUnfollowStatus() {
    const handle = extractHandleFromURL();
    if (!handle) return;

    try {
      const data = await chrome.storage.local.get(['accounts']);
      const accounts = data.accounts || [];

      const account = accounts.find(a => a.handle === handle);
      if (account && account.status === 'unfollow_requested') {
        console.log('Account marked for unfollow:', handle);
        setTimeout(() => showGuidance(handle), 1000);
      }
    } catch (error) {
      console.error('Error checking unfollow status:', error);
    }
  }

  // Extract handle from current URL
  function extractHandleFromURL() {
    const url = window.location.href;
    // Match: x.com/handle or twitter.com/handle (not /following, /followers, etc.)
    const match = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)(?:\/|$|\?)/);
    return match ? match[1] : null;
  }

  // Show guidance overlay
  function showGuidance(handle) {
    if (isGuiding) return;
    isGuiding = true;

    // Find the Following button
    const followingButton = findFollowingButton();

    if (!followingButton) {
      console.warn('Could not find Following button');
      showManualInstructions(handle);
      return;
    }

    // Highlight the button
    highlightButton(followingButton);

    // Create guidance overlay
    createGuidanceOverlay(handle, followingButton);

    // Optional: Auto-click to open the menu (but NOT the confirm button)
    // Uncomment if you want to automatically open the unfollow menu
    // setTimeout(() => followingButton.click(), 500);
  }

  // Find the Following button on profile page
  function findFollowingButton() {
    // Strategy 1: Look for button with aria-label containing "Following"
    const buttons = document.querySelectorAll('button[aria-label*="Following"]');
    for (const btn of buttons) {
      const label = btn.getAttribute('aria-label');
      if (label && label.includes('Following')) {
        return btn;
      }
    }

    // Strategy 2: Look for button with data-testid (X sometimes uses this)
    const testIdButton = document.querySelector('[data-testid*="unfollow"]');
    if (testIdButton) return testIdButton;

    // Strategy 3: Look for button containing "Following" text
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = btn.textContent.trim();
      if (text === 'Following' || text === 'Siguiendo') { // English and Spanish
        return btn;
      }
    }

    return null;
  }

  // Highlight the button with animation
  function highlightButton(button) {
    // Add highlight styles
    const originalTransition = button.style.transition;
    const originalBoxShadow = button.style.boxShadow;

    button.style.transition = 'all 0.3s ease';
    button.style.boxShadow = '0 0 0 4px rgba(244, 33, 46, 0.5)';

    // Pulse animation
    let pulseCount = 0;
    const pulseInterval = setInterval(() => {
      if (pulseCount % 2 === 0) {
        button.style.boxShadow = '0 0 0 4px rgba(244, 33, 46, 0.5)';
      } else {
        button.style.boxShadow = '0 0 0 8px rgba(244, 33, 46, 0.3)';
      }
      pulseCount++;

      if (pulseCount >= 6) {
        clearInterval(pulseInterval);
        button.style.transition = originalTransition;
        button.style.boxShadow = originalBoxShadow;
      }
    }, 500);
  }

  // Create guidance overlay
  function createGuidanceOverlay(handle, followingButton) {
    // Create overlay container
    guidanceOverlay = document.createElement('div');
    guidanceOverlay.id = 'followsweep-guidance-overlay';
    guidanceOverlay.innerHTML = `
      <div class="followsweep-overlay-content">
        <div class="followsweep-header">
          <h2>FollowSweep: Unfollow Guidance</h2>
        </div>
        <div class="followsweep-body">
          <p><strong>@${handle}</strong> is marked for unfollow.</p>
          <ol>
            <li>Click the <strong>Following</strong> button (highlighted above)</li>
            <li>Click <strong>Unfollow @${handle}</strong> in the menu</li>
            <li>The extension will NOT automatically confirm - you must click manually</li>
          </ol>
          <div class="followsweep-warning">
            ⚠️ <strong>Human-in-the-loop:</strong> You must manually confirm the unfollow action.
          </div>
        </div>
        <div class="followsweep-actions">
          <button id="followsweep-auto-open" class="followsweep-btn followsweep-btn-primary">
            Open Unfollow Menu
          </button>
          <button id="followsweep-dismiss" class="followsweep-btn followsweep-btn-secondary">
            Dismiss
          </button>
        </div>
      </div>
    `;

    // Add styles
    addGuidanceStyles();

    // Add to page
    document.body.appendChild(guidanceOverlay);

    // Setup button handlers
    const autoOpenBtn = document.getElementById('followsweep-auto-open');
    const dismissBtn = document.getElementById('followsweep-dismiss');

    autoOpenBtn.addEventListener('click', () => {
      followingButton.click();
      // Keep overlay visible to remind user to confirm manually
      autoOpenBtn.textContent = 'Menu Opened - Confirm Manually';
      autoOpenBtn.disabled = true;
    });

    dismissBtn.addEventListener('click', () => {
      removeGuidanceOverlay();
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (guidanceOverlay && guidanceOverlay.parentNode) {
        removeGuidanceOverlay();
      }
    }, 30000);
  }

  // Show manual instructions if button not found
  function showManualInstructions(handle) {
    guidanceOverlay = document.createElement('div');
    guidanceOverlay.id = 'followsweep-guidance-overlay';
    guidanceOverlay.innerHTML = `
      <div class="followsweep-overlay-content">
        <div class="followsweep-header">
          <h2>FollowSweep: Manual Unfollow</h2>
        </div>
        <div class="followsweep-body">
          <p><strong>@${handle}</strong> is marked for unfollow.</p>
          <p>Please manually unfollow this account:</p>
          <ol>
            <li>Find the "Following" button on this profile</li>
            <li>Click it to open the menu</li>
            <li>Click "Unfollow @${handle}"</li>
            <li>Confirm the action</li>
          </ol>
        </div>
        <div class="followsweep-actions">
          <button id="followsweep-dismiss" class="followsweep-btn followsweep-btn-secondary">
            Dismiss
          </button>
        </div>
      </div>
    `;

    addGuidanceStyles();
    document.body.appendChild(guidanceOverlay);

    const dismissBtn = document.getElementById('followsweep-dismiss');
    dismissBtn.addEventListener('click', () => {
      removeGuidanceOverlay();
    });

    setTimeout(() => {
      if (guidanceOverlay && guidanceOverlay.parentNode) {
        removeGuidanceOverlay();
      }
    }, 30000);
  }

  // Add CSS styles for guidance overlay
  function addGuidanceStyles() {
    if (document.getElementById('followsweep-styles')) return;

    const style = document.createElement('style');
    style.id = 'followsweep-styles';
    style.textContent = `
      #followsweep-guidance-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        width: 400px;
        max-width: calc(100vw - 40px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: followsweep-slide-in 0.3s ease;
      }

      @keyframes followsweep-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .followsweep-overlay-content {
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        border: 2px solid #1d9bf0;
      }

      .followsweep-header {
        background: #1d9bf0;
        color: white;
        padding: 16px;
      }

      .followsweep-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
      }

      .followsweep-body {
        padding: 16px;
        color: #0f1419;
      }

      .followsweep-body p {
        margin: 0 0 12px 0;
        line-height: 1.5;
      }

      .followsweep-body ol {
        margin: 12px 0;
        padding-left: 20px;
      }

      .followsweep-body li {
        margin: 8px 0;
        line-height: 1.5;
      }

      .followsweep-warning {
        margin-top: 12px;
        padding: 12px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        font-size: 13px;
      }

      .followsweep-actions {
        padding: 16px;
        background: #f7f9f9;
        display: flex;
        gap: 8px;
      }

      .followsweep-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .followsweep-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .followsweep-btn-primary {
        background: #1d9bf0;
        color: white;
      }

      .followsweep-btn-primary:hover:not(:disabled) {
        background: #1a8cd8;
      }

      .followsweep-btn-secondary {
        background: #eff3f4;
        color: #0f1419;
      }

      .followsweep-btn-secondary:hover:not(:disabled) {
        background: #d7dbdc;
      }
    `;

    document.head.appendChild(style);
  }

  // Remove guidance overlay
  function removeGuidanceOverlay() {
    if (guidanceOverlay && guidanceOverlay.parentNode) {
      guidanceOverlay.parentNode.removeChild(guidanceOverlay);
      guidanceOverlay = null;
      isGuiding = false;
    }
  }

  // Initialize
  function init() {
    // Check on page load
    checkUnfollowStatus();

    // Listen for URL changes (SPA navigation)
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        removeGuidanceOverlay();
        setTimeout(checkUnfollowStatus, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Listen for storage changes (in case status updated from another tab)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.accounts) {
        checkUnfollowStatus();
      }
    });
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('FollowSweep content script (profile page) loaded');
})();
