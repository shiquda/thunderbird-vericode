/**
 * Thunderbird Vericode - Verification code detection plugin
 * Listens for new emails, detects verification codes, and adds copy functionality to system notifications
 */

// Default verification code regular expression
// Matches 4-8 digit numbers that appear near context words like code, verification, valid, etc.
const DEFAULT_VERIFICATION_REGEX =
	"(?:[Cc][Oo][Dd][Ee]|[Vv][Ee][Rr][Ii](?:[Ff][Ii][Cc][Aa][Tt][Ii][Oo][Nn])?|[Pp][Aa][Ss][Ss](?:[Ww][Oo][Rr][Dd])?|[Aa][Uu][Tt][Hh]|[Vv][Aa][Ll][Ii][Dd]|[Tt][Oo][Kk][Ee][Nn]|验证码|确认码|校验码|认证码)[^\\d]{0,30}?\\b([0-9]{4,8})\\b|\\b([0-9]{4,8})\\b[^\\d]{0,30}?(?:[Cc][Oo][Dd][Ee]|[Vv][Ee][Rr][Ii](?:[Ff][Ii][Cc][Aa][Tt][Ii][Oo][Nn])?|[Pp][Aa][Ss][Ss](?:[Ww][Oo][Rr][Dd])?|[Aa][Uu][Tt][Hh]|[Vv][Aa][Ll][Ii][Dd]|[Tt][Oo][Kk][Ee][Nn]|验证码|确认码|校验码|认证码)";

// Store settings
let settings = {
	verificationRegex: DEFAULT_VERIFICATION_REGEX,
	notificationTimeout: 10000, // Notification display time (milliseconds)
	enabled: true,
};

// Load settings
function loadSettings() {
	return browser.storage.local
		.get({
			verificationRegex: DEFAULT_VERIFICATION_REGEX,
			notificationTimeout: 10000,
			enabled: true,
		})
		.then((result) => {
			settings = result;
			console.log("Settings loaded:", settings);
			return settings;
		});
}

// Extract verification code from text
function extractVerificationCode(text) {
	if (!text) return null;

	try {
		const regex = new RegExp(settings.verificationRegex);
		const match = text.match(regex);
		if (!match) return null;

		// Return the first capturing group that has a value (either group 1 or 2)
		return match[1] || match[2] || match[0];
	} catch (error) {
		console.error("Regular expression error:", error);
		return null;
	}
}

// Check if email content contains verification code
async function checkMessageForVerificationCode(messageId) {
	try {
		// Get complete email content
		const messagePart = await browser.messages.getFull(messageId);

		// Get email subject and content
		const message = await browser.messages.get(messageId);
		const subject = message.subject || "";

		// Get email text content
		let textContent = "";

		// Get inline text parts
		try {
			const inlineTextParts = await browser.messages.listInlineTextParts(
				messageId
			);
			for (const part of inlineTextParts) {
				if (part.contentType === "text/plain") {
					textContent += part.content + " ";
				} else if (part.contentType === "text/html") {
					// Convert HTML to plain text
					const plainText = await browser.messengerUtilities.convertToPlainText(
						part.content
					);
					textContent += plainText + " ";
				}
			}
		} catch (error) {
			console.log(
				"Failed to get inline text parts, trying to extract content from messagePart",
				error
			);

			// If listInlineTextParts method is not supported, try to extract content from messagePart
			if (messagePart.body) {
				textContent += messagePart.body + " ";
			}

			// Recursively check all parts
			function extractTextFromParts(parts) {
				if (!parts) return;

				for (const part of parts) {
					if (
						part.body &&
						part.contentType &&
						part.contentType.startsWith("text/")
					) {
						textContent += part.body + " ";
					}
					if (part.parts) {
						extractTextFromParts(part.parts);
					}
				}
			}

			if (messagePart.parts) {
				extractTextFromParts(messagePart.parts);
			}
		}

		// Look for verification code in subject and content
		const combinedText = subject + " " + textContent;
		const verificationCode = extractVerificationCode(combinedText);

		return verificationCode;
	} catch (error) {
		console.error("Error checking email verification code:", error);
		return null;
	}
}

// Create notification with copy functionality
function createNotificationWithCopyButton(message, verificationCode) {
	const notificationId = "vericode-" + Date.now();

	// Create notification, prompting user to click to copy verification code
	browser.notifications.create(notificationId, {
		type: "basic",
		title: "Verification Code Found: " + verificationCode,
		message: `From: ${message.author}\nSubject: ${message.subject}\nClick this notification to copy the code`,
		iconUrl: browser.runtime.getURL("icons/icon-64.svg"),
	});

	// Listen for notification click event
	browser.notifications.onClicked.addListener(function onClicked(id) {
		if (id === notificationId) {
			// Copy verification code to clipboard
			copyToClipboard(verificationCode);

			// Show copied notification
			browser.notifications.create({
				type: "basic",
				title: "Code Copied",
				message: `Verification code ${verificationCode} has been copied to clipboard`,
				iconUrl: browser.runtime.getURL("icons/icon-64.svg"),
			});

			// Remove listener
			browser.notifications.onClicked.removeListener(onClicked);
		}
	});

	// Set notification to automatically close
	if (settings.notificationTimeout > 0) {
		setTimeout(() => {
			browser.notifications.clear(notificationId);
		}, settings.notificationTimeout);
	}
}

// Copy text to clipboard
function copyToClipboard(text) {
	// Due to WebExtension API limitations, we need to create a temporary input box to copy text
	const input = document.createElement("input");
	document.body.appendChild(input);
	input.value = text;
	input.select();
	document.execCommand("copy");
	document.body.removeChild(input);
}

// Handle new mail
async function handleNewMail(folder, messageList) {
	if (!settings.enabled) return;

	// Check each new email
	for (const message of messageList.messages) {
		const verificationCode = await checkMessageForVerificationCode(message.id);

		if (verificationCode) {
			console.log(
				`Found verification code in email ${message.id}: ${verificationCode}`
			);
			createNotificationWithCopyButton(message, verificationCode);

			// Only process the first verification code found
			break;
		}
	}
}

// Initialize
async function init() {
	// Load settings
	await loadSettings();

	// Listen for new mail events
	browser.messages.onNewMailReceived.addListener(handleNewMail);

	console.log("Thunderbird Vericode plugin initialized");
}

// Start plugin
init().catch((error) => {
	console.error("Error initializing plugin:", error);
});
