// Content script for X.com following page
// Handles scanning and extracting account information from the following list
//
// ⚠️ X.com UI Dependency Notice:
// This script relies on X.com's DOM structure. If X updates their UI, these selectors may need updating:
// - Profile links: a[href^="/"][role="link"] matching /[handle] pattern
// - User cells: [data-testid="UserCell"] (most stable, check this first)
// - Display names: span elements with font-weight: 700
// - Avatars: img[src*="profile_images"]
// See extractAccountsFromDOM() function (line ~109) for selector logic

(function() {
  'use strict';

  let isScanning = false;
  let scanTimeout = null;
  const SCROLL_DELAY = 1000; // ms between scrolls
  const SCAN_TIMEOUT = 60000; // 60 seconds total timeout
  const SCROLL_AMOUNT = 1000; // pixels to scroll

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_SCAN') {
      startScan(message.maxAccounts);
      sendResponse({ success: true });
    }
    return true;
  });

  // Start scanning the following list
  async function startScan(maxAccounts) {
    if (isScanning) {
      console.log('Scan already in progress');
      return;
    }

    isScanning = true;
    console.log('Starting FollowSweep scan...', { maxAccounts });

    // Set overall timeout
    scanTimeout = setTimeout(() => {
      if (isScanning) {
        console.log('Scan timeout reached');
        completeScan('Timeout reached');
      }
    }, SCAN_TIMEOUT);

    try {
      await performScan(maxAccounts);
    } catch (error) {
      console.error('Scan error:', error);
      sendError(error.message);
      isScanning = false;
      clearTimeout(scanTimeout);
    }
  }

  // Perform the actual scanning
  async function performScan(maxAccounts) {
    const collectedAccounts = new Map(); // Use Map to dedupe by handle
    let scrollAttempts = 0;
    let noNewAccountsCount = 0;
    const MAX_NO_NEW_ACCOUNTS = 3; // Stop if no new accounts after 3 scrolls

    while (isScanning && collectedAccounts.size < maxAccounts) {
      // Extract accounts from current view
      const accounts = extractAccountsFromDOM();

      let newAccountsFound = 0;
      for (const account of accounts) {
        if (!collectedAccounts.has(account.handle)) {
          collectedAccounts.set(account.handle, account);
          newAccountsFound++;
        }
      }

      console.log(`Scroll ${scrollAttempts + 1}: Found ${newAccountsFound} new accounts (Total: ${collectedAccounts.size})`);

      // Send progress update
      sendProgress(collectedAccounts.size, maxAccounts);

      // Check if we found new accounts
      if (newAccountsFound === 0) {
        noNewAccountsCount++;
        if (noNewAccountsCount >= MAX_NO_NEW_ACCOUNTS) {
          console.log('No new accounts found after multiple scrolls, stopping');
          break;
        }
      } else {
        noNewAccountsCount = 0;
      }

      // Check if we've reached the limit
      if (collectedAccounts.size >= maxAccounts) {
        console.log('Reached max accounts limit');
        break;
      }

      // Scroll to load more
      await scrollToLoadMore();
      scrollAttempts++;

      // Wait for content to load
      await sleep(SCROLL_DELAY);

      // Safety check: stop if too many scroll attempts
      if (scrollAttempts > 100) {
        console.log('Too many scroll attempts, stopping');
        break;
      }
    }

    completeScan(null, Array.from(collectedAccounts.values()));
  }

  // Extract account information from DOM
  function extractAccountsFromDOM() {
    const accounts = [];

    // X.com uses a feed structure with user cells
    // We need to find all user cell containers in the following list

    // Strategy 1: Find all links that match profile URL pattern
    // Profile links follow pattern: /handle (not /handle/following, /handle/followers, etc.)
    const profileLinks = document.querySelectorAll('a[href^="/"][role="link"]');

    const seenHandles = new Set();

    for (const link of profileLinks) {
      const href = link.getAttribute('href');

      // Match pattern: /handle (single segment, no trailing paths)
      // Exclude: /home, /explore, /notifications, /messages, /i/, etc.
      const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
      if (!match) continue;

      const handle = match[1];

      // Exclude system paths
      const systemPaths = ['home', 'explore', 'notifications', 'messages', 'compose', 'i', 'settings'];
      if (systemPaths.includes(handle.toLowerCase())) continue;

      // Skip if already seen
      if (seenHandles.has(handle)) continue;

      // Find the containing user cell (usually a few parents up)
      const userCell = findUserCell(link);
      if (!userCell) continue;

      // Extract account information
      const account = extractAccountInfo(userCell, handle);
      if (account) {
        accounts.push(account);
        seenHandles.add(handle);
      }
    }

    // Strategy 2: Look for elements with data-testid="UserCell"
    const userCells = document.querySelectorAll('[data-testid="UserCell"]');
    for (const cell of userCells) {
      const account = extractAccountFromUserCell(cell);
      if (account && !seenHandles.has(account.handle)) {
        accounts.push(account);
        seenHandles.add(account.handle);
      }
    }

    console.log(`Extracted ${accounts.length} accounts from DOM`);
    return accounts;
  }

  // Find user cell container
  function findUserCell(element) {
    let current = element;
    let depth = 0;
    const maxDepth = 10;

    while (current && depth < maxDepth) {
      // Look for indicators of a user cell
      // Usually has role="button" or contains multiple text elements
      if (current.getAttribute('data-testid') === 'UserCell') {
        return current;
      }

      // Check if this looks like a cell container (has multiple children, reasonable height)
      if (current.children && current.children.length > 2) {
        const style = window.getComputedStyle(current);
        const height = parseInt(style.height);
        if (height > 50 && height < 500) {
          return current;
        }
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  }

  // Extract account info from user cell
  function extractAccountInfo(cell, handle) {
    try {
      // Find display name (usually in a span with specific styling)
      let name = '';
      const nameElements = cell.querySelectorAll('span');
      for (const span of nameElements) {
        const text = span.textContent.trim();
        // Display name is usually longer and doesn't start with @
        if (text && !text.startsWith('@') && text.length > 0 && text !== handle) {
          const style = window.getComputedStyle(span);
          // Display names often have bold font-weight
          if (style.fontWeight === '700' || style.fontWeight === 'bold') {
            name = text;
            break;
          }
        }
      }

      // Find avatar image
      let avatar = '';
      const images = cell.querySelectorAll('img');
      for (const img of images) {
        const src = img.src;
        // Avatar images usually contain 'profile_images' in URL
        if (src && (src.includes('profile_images') || src.includes('pbs.twimg.com'))) {
          avatar = src;
          break;
        }
      }

      // Find bio (usually in a div with specific structure)
      let bio = '';
      const bioElements = cell.querySelectorAll('div[dir="auto"]');
      for (const div of bioElements) {
        const text = div.textContent.trim();
        // Bio is usually longer text that's not the name or handle
        if (text && text !== name && !text.includes('@' + handle) && text.length > 20) {
          bio = text;
          break;
        }
      }

      return {
        handle,
        name: name || handle,
        avatar,
        bio,
        profileUrl: `https://x.com/${handle}`
      };
    } catch (error) {
      console.error('Error extracting account info:', error);
      return null;
    }
  }

  // Extract account from UserCell with data-testid
  function extractAccountFromUserCell(cell) {
    try {
      // Find profile link
      const profileLink = cell.querySelector('a[href^="/"][role="link"]');
      if (!profileLink) return null;

      const href = profileLink.getAttribute('href');
      const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
      if (!match) return null;

      const handle = match[1];

      return extractAccountInfo(cell, handle);
    } catch (error) {
      console.error('Error extracting from UserCell:', error);
      return null;
    }
  }

  // Scroll to load more content
  async function scrollToLoadMore() {
    // Scroll the main timeline/feed container
    // X.com uses a primary column structure

    // Try multiple scroll strategies
    // Strategy 1: Scroll window
    window.scrollBy(0, SCROLL_AMOUNT);

    // Strategy 2: Find and scroll the main timeline container
    const timeline = document.querySelector('[aria-label*="Timeline"]');
    if (timeline) {
      timeline.scrollTop += SCROLL_AMOUNT;
    }

    // Strategy 3: Find scrollable divs
    const scrollables = document.querySelectorAll('div[style*="overflow"]');
    for (const el of scrollables) {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop += SCROLL_AMOUNT;
      }
    }
  }

  // Send progress update to popup
  function sendProgress(current, total) {
    chrome.runtime.sendMessage({
      type: 'SCAN_PROGRESS',
      data: { current, total }
    }).catch(err => console.log('Could not send progress:', err));
  }

  // Send error to popup
  function sendError(message) {
    chrome.runtime.sendMessage({
      type: 'SCAN_ERROR',
      data: { message }
    }).catch(err => console.log('Could not send error:', err));

    isScanning = false;
    clearTimeout(scanTimeout);
  }

  // Complete the scan
  function completeScan(error, accounts = []) {
    isScanning = false;
    clearTimeout(scanTimeout);

    if (error) {
      sendError(error);
      return;
    }

    console.log('Scan complete:', accounts.length, 'accounts');

    chrome.runtime.sendMessage({
      type: 'SCAN_COMPLETE',
      data: {
        accounts,
        count: accounts.length
      }
    }).catch(err => console.log('Could not send completion:', err));
  }

  // Helper: sleep function
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('FollowSweep content script (following page) loaded');
})();
