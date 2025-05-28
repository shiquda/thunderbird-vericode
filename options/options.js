/**
 * Thunderbird Vericode - Settings page logic
 */

// Default settings
const DEFAULT_SETTINGS = {
	enabled: true,
	notificationTimeout: 15000,
};

// Form elements
const form = document.getElementById("options-form");
const enabledCheckbox = document.getElementById("enabled");
const notificationTimeoutInput = document.getElementById("notificationTimeout");
const statusMessage = document.getElementById("status-message");
const restoreDefaultsButton = document.getElementById("restore-defaults");

// Load settings
function loadOptions() {
	browser.storage.local
		.get(DEFAULT_SETTINGS)
		.then((result) => {
			enabledCheckbox.checked = result.enabled;
			notificationTimeoutInput.value = result.notificationTimeout;
		})
		.catch((error) => {
			showStatus("Error loading settings: " + error.message, "error");
		});
}

// Save settings
function saveOptions(e) {
	e.preventDefault();

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
