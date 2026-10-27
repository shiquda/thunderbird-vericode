# Thunderbird Vericode

A verification code detection plugin for Thunderbird that automatically detects verification codes in received emails and provides convenient copy functionality.

## Features

- **Automatic Detection**: Monitors incoming emails and uses intelligent algorithms to detect verification codes
- **Smart Context Analysis**: Uses both regular expressions and keyword context to accurately identify verification codes
- **System Notifications**: Displays system notifications when verification codes are detected
- **One-Click Copy**: Click notifications to copy verification codes to clipboard, or enable auto-copy
- **Highly Customizable**: Configure regex patterns, keywords, exclusion rules, and notification settings
- **Test Area**: Built-in testing area to validate your configuration before using
- **Privacy-Focused**: Runs entirely locally with no data transmission to external servers

## Installation

### From Source Code

1. Download or clone this repository to your local machine
2. Open Thunderbird
3. Click Menu -> Add-ons and Themes
4. Click the gear icon and select "Install Add-on From File..."
5. Browse to the root directory of this project and select the `manifest.json` file
6. Confirm the installation

### From Released Version

1. Go to the [releases page](https://github.com/shiquda/thunderbird-vericode/releases)
2. Download the latest `.xpi` file
3. Open Thunderbird
4. Click Menu -> Add-ons and Themes
5. Click the gear icon and select "Install Add-on From File..."
6. Select the downloaded `.xpi` file
7. Confirm the installation

## How to Use

### Basic Usage

1. After installing the plugin, it will automatically detect verification codes in received emails
2. When a verification code is detected, a system notification will appear with the sender name and the detected code
3. Click the notification to copy the verification code to your clipboard
4. You can then paste the verification code wherever needed

### Settings Configuration

1. Open Thunderbird
2. Click Menu -> Add-ons and Themes
3. Find the "Thunderbird Vericode" plugin
4. Click the "Options" button

Changes save automatically. Switches and selections apply immediately; text fields save after a short pause or when you leave the field. Check the status at the top of the page to confirm a change was saved. Invalid patterns or values stay in the editor without replacing the last saved version; other valid settings can still be changed.

Common controls appear first. Expand **Detection rules** or **Exclusions** to edit advanced settings. **Restore defaults** asks for confirmation before replacing your rules.

### Available Settings

#### Basic Settings
- **Detect verification codes**: Turn the plugin on/off.
- **Automatically copy codes**: Copy codes to the clipboard without clicking a notification.
- **Clear notifications after**: Time in seconds before the extension clears a notification (0 disables automatic clearing). The operating system controls on-screen banner duration.

#### After Copying a Code

Choose what happens **After copying a code**, separately from automatic copying:

- **Leave email unchanged** (default): Copy the code without moving the email.
- **Archive email**: Archive the email using Thunderbird's configured archive settings.
- **Move email to Trash**: Move the email to the Trash folder of its own account. This does not use the account's delete command or permanently delete the email.

The selected action runs only after a successful copy, whether you click a notification or enable automatic copying. A failed copy never moves the email. If the action fails, a notification explains the failure; the code remains copied and no delete fallback is attempted.

This feature requires the `messagesMove` permission. For server-backed accounts, archiving or moving to Trash may also synchronize the change to other devices. Configure an archive destination in Thunderbird before choosing Archive.

#### Detection Configuration
- **Regex patterns**: Define regular expressions to match verification codes
  - Default patterns match 4–8 digit numbers and 4–8 character codes containing both letters and digits
  - Mixed letter-digit codes need nearby verification context; pure-letter and grouped-digit codes are recognised only when an explicit delivery label is present
  - Each pattern has a priority (lower numbers = higher priority)
- **Verification keywords**: Words that help identify verification code context
  - Default includes: code, verif, login, authentication, password, 验证, 登录, 驗證碼, 登入, etc.
  - At least 2 different keyword matches are required, except a custom list containing only one keyword, or when the email carries an explicit delivery label such as `验证码：`
- **Test Area**: Paste sample email text to test your configuration

Saved keyword and regex lists are preserved. If you previously saved numeric-only patterns, add a mixed letter-digit pattern such as `\b(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{4,8}\b` to enable those codes. Add `authentication` and `password` to an older keyword list for one-time password emails.

#### Exclusion Rules
- **Excluded email addresses**: Skip detection from specific senders
  - Example: `noreply@bank.com, marketing@company.com`
- **Exclusion regex patterns**: Skip emails matching certain content patterns
  - Example: `.*promotional.*` to exclude promotional emails
  - One pattern per line

### Testing Your Configuration

1. In the settings page, open **Test your settings** below the configuration
2. Paste a sample email text containing a verification code
3. Click the "Test" button
4. The results will show:
   - Whether a code was detected
   - Which regex pattern matched
   - Which keywords were found
   - Any exclusion reasons

**Important**: The test area now uses the **exact same algorithm** as the actual detection, ensuring your tests accurately reflect real behavior.

## How Detection Works

The plugin uses a deterministic, explainable process:

1. **Keyword Detection**: Scans email subject and content for verification-related keywords, including Traditional Chinese forms
2. **Pattern Matching**: Applies regex patterns to find potential verification codes
3. **Delivery Evidence**: Grades each candidate by how it is presented, not only by distance:
   - an explicit label beside the value (`verification code is`, `OTP:`, `验证码：`, `您的登入驗證碼為`) outranks a merely closer unrelated number
   - a generic label (`code:`, `password:`, `token:`) is weak evidence and never bypasses address, phone, postal or amount exclusions
   - grouped digits (`123-456`) and pure-letter codes are only accepted under an explicit delivery label, and pure letters never displace an ordinary numeric code
4. **Candidate Filtering**: Rejects street-address, postal-code, phone-number, date, amount and account-suffix matches. A value inside a link is dropped only for that occurrence; if the same code also appears in the text, it is still found
5. **Context Requirement**: At least two different verification words are needed, except when the configured list has a single keyword, or when a clear delivery label is present
6. **Selection**: Prefers the strongest delivery evidence, then the closest verification word, then pattern priority
7. **Exclusion Filtering**: Applies sender and content-based exclusion rules

Every extraction can report which rule accepted the value (`extractWithEvidence`), so detection remains explainable rather than a black box.

## Privacy Statement

- This plugin runs locally only and does not send any data to external servers
- The plugin only reads email content for verification code detection and does not store or transmit your email content
- All settings are saved in local browser storage
- No telemetry or analytics are collected

## Development

### Building from Source

1. Clone this repository
2. Run `pnpm install` to install the dependencies
3. Run `pnpm run build` to pack the plugin into a `.xpi` file
4. Run `pnpm test` to check code detection against regression examples

### Architecture

The codebase uses a modular architecture:

- `lib/verification-core.js`: Shared verification logic used by all components
- `background.js`: Handles email monitoring and notifications
- `options/`: Settings UI and testing functionality
- `manifest.json`: Extension configuration

This ensures the testing area and actual detection use identical algorithms.

## Changelog

### Recent Improvements

- ✅ **Fixed regex case sensitivity bug**: Test area now matches production behavior exactly
- ✅ **Unified detection algorithm**: Single source of truth eliminates inconsistencies  
- ✅ **Enhanced testing**: Built-in test area validates configurations accurately
- ✅ **Improved exclusion rules**: Better sender and content filtering
- ✅ **Code optimization**: Reduced duplication and improved maintainability

## To Do

- [x] Add an option to enable automatically copy the code to clipboard
- [x] Refine the regex
- [x] Refine the notification interaction
- [x] Customize regex and keywords
- [x] Add exclusion rules
- [x] Add a CI to build the plugin to the release page when tag is created
- [x] Fix test area consistency with actual detection
- [ ] Verification/Activation URL support

## Troubleshooting

### Common Issues

1. **Codes not detected**: Use the test area to check keyword matches and patterns. Previously saved keyword and regex lists do not automatically pick up new defaults.
2. **Wrong codes detected**: Adjust regex patterns and priorities in settings
3. **Too many false positives**: Add exclusion rules or stricter regex patterns
4. **Test area shows different results**: This should no longer happen after recent fixes

### Getting Help

If you encounter issues:
1. Use the test area to validate your configuration
2. Check the browser console for error messages
3. [Open an issue](https://github.com/shiquda/thunderbird-vericode/issues) with sample email content (remove sensitive information)

## License

MIT

## Contributing

Issues and pull requests are welcome! When contributing:

1. Test your changes using the built-in test area
2. Ensure the same algorithm is used across all components
3. Include relevant test cases for new features
