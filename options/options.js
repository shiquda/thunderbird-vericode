/**
 * Thunderbird Vericode - Settings page logic
 */

// Default verification code regular expression
// Matches 4-8 digit numbers that appear near context words like code, verification, valid, etc.
const DEFAULT_VERIFICATION_REGEX =
	"(?:[Cc][Oo][Dd][Ee]|[Vv][Ee][Rr][Ii](?:[Ff][Ii][Cc][Aa][Tt][Ii][Oo][Nn])?|[Pp][Aa][Ss][Ss](?:[Ww][Oo][Rr][Dd])?|[Aa][Uu][Tt][Hh]|[Vv][Aa][Ll][Ii][Dd]|[Tt][Oo][Kk][Ee][Nn]|验证码|确认码|校验码|认证码)[^\\d]{0,30}?\\b([0-9]{4,8})\\b|\\b([0-9]{4,8})\\b[^\\d]{0,30}?(?:[Cc][Oo][Dd][Ee]|[Vv][Ee][Rr][Ii](?:[Ff][Ii][Cc][Aa][Tt][Ii][Oo][Nn])?|[Pp][Aa][Ss][Ss](?:[Ww][Oo][Rr][Dd])?|[Aa][Uu][Tt][Hh]|[Vv][Aa][Ll][Ii][Dd]|[Tt][Oo][Kk][Ee][Nn]|验证码|确认码|校验码|认证码)";

// Default settings
const DEFAULT_SETTINGS = {
	enabled: true,
	verificationRegex: DEFAULT_VERIFICATION_REGEX,
	notificationTimeout: 10000,
};

// Form elements
const form = document.getElementById("options-form");
const enabledCheckbox = document.getElementById("enabled");
const verificationRegexInput = document.getElementById("verificationRegex");
const notificationTimeoutInput = document.getElementById("notificationTimeout");
const statusMessage = document.getElementById("status-message");
const restoreDefaultsButton = document.getElementById("restore-defaults");

// Load settings
function loadOptions() {
	browser.storage.local
		.get(DEFAULT_SETTINGS)
		.then((result) => {
			enabledCheckbox.checked = result.enabled;
			verificationRegexInput.value = result.verificationRegex;
			notificationTimeoutInput.value = result.notificationTimeout;
		})
		.catch((error) => {
			showStatus("Error loading settings: " + error.message, "error");
		});
}

// Save settings
function saveOptions(e) {
	e.preventDefault();

	// Validate regular expression
	try {
		new RegExp(verificationRegexInput.value);
	} catch (error) {
		showStatus("Invalid regular expression: " + error.message, "error");
		return;
	}

	// Validate timeout
	const timeout = parseInt(notificationTimeoutInput.value, 10);
	if (isNaN(timeout) || timeout < 0) {
		showStatus(
			"Notification display time must be a non-negative integer",
			"error"
		);
		return;
	}

	// Save settings
	browser.storage.local
		.set({
			enabled: enabledCheckbox.checked,
			verificationRegex: verificationRegexInput.value,
			notificationTimeout: timeout,
		})
		.then(() => {
			showStatus("Settings saved", "success");
		})
		.catch((error) => {
			showStatus("Error saving settings: " + error.message, "error");
		});
}

// Restore default settings
function restoreDefaults() {
	// Update form with default values
	enabledCheckbox.checked = DEFAULT_SETTINGS.enabled;
	verificationRegexInput.value = DEFAULT_SETTINGS.verificationRegex;
	notificationTimeoutInput.value = DEFAULT_SETTINGS.notificationTimeout;

	// Save default settings to storage
	browser.storage.local
		.set(DEFAULT_SETTINGS)
		.then(() => {
			showStatus("Default settings restored", "success");
		})
		.catch((error) => {
			showStatus("Error restoring default settings: " + error.message, "error");
		});
}

// Show status message
function showStatus(message, type) {
	statusMessage.textContent = message;
	statusMessage.className = "status " + type;
	statusMessage.style.display = "block";

	// Hide message after 5 seconds
	setTimeout(() => {
		statusMessage.style.display = "none";
	}, 5000);
}

// Initialize
document.addEventListener("DOMContentLoaded", loadOptions);
form.addEventListener("submit", saveOptions);
restoreDefaultsButton.addEventListener("click", restoreDefaults);
