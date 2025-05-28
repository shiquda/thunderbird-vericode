# Thunderbird Vericode

A verification code detection plugin for Thunderbird.

## Features

Monitors incoming emails and uses regular expressions to detect verification codes. When a code is found, it displays a system notification that you can click to copy the verification code to your clipboard.

## Installation

### From Source Code

1. Download or clone this repository to your local machine
2. Open Thunderbird
3. Click Menu -> Add-ons and Themes
4. Click the gear icon and select "Install Add-on From File..."
5. Browse to the root directory of this project and select the `manifest.json` file
6. Confirm the installation

### From Released Version

1. Go to the [releases page](https://github.com/yourusername/thunderbird-vericode/releases)
2. Download the latest `.xpi` file
3. Open Thunderbird
4. Click Menu -> Add-ons and Themes
5. Click the gear icon and select "Install Add-on From File..."
6. Select the downloaded `.xpi` file
7. Confirm the installation

## How to Use

1. After installing the plugin, it will automatically detect verification codes in received emails
2. When a verification code is detected, a system notification will appear with the email subject and the code
3. Click the notification to copy the verification code to your clipboard
4. You can then paste the verification code wherever needed

## Customizing Settings

1. Open Thunderbird
2. Click Menu -> Add-ons and Themes
3. Find the "Thunderbird Vericode" plugin
4. Click the "Options" button
5. In the settings page, you can:
   - Enable or disable verification code detection
   - Customize the regular expression pattern for verification codes
   - Set the notification display time
   - Click "Restore Defaults" to reset all settings to their default values

### Default Regular Expression

The default verification code detection is context-aware. It looks for 4-8 digit numbers that appear near context words like "code", "verification", "valid", "auth", "token", "验证码", etc.

This makes detection more accurate by only matching numbers that are likely to be verification codes based on surrounding text. You can modify this regular expression based on your needs.

If you prefer a simpler approach, you can use `\b[0-9]{4,8}\b` which matches any 4-8 digit numbers regardless of context.

## Privacy Statement

- This plugin runs locally only and does not send any data to external servers
- The plugin only reads email content for verification code detection and does not store or transmit your email content
- All settings are saved in local browser storage

## License

MIT

## Contributing

Issues and pull requests are welcome!
