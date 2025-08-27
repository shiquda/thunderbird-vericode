/**
 * Thunderbird Vericode - Verification code detection plugin
 * Listens for new emails, detects verification codes, and adds copy functionality to system notifications
 */

// Store settings
let settings = {
	notificationTimeout: 15000, // Notification display time (milliseconds)
	enabled: true,
	autoCopy: false,
	regexItems: [],
	keywords: "",
	excludedEmails: "",
	excludeRegex: "",
};

// Create verification code extractor instance
let verificationExtractor = new VerificationCodeExtractor();

// Load settings
function loadSettings() {
	return browser.storage.local
		.get({
			notificationTimeout: 15000,
			enabled: true,
			autoCopy: false,
			regexItems: [],
			keywords: "",
			excludedEmails: "",
			excludeRegex: "",
		})
		.then((result) => {
			settings = result;
			console.log("Settings loaded:", settings);

			// Update verification extractor configuration
			verificationExtractor.updateConfig(settings);

			return settings;
		});
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

		// Check if message should be excluded
		const shouldExclude = await verificationExtractor.shouldExcludeMessage(message, combinedText);
		if (shouldExclude) {
			console.log("Message excluded based on exclusion rules");
			return null;
		}

		const verificationCode = verificationExtractor.extractVerificationCode(combinedText);

		return verificationCode;
	} catch (error) {
		console.error("Error checking email verification code:", error);
		return null;
	}
}

async function getName(message, verificationCode) {
	return browser.messengerUtilities
		.parseMailboxString(message.author)
		.then((parsedAddresses) => {
			if (parsedAddresses.length > 0) {
				return (
					parsedAddresses[0].name ||
					parsedAddresses[0].email ||
					verificationCode
				);
			}
			return verificationCode;
		});
}

// Create notification with copy functionality
async function createNotificationWithCopyButton(message, verificationCode) {
	const notificationId = "vericode-" + Date.now();

	// Create notification, prompting user to click to copy verification code
	browser.notifications.create(notificationId, {
		type: "basic",
		title: await getName(message, verificationCode),
		message: `Verification code: ${verificationCode}.`,
		iconUrl: browser.runtime.getURL("icons/icon-64.svg"),
	});

	browser.notifications.onClicked.addListener((notificationId) => {
		navigator.clipboard.writeText(verificationCode);
		browser.notifications.clear(notificationId);
	});

	// Set notification to automatically close
	if (settings.notificationTimeout > 0) {
		setTimeout(() => {
			browser.notifications.clear(notificationId);
		}, settings.notificationTimeout);
	}
}

async function autoCopyToClipboard(message, verificationCode) {
	try {
		await navigator.clipboard.writeText(verificationCode);
		console.log("Automatically wrote verification code to clipboard");
		const notificationId = "vericode-" + Date.now();

		// Create notification, prompting user to click to copy verification code
		browser.notifications.create(notificationId, {
			type: "basic",
			title: await getName(message, verificationCode),
			message: "Wrote Verification code to clipboard: " + verificationCode,
			iconUrl: browser.runtime.getURL("icons/icon-64.svg"),
		});

		// Set notification to automatically close
		if (settings.notificationTimeout > 0) {
			setTimeout(() => {
				browser.notifications.clear(notificationId);
			}, settings.notificationTimeout);
		}
	} catch (error) {
		console.log("Error saving clipboard: " + error.message);
	}
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
			if (settings.autoCopy) {
				await autoCopyToClipboard(message, verificationCode);
			} else {
				await createNotificationWithCopyButton(message, verificationCode);
			}

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
	browser.storage.onChanged.addListener((_, __) => {
		loadSettings();
	});

	console.log("Thunderbird Vericode plugin initialized");
}

// Start plugin
init().catch((error) => {
	console.error("Error initializing plugin:", error);
});
