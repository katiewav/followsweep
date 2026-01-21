# FollowSweep

A Chrome extension for X.com (Twitter) that helps you review and manage your following list with a strict **human-in-the-loop** approach.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://developer.chrome.com/docs/extensions/)

## What It Does

FollowSweep helps you systematically review accounts you follow on X.com by:

- 📋 **Scanning** your following list automatically (no API required)
- 👤 **Reviewing** accounts one-by-one with profile information
- ✅ **Deciding** to keep or unfollow each account
- 🎯 **Guiding** you to the unfollow button on profile pages
- 💾 **Exporting** your decisions as CSV

## What It Does NOT Do

**FollowSweep will NEVER automatically unfollow anyone.**

This extension provides guidance and organization but requires **you** to manually confirm every unfollow action on X.com. This is by design to ensure you maintain full control over your account.

## Features

- ✅ **Human-in-the-loop safety**: You must manually confirm all unfollows
- 🔍 **DOM-based scanning**: No X API, no credentials, no external servers
- 📊 **Progress tracking**: See total accounts, reviewed, kept, and unfollow requests
- ⌨️ **Keyboard shortcuts**: Quick review with K, U, S, B keys
- 🔎 **Search/filter**: Find accounts by handle or name
- 💾 **CSV export**: Download your decisions with timestamps
- 🔒 **Privacy-first**: All data stored locally on your device
- 🎨 **Clean interface**: Simple, X.com-themed design

## Installation

### From Source (Developer Mode)

1. **Download this repository**
   ```bash
   git clone https://github.com/yourusername/followsweep.git
   cd followsweep
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Or: Menu (⋮) → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `followsweep` folder
   - The FollowSweep icon should appear in your toolbar

5. **Pin the extension** (recommended)
   - Click the puzzle piece icon (🧩) in Chrome toolbar
   - Find "FollowSweep" and click the pin icon

## Usage

### Step 1: Scan Your Following List

1. Navigate to your X.com following page:
   ```
   https://x.com/[your-username]/following
   ```

2. Click the FollowSweep extension icon to open the popup

3. (Optional) Adjust "Max accounts" setting
   - Default: 200 accounts
   - Higher values take longer to scan

4. Click **"Scan Following"** button

5. Wait for the scan to complete
   - The extension will automatically scroll
   - Progress updates show in real-time
   - Scan stops when limit reached or timeout (60s)

### Step 2: Review Accounts

After scanning, accounts appear one-by-one in the popup:

**Using Buttons:**
- **Keep**: Mark account as kept, move to next
- **Unfollow**: Mark for unfollow, open profile in new tab
- **Skip**: Skip this account for now
- **Back**: Go to previous account

**Using Keyboard Shortcuts:**
- `K` = Keep
- `U` = Unfollow
- `S` = Skip
- `B` = Back

**Account Information Shown:**
- Profile picture
- Display name
- Handle (@username)
- Bio snippet
- Progress counter

### Step 3: Unfollow Accounts (Manual Confirmation Required)

When you click "Unfollow" on an account:

1. **Profile page opens** in a new tab
2. **Guidance overlay appears** highlighting the "Following" button
3. Click **"Open Unfollow Menu"** button in the overlay (or click "Following" manually)
4. **You must manually click** the "Unfollow" confirmation button on X.com
5. The extension will NOT automatically confirm the unfollow

**Important:** The final confirmation must be clicked by you. This ensures you maintain full control and prevents accidental mass unfollows.

### Step 4: Export Your Data

- Click **"Export CSV"** button in the popup
- CSV file downloads with columns:
  - Handle
  - Name
  - Status (kept/unfollow_requested/pending)
  - Profile URL
  - Decision timestamp

### Additional Features

**Search/Filter:**
- Type in the search box to filter accounts
- Searches handle and display name
- Results update in real-time

**Clear Data:**
- Click "Clear All Data" to reset the extension
- Warning: This cannot be undone
- All scan results and decisions will be deleted

**Statistics:**
- **Total**: Number of accounts scanned
- **Reviewed**: Accounts with decisions
- **Kept**: Accounts marked to keep
- **Unfollow**: Accounts marked for unfollow

## Privacy & Data Handling

### What Data Is Stored

FollowSweep stores the following data **locally on your device** using Chrome's `chrome.storage.local`:

- Account handles (usernames)
- Display names
- Profile picture URLs
- Bio snippets
- Your review decisions (kept/unfollow/pending)
- Timestamps of scans and decisions

### What Data Is NOT Collected

FollowSweep does **NOT**:
- ❌ Send any data to external servers
- ❌ Make API calls to X.com
- ❌ Access your X.com credentials or password
- ❌ Track your browsing activity
- ❌ Share data with third parties
- ❌ Use analytics or telemetry

### Permissions Explained

The extension requires these Chrome permissions:

- **`storage`**: Store account data and settings locally
- **`activeTab`**: Read content from the current X.com tab
- **`tabs`**: Open new tabs for profile pages

**Host permissions:**
- **`https://x.com/*`**: Access X.com pages
- **`https://twitter.com/*`**: Support for twitter.com redirects

All permissions are scoped **only** to x.com and twitter.com domains.

### Data Security

- All data remains on your device
- Data is cleared when you uninstall the extension
- You can manually clear data anytime via "Clear All Data" button
- No network requests are made to external services

## Limitations & Important Notes

### DOM Selector Dependency

FollowSweep uses DOM selectors to extract account information from X.com pages. These selectors target:
- Profile links (pattern: `/[handle]`)
- User cell containers (`[data-testid="UserCell"]`)
- Following buttons (`button[aria-label*="Following"]`)

**If X.com changes their UI structure, the extension may need updates.**

### Known Limitations

1. **Requires Manual Navigation**: You must navigate to your following page before scanning
2. **Rate Limits**: X.com may throttle if too much activity is detected (built-in delays help)
3. **UI Changes**: X.com updates may break selectors temporarily
4. **Scan Limits**: Practical limit of ~1,000-5,000 accounts per scan (configurable)
5. **No Sync**: Data doesn't sync across devices (intentional for privacy)
6. **No Undo**: Unfollowing on X.com is immediate; this extension doesn't change that

### Browser Compatibility

- ✅ **Chrome**: Fully supported (Manifest V3)
- ✅ **Edge**: Should work (Chromium-based)
- ❌ **Firefox**: Not supported (requires Manifest V3 adaptation)
- ❌ **Safari**: Not supported

## Troubleshooting

### "Scan Following" button is disabled
**Solution**: Make sure you're on the `/following` page (`x.com/[username]/following`)

### No accounts appearing after scan
**Solution**:
- Check that scan completed successfully (green success message)
- Try refreshing the page and scanning again
- Try a lower "Max accounts" value (50-100)

### Extension not loading
**Solution**:
- Ensure Developer Mode is enabled in `chrome://extensions/`
- Check for errors in the extension details
- Try reloading the extension (🔄 button)

### "Could not find Following button" error
**Solution**:
- X.com may have changed their UI
- Follow the manual unfollow instructions in the guidance overlay
- Check for extension updates

### Scan gets stuck or times out
**Solution**:
- Refresh the following page
- Try scanning fewer accounts at a time
- Check your internet connection

## Development

### File Structure

```
followsweep/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Service worker for message routing
├── popup.html                 # Extension popup UI
├── popup.css                  # Popup styling
├── popup.js                   # Popup logic and state management
├── content-following.js       # Following page scanner
├── content-profile.js         # Profile page guidance
├── icons/                     # Extension icons (16, 48, 128px)
├── LICENSE                    # MIT License
└── README.md                  # This file
```

### How It Works

**Scanning (content-following.js)**:
1. Listens for `START_SCAN` message from popup
2. Scrolls page automatically with 1-second throttle
3. Extracts accounts using multiple DOM selector strategies
4. Deduplicates by handle
5. Sends progress updates to popup
6. Returns complete list when done

**Review (popup.js)**:
1. Stores accounts in `chrome.storage.local`
2. Displays one account at a time
3. Records user decisions (keep/unfollow/skip)
4. Updates statistics in real-time

**Guidance (content-profile.js)**:
1. Checks if current profile marked for unfollow
2. Finds "Following" button via multiple selectors
3. Highlights button with pulsing animation
4. Shows guidance overlay with instructions
5. Optionally auto-opens unfollow menu
6. **Never** clicks the final confirmation button

### Updating DOM Selectors

If X.com changes their UI, you may need to update selectors:

**Following Page (content-following.js:106-170)**:
- Profile links: `a[href^="/"][role="link"]`
- User cells: `[data-testid="UserCell"]`
- Display names: `span` with `font-weight: 700`
- Avatars: `img[src*="profile_images"]`

**Profile Page (content-profile.js:49-80)**:
- Following button: `button[aria-label*="Following"]`
- Alternative: `[data-testid*="unfollow"]`
- Fallback: Button text matching "Following"

Look for elements with:
- `data-testid` attributes (most stable)
- `aria-label` attributes (accessibility)
- `role` attributes (semantic HTML)

### Building & Testing

1. Make changes to source files
2. Go to `chrome://extensions/`
3. Click reload (🔄) button for FollowSweep
4. Test on x.com following page
5. Check console for errors:
   - Popup: Right-click extension → Inspect popup
   - Content: Open DevTools on X.com page
   - Background: Click "Service worker" link in extension details

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Test your changes thoroughly on X.com
4. Ensure DOM selectors still work
5. Update documentation if needed
6. Submit a pull request

### Code Guidelines

- Keep the human-in-the-loop principle intact
- Never add automatic unfollow functionality
- Use semantic HTML and ARIA attributes for selectors
- Add comments explaining X-specific selectors
- Test on both x.com and twitter.com domains
- Maintain privacy-first approach (no external calls)

## FAQ

### Is this safe to use?
Yes. The extension only reads public information from X.com pages and stores it locally. It never accesses your password or makes automated API calls. You maintain full control over all unfollow actions.

### Will I get banned from X.com?
Unlikely. The extension uses built-in delays and doesn't automate any actions that violate X.com's Terms of Service. You manually confirm every unfollow, just like doing it normally.

### Can I review accounts I've already scanned?
Yes. Accounts remain in storage until you clear the data. You can search, filter, and go back to previous accounts.

### What happens if I close the popup mid-review?
Your progress is saved automatically. When you reopen the popup, you'll continue where you left off.

### Can I use this on mobile?
No. This is a Chrome extension for desktop browsers only.

### Does this work with Twitter.com?
Yes. The extension works on both x.com and twitter.com domains.

## Changelog

### Version 0.1.0 (Initial Release)
- Initial public release
- Following list scanner with auto-scroll
- One-by-one account review interface
- Human-in-the-loop unfollow guidance
- CSV export functionality
- Search/filter accounts
- Keyboard shortcuts (K, U, S, B)
- Local storage only, no external calls

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2026 FollowSweep Contributors

## Disclaimer

This extension is an independent tool and is not affiliated with, endorsed by, or associated with X Corp (Twitter). Use at your own discretion.

**Use Responsibly**: This tool helps you organize and review your following list. Always review accounts carefully before unfollowing. The extension creator is not responsible for your account management decisions.

---

**Built with privacy and user control in mind.**

For issues, feature requests, or questions, please open an issue on GitHub.
