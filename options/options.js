/**
 * Thunderbird Vericode - Settings page logic
 */

// Default regex patterns
const DEFAULT_REGEX_PATTERNS = [
	{ pattern: "\\b[0-9]{6}\\b", priority: 1 }, // 6-digit number (most common)
	{ pattern: "\\b[0-9]{4}\\b", priority: 2 }, // 4-digit number
	{ pattern: "\\b[0-9]{8}\\b", priority: 3 }, // 8-digit number
	{ pattern: "\\b[0-9]{5}\\b", priority: 4 }, // 5-digit number
	{ pattern: "\\b[0-9]{7}\\b", priority: 5 }, // 7-digit number
];

// Default keywords
const DEFAULT_KEYWORDS = [
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

// Default settings
const DEFAULT_SETTINGS = {
	enabled: true,
	autoCopy: false,
	notificationTimeout: 15000,
	regexItems: [...DEFAULT_REGEX_PATTERNS],
	keywords: DEFAULT_KEYWORDS.join(", "),
};

// Form elements
const form = document.getElementById("options-form");
const enabledCheckbox = document.getElementById("enabled");
const autoCopyCheckbox = document.getElementById("autoCopy");
const notificationTimeoutInput = document.getElementById("notificationTimeout");
const regexList = document.getElementById("regexList");
const addRegexButton = document.getElementById("addRegex");
const keywordsInput = document.getElementById("keywords");
const statusMessage = document.getElementById("status-message");
const restoreDefaultsButton = document.getElementById("restore-defaults");

// Test area elements
const testInput = document.getElementById("test-input");
const testButton = document.getElementById("test-button");
const testResults = document.getElementById("test-results");
const noResult = document.getElementById("no-result");
const foundCode = document.getElementById("found-code");
const noCodeFound = document.getElementById("no-code-found");
const codeValue = document.getElementById("code-value");
const matchedRegex = document.getElementById("matched-regex");
const matchedKeywords = document.getElementById("matched-keywords");

// Load settings
function loadOptions() {
	browser.storage.local
		.get(DEFAULT_SETTINGS)
		.then((result) => {
			enabledCheckbox.checked = result.enabled;
			autoCopyCheckbox.checked = result.autoCopy;
			notificationTimeoutInput.value = result.notificationTimeout;
			keywordsInput.value = result.keywords;

			// Populate regex list
			populateRegexList(result.regexItems || DEFAULT_REGEX_PATTERNS);
		})
		.catch((error) => {
			showStatus("Error loading settings: " + error.message, "error");
		});
}

// Populate regex list
function populateRegexList(items) {
	regexList.innerHTML = "";

	if (items && items.length > 0) {
		items.forEach((item) => {
			const regexItem = createRegexItem(item.pattern, item.priority);
			regexList.appendChild(regexItem);
		});
	}
}

// Create regex item element
function createRegexItem(pattern, priority) {
	// Create container div
	const regexItem = document.createElement("div");
	regexItem.className = "regex-item";

	// Create pattern input
	const patternInput = document.createElement("input");
	patternInput.type = "text";
	patternInput.className = "regex-pattern";
	patternInput.placeholder = "Regular expression pattern";
	patternInput.value = pattern;

	// Create priority input
	const priorityInput = document.createElement("input");
	priorityInput.type = "number";
	priorityInput.className = "regex-priority";
	priorityInput.min = "1";
	priorityInput.placeholder = "Priority";
	priorityInput.value = priority;

	// Create delete button
	const deleteButton = document.createElement("button");
	deleteButton.type = "button";
	deleteButton.className = "delete-button";
	deleteButton.textContent = "Delete";
	deleteButton.addEventListener("click", () => {
		regexItem.remove();
	});

	// Append elements to container
	regexItem.appendChild(patternInput);
	regexItem.appendChild(priorityInput);
	regexItem.appendChild(deleteButton);

	return regexItem;
}

// Add new regex item
function addRegexItem() {
	const newItem = createRegexItem("", regexList.children.length + 1);
	regexList.appendChild(newItem);
}

// Collect all regex items
function collectRegexItems() {
	const items = [];

	const itemElements = regexList.querySelectorAll(".regex-item");
	itemElements.forEach((item) => {
		const pattern = item.querySelector(".regex-pattern").value.trim();
		const priority = parseInt(item.querySelector(".regex-priority").value, 10);

		if (pattern && !isNaN(priority)) {
			items.push({ pattern, priority });
		}
	});

	return items;
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

	// Collect regex items
	const regexItems = collectRegexItems();

	// Save settings
	browser.storage.local
		.set({
			enabled: enabledCheckbox.checked,
			autoCopy: autoCopyCheckbox.checked,
			notificationTimeout: timeout,
			regexItems: regexItems,
			keywords: keywordsInput.value,
		})
		.then(() => {
			showStatus("Settings saved", "success");
			console.log("Saved settings");
		})
		.catch((error) => {
			showStatus("Error saving settings: " + error.message, "error");
		});
}

// Restore default settings
function restoreDefaults() {
	// Update form with default values
	enabledCheckbox.checked = DEFAULT_SETTINGS.enabled;
	autoCopyCheckbox.checked = DEFAULT_SETTINGS.autoCopy;
	notificationTimeoutInput.value = DEFAULT_SETTINGS.notificationTimeout;
	keywordsInput.value = DEFAULT_SETTINGS.keywords;

	// Reset regex list
	populateRegexList(DEFAULT_REGEX_PATTERNS);

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

// Test verification code detection
function testVerificationCode() {
	const text = testInput.value.trim();

	if (!text) {
		showTestResult("empty");
		return;
	}

	// Get current regex patterns and keywords from form
	const regexItems = collectRegexItems();
	const keywordsText = keywordsInput.value;
	const keywordsList = keywordsText
		.split(",")
		.map((k) => k.trim())
		.filter((k) => k);

	// Check if we have at least one regex pattern
	if (regexItems.length === 0) {
		showStatus("请先添加至少一个正则表达式模式", "error");
		return;
	}

	// Check if we have keywords
	if (keywordsList.length === 0) {
		showStatus("请先添加关键词", "error");
		return;
	}

	// Sort regex patterns by priority
	const sortedRegexItems = [...regexItems].sort(
		(a, b) => a.priority - b.priority
	);

	// Check for keywords
	const foundKeywords = [];
	for (const keyword of keywordsList) {
		if (keyword && text.toLowerCase().includes(keyword.toLowerCase())) {
			foundKeywords.push(keyword);
		}
	}

	// Need at least 2 keywords to trigger detection
	if (foundKeywords.length < 2) {
		showTestResult("no-code", { keywords: foundKeywords });
		return;
	}

	// Try to match verification code using regex patterns
	let foundVerificationCode = null;
	let matchedPattern = null;

	for (const item of sortedRegexItems) {
		try {
			const regex = new RegExp(item.pattern, "gim");
			const matches = text.match(regex);

			if (matches && matches.length > 0) {
				foundVerificationCode = matches[0];
				matchedPattern = item.pattern;
				break;
			}
		} catch (error) {
			console.error(`Invalid regex pattern: ${item.pattern}`, error);
		}
	}

	if (foundVerificationCode) {
		showTestResult("found", {
			code: foundVerificationCode,
			pattern: matchedPattern,
			keywords: foundKeywords,
		});
	} else {
		showTestResult("no-code", { keywords: foundKeywords });
	}
}

// Show test result
function showTestResult(result, data = {}) {
	// Hide all result elements
	noResult.style.display = "none";
	foundCode.style.display = "none";
	noCodeFound.style.display = "none";

	switch (result) {
		case "empty":
			noResult.textContent = "Please paste the text to test";
			noResult.style.display = "block";
			break;

		case "found":
			codeValue.textContent = data.code;
			matchedRegex.textContent = data.pattern;
			matchedKeywords.textContent = data.keywords.join(", ");
			foundCode.style.display = "block";
			break;

		case "no-code":
			if (data.keywords && data.keywords.length > 0) {
				noCodeFound.textContent = `Found ${
					data.keywords.length
				} keywords (${data.keywords.join(
					", "
				)}), but no verification code. Please check your regex patterns.`;
			} else {
				noCodeFound.textContent =
					"No enough keywords (at least 2). Please check your keywords settings.";
			}
			noCodeFound.style.display = "block";
			break;

		default:
			noResult.textContent = "No test yet";
			noResult.style.display = "block";
	}
}

// Event listeners
document.addEventListener("DOMContentLoaded", loadOptions);
form.addEventListener("submit", saveOptions);
restoreDefaultsButton.addEventListener("click", restoreDefaults);
addRegexButton.addEventListener("click", addRegexItem);
testButton.addEventListener("click", testVerificationCode);
