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

### Available Settings

#### Basic Settings
- **Enable verification code detection**: Turn the plugin on/off
- **Enable automatic copy**: Automatically copy codes to clipboard (no click required)
- **Notification display time**: How long notifications stay visible (0 = no auto-close)

#### Detection Configuration
- **Regex patterns**: Define regular expressions to match verification codes
  - Default patterns match 4-8 digit numbers
  - You can add custom patterns like `[A-Z0-9]{6}` for alphanumeric codes
  - Each pattern has a priority (lower numbers = higher priority)
- **Verification keywords**: Words that help identify verification code context
  - Default includes: code, verify, login, authenticate, 验证, 登录, etc.
  - At least 2 different keywords must be found in the same email
- **Test Area**: Paste sample email text to test your configuration

#### Exclusion Rules
- **Excluded email addresses**: Skip detection from specific senders
  - Example: `noreply@bank.com, marketing@company.com`
- **Exclusion regex patterns**: Skip emails matching certain content patterns
  - Example: `.*promotional.*` to exclude promotional emails
  - One pattern per line

### Testing Your Configuration

1. In the settings page, scroll down to the "Test Area"
2. Paste a sample email text containing a verification code
3. Click the "Test" button
4. The results will show:
   - Whether a code was detected
   - Which regex pattern matched
   - Which keywords were found
   - Any exclusion reasons

**Important**: The test area now uses the **exact same algorithm** as the actual detection, ensuring your tests accurately reflect real behavior.

## How Detection Works

The plugin uses a sophisticated multi-step process:

1. **Keyword Detection**: Scans email subject and content for verification-related keywords
2. **Context Requirement**: Requires at least 2 different keywords to reduce false positives
3. **Pattern Matching**: Applies regex patterns to find potential verification codes
4. **Distance Calculation**: Prefers codes that appear closer to relevant keywords
5. **Priority Sorting**: Uses pattern priorities to select the best match
6. **Exclusion Filtering**: Applies sender and content-based exclusion rules

This approach minimizes false positives while maintaining high accuracy.

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

1. **Codes not detected**: Check that your emails contain at least 2 verification keywords
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
