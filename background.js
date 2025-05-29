/**
 * Thunderbird Vericode - Verification code detection plugin
 * Listens for new emails, detects verification codes, and adds copy functionality to system notifications
 */

// Verification keyword list - used to identify verification code context
const VERIFICATION_KEYWORDS = [
	// English keywords
	"code",
	"verif",
	"login",
	"validat",
	"authenticate",
	"authorization",
	"authorize",
	"one-time",
	"onetime",
	"one time",
	"two-factor",
	"two factor",
	// Chinese keywords
	"码",
	"验证",
	"校验",
	"认证",
	"动态",
	"登录",
	"口令",
	"授权",
	"动态密",
	"临时密",
	"一次性密",
	"双重验证",
	"两步验证",
];

// Verification code patterns - used to identify possible verification code formats
const CODE_PATTERNS = [
	{ regex: /\b[0-9]{6}\b/g, priority: 1 }, // 6-digit number (most common)
	{ regex: /\b[0-9]{4}\b/g, priority: 2 }, // 4-digit number
	{ regex: /\b[0-9]{8}\b/g, priority: 3 }, // 8-digit number
	// { regex: /\b(?=[a-zA-Z]*[0-9])[a-zA-Z0-9]{4,8}\b/g, priority: 4 }, // 4-8 character alphanumeric combination with at least 1 digit
	{ regex: /\b[0-9]{5}\b/g, priority: 5 }, // 5-digit number
	{ regex: /\b[0-9]{7}\b/g, priority: 6 }, // 7-digit number
];

// Store settings
let settings = {
	notificationTimeout: 15000, // Notification display time (milliseconds)
	enabled: true,
};

// Load settings
function loadSettings() {
	return browser.storage.local
		.get({
			notificationTimeout: 15000,
			enabled: true,
		})
		.then((result) => {
			settings = result;
			console.log("Settings loaded:", settings);
			return settings;
		});
}

// Enhanced verification code extraction function
function extractVerificationCode(text) {
	if (!text) return null;
	const textLower = text.toLowerCase();
	let candidates = [];

	// 1. Find positions of all keywords
	let keywordPositions = [];
	for (const keyword of VERIFICATION_KEYWORDS) {
		let keywordLower = keyword.toLowerCase();
		let pos = textLower.indexOf(keywordLower);
		while (pos !== -1) {
			keywordPositions.push({
				keyword: keyword,
				index: pos,
				length: keyword.length,
			});
			pos = textLower.indexOf(keywordLower, pos + 1);
		}
	}

	// Return null if fewer than two types of keywords are found
	const uniqueKeywords = new Set(keywordPositions.map((pos) => pos.keyword));
	if (uniqueKeywords.size < 2) return null;

	// 2. Find all possible verification codes
	for (const pattern of CODE_PATTERNS) {
		const matches = [...text.matchAll(pattern.regex)];
		for (const match of matches) {
			candidates.push({
				code: match[0],
				index: match.index,
				priority: pattern.priority,
				distance: Infinity, // Initialize distance as infinity
			});
		}
	}

	if (candidates.length === 0) {
		console.log("No possible verification codes found");
		return null; // No possible verification codes found
	}

	console.log(
		`Found ${candidates.length} possible verification code candidates`
	);

	console.log(`Found ${keywordPositions.length} keyword positions`);

	// Print the first three keywords
	console.log(
		"First three unique keywords:",
		[...new Set(keywordPositions.map((pos) => pos.keyword))].slice(0, 3)
	);

	// 3. Calculate the distance from each candidate code to the nearest keyword
	for (let candidate of candidates) {
		for (let keywordPos of keywordPositions) {
			// Calculate distance between verification code and keyword
			// If verification code is after the keyword
			if (candidate.index > keywordPos.index) {
				const distance =
					candidate.index - (keywordPos.index + keywordPos.length);
				candidate.distance = Math.min(candidate.distance, distance);
			}
			// If verification code is before the keyword
			else {
				const distance =
					keywordPos.index - (candidate.index + candidate.code.length);
				candidate.distance = Math.min(candidate.distance, distance);
			}
		}
	}

	// 4. Sort candidate codes by distance and priority
	candidates.sort((a, b) => {
		// Sort by distance first
		if (a.distance !== b.distance) {
			return a.distance - b.distance;
		}
		// Sort by priority when distances are equal
		return a.priority - b.priority;
	});

	// Log the top 3 candidates after sorting (if available)
	const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
	console.log(
		"Sorted verification code candidates (top 3):",
		topCandidates
			.map(
				(c) => `${c.code} (distance: ${c.distance}, priority: ${c.priority})`
			)
			.join(", ")
	);

	// 5. Return the best match
	console.log("Selected best verification code:", candidates[0].code);
	return candidates[0].code;
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
		title: verificationCode,
		message: `Verification code: ${verificationCode}.`,
		iconUrl: browser.runtime.getURL("icons/icon-64.svg"),
	});

	// Set notification to automatically close
	if (settings.notificationTimeout > 0) {
		setTimeout(() => {
			browser.notifications.clear(notificationId);
		}, settings.notificationTimeout);
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
