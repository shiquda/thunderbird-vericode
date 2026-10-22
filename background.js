/**
 * Thunderbird Vericode - Verification code detection plugin
 * Listens for new emails, detects verification codes, and adds copy functionality to system notifications
 */

// Store settings
let settings = {
	notificationTimeout: 15000, // Notification display time (milliseconds)
	enabled: true,
	autoCopy: false,
	postCopyAction: "none",
	regexItems: [],
	keywords: "",
	excludedEmails: "",
	excludeRegex: "",
};

// Create verification code extractor instance
let verificationExtractor = new VerificationCodeExtractor();

// Only notifications created for copying have an entry here.
const pendingCopies = new Map();
let nextNotificationId = 0;

// Load settings
function loadSettings() {
	return browser.storage.local
		.get({
			notificationTimeout: 15000,
			enabled: true,
			autoCopy: false,
			postCopyAction: "none",
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

async function createCodeNotification(message, text, verificationCode = null) {
	const notificationId = `vericode-${Date.now()}-${nextNotificationId++}`;
	if (verificationCode !== null) {
		pendingCopies.set(notificationId, { message, verificationCode, processing: false });
	}
	try {
		await browser.notifications.create(notificationId, {
			type: "basic",
			title: await getName(message, verificationCode || "Thunderbird Vericode"),
			message: text,
			iconUrl: browser.runtime.getURL("icons/icon-64.svg"),
		});
	} catch (error) {
		pendingCopies.delete(notificationId);
		throw error;
	}
	if (settings.notificationTimeout > 0) {
		setTimeout(() => {
			pendingCopies.delete(notificationId);
			browser.notifications.clear(notificationId).catch(console.error);
		}, settings.notificationTimeout);
	}
	return notificationId;
}

// Move explicitly to Trash instead of using delete(), whose behavior depends
// on the account's deletion settings and may permanently delete a message.
async function processCopiedMessage(messageId, action) {
	if (action === "none") return;
	if (action === "archive") {
		await browser.messages.archive([messageId]);
		return;
	}
	if (action !== "trash") throw new Error("Unknown post-copy action");

	const message = await browser.messages.get(messageId);
	const accountId = message.folder?.accountId;
	if (!accountId) throw new Error("The message does not belong to a mail account");
	const account = await browser.accounts.get(accountId, true);
	const folders = [...(account.folders || account.rootFolder?.subFolders || [])];
	const trashFolders = [];
	while (folders.length) {
		const folder = folders.pop();
		if (folder.type === "trash" || folder.specialUse?.includes("trash")) {
			trashFolders.push(folder);
		}
		folders.push(...(folder.subFolders || []));
	}
	if (trashFolders.length !== 1) {
		throw new Error("The account does not have a unique Trash folder");
	}
	const trash = trashFolders[0];
	if (trash.path === message.folder.path) return;
	await browser.messages.move([messageId], trash.id || trash);
}

// Snapshot the chosen action before copying; settings changes during the
// clipboard operation must not turn an in-flight copy into a different action.
async function copyCodeAndProcessMessage(message, verificationCode) {
	let copied = false;
	try {
		// Read persisted settings rather than a possibly stale background cache.
		const { postCopyAction: action } = await browser.storage.local.get({ postCopyAction: "none" });
		await navigator.clipboard.writeText(verificationCode);
		copied = true;
		await processCopiedMessage(message.id, action);
		return true;
	} catch (error) {
		console.error("Failed to copy or process verification email:", error);
		const text = copied
			? "Code copied, but the email could not be processed. Check the email and your account settings."
			: "Could not copy the code. The email was not moved. Open the email to copy it manually.";
		await createCodeNotification(message, text);
		return false;
	}
}

async function handleNotificationClick(notificationId) {
	const pending = pendingCopies.get(notificationId);
	if (!pending || pending.processing) return;
	pending.processing = true;
	try {
		await copyCodeAndProcessMessage(pending.message, pending.verificationCode);
	} finally {
		pendingCopies.delete(notificationId);
		await browser.notifications.clear(notificationId);
	}
}

async function createNotificationWithCopyButton(message, verificationCode) {
	return createCodeNotification(message, `Verification code: ${verificationCode}.`, verificationCode);
}

async function autoCopyToClipboard(message, verificationCode) {
	if (await copyCodeAndProcessMessage(message, verificationCode)) {
		await createCodeNotification(message, `Wrote verification code to clipboard: ${verificationCode}`);
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
	browser.notifications.onClicked.addListener((notificationId) => {
		handleNotificationClick(notificationId).catch(console.error);
	});
	browser.notifications.onClosed.addListener((notificationId) => {
		pendingCopies.delete(notificationId);
	});
	browser.storage.onChanged.addListener((_, __) => {
		loadSettings();
	});

	console.log("Thunderbird Vericode plugin initialized");
}

// Start plugin
init().catch((error) => {
	console.error("Error initializing plugin:", error);
});
