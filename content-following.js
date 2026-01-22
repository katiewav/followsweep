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
    const seenHandles = new Set();

    // X.com uses a feed structure with user cells
    // ONLY extract from UserCell elements (the actual Following list items)
    // This prevents capturing @mentions from bios or "Followed by" chips

    // Primary Strategy: Look for elements with data-testid="UserCell"
    // This is the most reliable selector for actual Following list items
    const userCells = document.querySelectorAll('[data-testid="UserCell"]');

    for (const cell of userCells) {
      const account = extractAccountFromUserCell(cell);
      if (account && !seenHandles.has(account.handle)) {
        // Verify this is actually a Following list item by checking for presence
        // of profile link structure (not just mentions)
        if (isPrimaryAccountCell(cell, account.handle)) {
          accounts.push(account);
          seenHandles.add(account.handle);
        }
      }
    }

    // Fallback Strategy: If no UserCells found, look for user containers
    // in the timeline/feed structure (less common, but handles UI variations)
    if (accounts.length === 0) {
      const timelineItems = document.querySelectorAll('[data-testid="cellInnerDiv"]');
      for (const item of timelineItems) {
        const account = extractAccountFromTimelineItem(item);
        if (account && !seenHandles.has(account.handle)) {
          accounts.push(account);
          seenHandles.add(account.handle);
        }
      }
    }

    console.log(`Extracted ${accounts.length} accounts from DOM`);
    return accounts;
  }

  // Verify this is a primary account cell, not a mention or suggestion
  function isPrimaryAccountCell(cell, handle) {
    // Look for the primary profile link - should be one of the first links in the cell
    // and should point directly to /@handle
    const links = cell.querySelectorAll('a[href^="/"][role="link"]');

    if (links.length === 0) return false;

    // The first link in a UserCell is typically the primary profile link
    const primaryLink = links[0];
    const href = primaryLink.getAttribute('href');

    // Verify it matches our handle exactly
    const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
    if (!match || match[1] !== handle) {
      return false;
    }

    // Additional validation: check if this cell has user info structure
    // (avatar + name + handle, typical of Following list items)
    const hasAvatar = cell.querySelector('img[src*="profile_images"]') !== null;
    const hasName = cell.querySelector('span') !== null;

    return hasAvatar && hasName;
  }

  // Extract account from timeline item (fallback for different UI structures)
  function extractAccountFromTimelineItem(item) {
    try {
      // Find first profile link that matches pattern
      const profileLinks = item.querySelectorAll('a[href^="/"][role="link"]');

      for (const link of profileLinks) {
        const href = link.getAttribute('href');
        const match = href.match(/^\/([a-zA-Z0-9_]+)$/);

        if (match) {
          const handle = match[1];

          // Exclude system paths
          const systemPaths = ['home', 'explore', 'notifications', 'messages', 'compose', 'i', 'settings', 'search', 'hashtag'];
          if (systemPaths.includes(handle.toLowerCase())) continue;

          // This should be the primary profile link
          return extractAccountInfo(item, handle);
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting from timeline item:', error);
      return null;
    }
  }

  // Find user cell container
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
      // IMPORTANT: Exclude button labels and action text
      let bio = '';
      const bioElements = cell.querySelectorAll('div[dir="auto"]');
      for (const div of bioElements) {
        const text = div.textContent.trim();

        // Skip if text is empty or too short
        if (!text || text.length < 10) continue;

        // Skip if this is the name or handle
        if (text === name || text.includes('@' + handle)) continue;

        // CRITICAL: Skip if this div is inside a button or has button-related text
        // Check if this element or any parent is a button
        let isInsideButton = false;
        let current = div;
        for (let i = 0; i < 5; i++) {
          if (!current) break;
          if (current.tagName === 'BUTTON' || current.getAttribute('role') === 'button') {
            isInsideButton = true;
            break;
          }
          current = current.parentElement;
        }
        if (isInsideButton) continue;

        // CRITICAL: Filter out follow/unfollow button labels
        // These often contain phrases like "Following", "Unfollow", "Click to unfollow @user"
        if (/\b(following|unfollow|follow)\b/i.test(text)) continue;

        // CRITICAL: Filter out other common button/action text patterns
        if (/\b(click to|subscribed|verified|joined)\b/i.test(text)) continue;

        // Skip if text contains mostly symbols or looks like metadata
        if (/^[@#]/.test(text)) continue;

        // This looks like a valid bio - take it
        bio = text;
        break;
      }

      // Final defensive check: if bio somehow still contains follow-related text, clear it
      if (bio && /\b(following|unfollow|follow|click to)\b/i.test(bio)) {
        bio = '';
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
      // Find the PRIMARY profile link (first one that matches profile pattern)
      // This avoids capturing @mentions in bios which appear later in the DOM
      const profileLinks = cell.querySelectorAll('a[href^="/"][role="link"]');
      if (!profileLinks || profileLinks.length === 0) return null;

      // Find the first valid profile link that matches our pattern
      for (const link of profileLinks) {
        const href = link.getAttribute('href');

        // Match pattern: /handle (single segment, no trailing paths)
        const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
        if (!match) continue;

        const handle = match[1];

        // Exclude system paths and special URLs
        const systemPaths = ['home', 'explore', 'notifications', 'messages', 'compose', 'i', 'settings', 'search', 'hashtag', 'intent'];
        if (systemPaths.includes(handle.toLowerCase())) continue;

        // Check if this link is the primary profile link (has avatar nearby or is first link)
        // Primary profile links typically have the avatar image as a child or sibling
        const hasAvatarNearby = link.querySelector('img') ||
                                 link.parentElement?.querySelector('img') ||
                                 link.previousElementSibling?.querySelector('img');

        // If this is the first valid profile link OR it has an avatar, it's the primary one
        if (hasAvatarNearby || link === profileLinks[0]) {
          return extractAccountInfo(cell, handle);
        }
      }

      return null;
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
