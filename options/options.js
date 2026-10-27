/**
 * Thunderbird Vericode - Settings page logic
 */

// Get default patterns and keywords from the shared library
function getDefaults() {
	// Wait for the library to load
	if (typeof VerificationCodeExtractor === 'undefined') {
		// Fallback defaults
		return {
			regexPatterns: [
				{ pattern: "\\b[0-9]{6}\\b", priority: 1 },
				{ pattern: "\\b[0-9]{4}\\b", priority: 2 },
				{ pattern: "\\b[0-9]{8}\\b", priority: 3 },
				{ pattern: "\\b[0-9]{5}\\b", priority: 4 },
				{ pattern: "\\b[0-9]{7}\\b", priority: 5 }
			],
			keywords: "code,verif,login,validat,authenticate,authorization,authorize,one-time,onetime,one time,two-factor,two factor,码,验证,校验,认证,动态,登录,口令,授权,动态密,临时密,一次性密,双重验证,两步验证"
		};
	}
	
	// Use the library's defaults if available
	return {
		regexPatterns: DEFAULT_CODE_PATTERNS || [],
		keywords: DEFAULT_VERIFICATION_KEYWORDS ? DEFAULT_VERIFICATION_KEYWORDS.join(", ") : ""
	};
}

// Initialize defaults
const defaults = getDefaults();
const DEFAULT_REGEX_PATTERNS = defaults.regexPatterns;
const DEFAULT_KEYWORDS_STRING = defaults.keywords;

// Default settings
const DEFAULT_SETTINGS = {
	enabled: true,
	autoCopy: false,
	postCopyAction: "none",
	notificationTimeout: 15000,
	regexItems: [...DEFAULT_REGEX_PATTERNS],
	keywords: DEFAULT_KEYWORDS_STRING,
	excludedEmails: "",
	excludeRegex: "",
};

// Form elements
const form = document.getElementById("options-form");
const enabledCheckbox = document.getElementById("enabled");
const autoCopyCheckbox = document.getElementById("autoCopy");
const postCopyActionSelect = document.getElementById("postCopyAction");
const notificationTimeoutInput = document.getElementById("notificationTimeout");
const regexList = document.getElementById("regexList");
const addRegexButton = document.getElementById("addRegex");
const keywordsInput = document.getElementById("keywords");
const excludedEmailsInput = document.getElementById("excludedEmails");
const excludeRegexInput = document.getElementById("excludeRegex");
const statusMessage = document.getElementById("status-message");
const restoreDefaultsButton = document.getElementById("restore-defaults");
const settingsFields = document.getElementById("settings-fields");
const pendingChanges = new Map();
const validationErrors = new Map();
let loaded = false;
let saving = false;
let saveTimer;
let editRevision = 0;
let storageError = false;
let savedValues = {};
let activePatch = null;

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
async function loadOptions() {
	try {
		const result = await browser.storage.local.get(DEFAULT_SETTINGS);
		applyOptions(result);
		savedValues = result;
		loaded = true;
		settingsFields.disabled = false;
		updateSaveStatus();
	} catch (error) {
		console.error("Could not load settings:", error);
		showStatus("Could not load settings. Reopen this page to try again.", "error");
	}
}

function applyOptions(values) {
	enabledCheckbox.checked = values.enabled;
	autoCopyCheckbox.checked = values.autoCopy;
	postCopyActionSelect.value = values.postCopyAction;
	notificationTimeoutInput.value = values.notificationTimeout / 1000;
	keywordsInput.value = values.keywords;
	excludedEmailsInput.value = values.excludedEmails || "";
	excludeRegexInput.value = values.excludeRegex || "";
	populateRegexList(values.regexItems?.length ? values.regexItems : DEFAULT_REGEX_PATTERNS);
	for (const input of form.querySelectorAll("input, textarea")) input.setCustomValidity("");
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
	updateRegexLabels();
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
	patternInput.setAttribute("aria-label", "Pattern");
	const priorityInput = document.createElement("input");
	priorityInput.type = "number";
	priorityInput.className = "regex-priority";
	priorityInput.min = "1";
	priorityInput.placeholder = "Priority";
	priorityInput.value = priority;
	priorityInput.step = "1";
	priorityInput.setAttribute("aria-label", "Pattern priority");

	// Create delete button
	const deleteButton = document.createElement("button");
	deleteButton.type = "button";
	deleteButton.className = "delete-button";
	deleteButton.textContent = "Delete";
	deleteButton.addEventListener("click", () => {
		regexItem.remove();
		updateRegexLabels();
		queueSetting("regexItems", true);
	});

	const patternLabel = document.createElement("label");
	patternLabel.className = "regex-pattern-field";
	patternLabel.textContent = "Pattern";
	patternLabel.appendChild(patternInput);
	const priorityLabel = document.createElement("label");
	priorityLabel.className = "regex-priority-field";
	priorityLabel.textContent = "Priority";
	priorityLabel.appendChild(priorityInput);
	regexItem.appendChild(patternLabel);
	regexItem.appendChild(priorityLabel);
	regexItem.appendChild(deleteButton);

	return regexItem;
}

// Add new regex item
function addRegexItem() {
	const newItem = createRegexItem("", regexList.children.length + 1);
	regexList.appendChild(newItem);
	newItem.querySelector(".regex-pattern").focus();
	updateRegexLabels();
	queueSetting("regexItems", false);
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

function updateRegexLabels() {
	[...regexList.children].forEach((row, index) => {
		row.querySelector(".regex-pattern").setAttribute("aria-label", `Pattern ${index + 1}`);
		row.querySelector(".regex-priority").setAttribute("aria-label", `Priority for pattern ${index + 1}`);
		row.querySelector(".delete-button").setAttribute("aria-label", `Remove pattern ${index + 1}`);
	});
}

// Validate only the edited setting. An incomplete pattern must not stop the
// automatic-copy switch or any other independent setting from being saved.
function readSetting(key) {
	if (key === "regexItems") {
		if (!regexList.children.length) throw new Error("Add at least one detection pattern.");
		let error;
		const items = [...regexList.children].map((row, index) => {
			const pattern = row.querySelector(".regex-pattern");
			const priority = row.querySelector(".regex-priority");
			pattern.setCustomValidity("");
			priority.setCustomValidity("");
			let message = "";
			if (!pattern.value.trim()) {
				message = `Complete pattern ${index + 1} or remove its row.`;
			} else {
				try { new RegExp(pattern.value.trim(), "g"); }
				catch { message = `Pattern ${index + 1} is not a valid regular expression.`; }
			}
			if (message) {
				pattern.setCustomValidity(message);
				if (!error) error = message;
			}
			if (!Number.isSafeInteger(priority.valueAsNumber) || priority.valueAsNumber < 1) {
				message = `Give pattern ${index + 1} a whole-number priority of 1 or higher.`;
				priority.setCustomValidity(message);
				if (!error) error = message;
			}
			return { pattern: pattern.value.trim(), priority: priority.valueAsNumber };
		});
		if (error) throw new Error(error);
		return items;
	}
	const input = document.getElementById(key);
	input.setCustomValidity("");
	if (input.type === "checkbox") return input.checked;
	if (key === "notificationTimeout") {
		const milliseconds = Math.round(input.valueAsNumber * 1000);
		if (!Number.isSafeInteger(milliseconds) || input.valueAsNumber < 0) {
			const message = "Enter a notification duration of 0 seconds or more.";
			input.setCustomValidity(message);
			throw new Error(message);
		}
		return milliseconds;
	}
	if (key === "excludeRegex") {
		for (const [index, pattern] of input.value.split("\n").entries()) {
			if (!pattern.trim()) continue;
			try { new RegExp(pattern.trim(), "i"); }
			catch {
				const message = `Exclusion pattern on line ${index + 1} is not valid.`;
				input.setCustomValidity(message);
				throw new Error(message);
			}
		}
	}
	return input.value;
}

function settingForInput(input) {
	if (regexList.contains(input)) return "regexItems";
	return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, input.id) ? input.id : null;
}

function queueSetting(key, immediate) {
	if (!loaded || !key) return;
	editRevision++;
	try {
		const value = readSetting(key);
		const current = activePatch && Object.prototype.hasOwnProperty.call(activePatch, key)
			? activePatch[key] : savedValues[key];
		if (JSON.stringify(value) === JSON.stringify(current)) pendingChanges.delete(key);
		else pendingChanges.set(key, value);
		validationErrors.delete(key);
		storageError = false;
	} catch (error) {
		pendingChanges.delete(key);
		validationErrors.set(key, error.message);
	}
	clearTimeout(saveTimer);
	updateSaveStatus();
	if (immediate) {
		void flushChanges();
	} else {
		saveTimer = setTimeout(flushChanges, 400);
	}
}

async function flushChanges() {
	clearTimeout(saveTimer);
	if (saving || !pendingChanges.size) return;
	const patch = Object.fromEntries(pendingChanges);
	activePatch = patch;
	const revision = editRevision;
	pendingChanges.clear();
	saving = true;
	updateSaveStatus();
	let failed = false;
	try {
		await browser.storage.local.set(patch);
		Object.assign(savedValues, patch);
		storageError = false;
	} catch (error) {
		console.error("Could not save settings:", error);
		failed = true;
		storageError = true;
		for (const [key, value] of Object.entries(patch)) {
			if (!pendingChanges.has(key) && !validationErrors.has(key)) pendingChanges.set(key, value);
		}
	} finally {
		saving = false;
		activePatch = null;
		updateSaveStatus();
		// Keep writes ordered. Edits made while a write was in progress always win.
		// A failed write waits for another edit instead of retrying indefinitely.
		if (pendingChanges.size && (!failed || editRevision !== revision)) void flushChanges();
	}
}

function updateSaveStatus() {
	if (validationErrors.size) {
		showStatus(validationErrors.values().next().value + " Other settings save automatically.", "error");
	} else if (storageError) {
		showStatus("Could not save changes. Edit a setting to try again.", "error");
	} else if (saving) {
		showStatus("Saving…", "saving");
	} else if (pendingChanges.size) {
		showStatus("Waiting to save…", "pending");
	} else {
		showStatus("All changes saved", "success");
	}
}

function restoreDefaults() {
	if (!loaded || !window.confirm("Restore all settings? This replaces your detection and exclusion rules.")) return;
	clearTimeout(saveTimer);
	pendingChanges.clear();
	validationErrors.clear();
	storageError = false;
	editRevision++;
	applyOptions(DEFAULT_SETTINGS);
	for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) pendingChanges.set(key, value);
	void flushChanges();
}

function showStatus(message, type) {
	statusMessage.textContent = message;
	statusMessage.className = "status " + type;
}

// Test verification code detection
async function testVerificationCode() {
	const text = testInput.value.trim();

	if (!text) {
		showTestResult("empty");
		return;
	}

	// Get current settings from form
	const regexItems = collectRegexItems();
	const keywordsText = keywordsInput.value;
	const excludedEmailsText = excludedEmailsInput.value;
	const excludeRegexText = excludeRegexInput.value;

	try {
		readSetting("regexItems");
		readSetting("excludeRegex");
	} catch (error) {
		showTestResult("no-code", { message: error.message });
		return;
	}

	// Check if we have keywords
	if (!keywordsText || keywordsText.trim() === "") {
		showTestResult("no-code", { message: "Add verification keywords before testing." });
		return;
	}

	// Create test configuration
	const testConfig = {
		regexItems: regexItems,
		keywords: keywordsText,
		excludedEmails: excludedEmailsText,
		excludeRegex: excludeRegexText
	};

	// Create test message object if we can extract an email from the text
	let testMessage = null;
	const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
	const emailMatches = text.match(emailRegex);
	if (emailMatches && emailMatches.length > 0) {
		testMessage = {
			author: emailMatches[0]
		};
	}

	// Wait for VerificationCodeExtractor to be loaded
	if (typeof VerificationCodeExtractor === 'undefined') {
		showTestResult("no-code", { message: "The detection library is still loading. Try again shortly." });
		return;
	}

	try {
		// Create extractor instance with current configuration
		const extractor = new VerificationCodeExtractor(testConfig);
		
		// Test extraction
		const result = await extractor.testExtraction(text, testMessage);
		
		if (result.success) {
			showTestResult("found", {
				code: result.code,
				pattern: result.matchedPattern,
				keywords: result.foundKeywords
			});
		} else {
			switch (result.reason) {
				case "empty":
					showTestResult("empty");
					break;
				case "excluded":
					showTestResult("excluded", { reason: result.message });
					break;
				case "insufficient_keywords":
				case "no_code_found":
					showTestResult("no-code", { 
						keywords: result.foundKeywords || [],
						message: result.message 
					});
					break;
				default:
					showTestResult("no-code", { 
						keywords: result.foundKeywords || [],
						message: result.message || "Could not test this text."
					});
			}
		}
	} catch (error) {
		console.error("Test extraction error:", error);
		showTestResult("no-code", { message: "Could not test this text. Check your patterns and try again." });
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
			if (data.message) {
				noCodeFound.textContent = data.message;
			} else if (data.keywords && data.keywords.length > 0) {
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

		case "excluded":
			noCodeFound.textContent = `Verification code not processed. Reason: ${data.reason}`;
			noCodeFound.style.display = "block";
			break;

		default:
			noResult.textContent = "No test yet";
			noResult.style.display = "block";
	}
}

// Event listeners
document.addEventListener("DOMContentLoaded", loadOptions);
form.addEventListener("submit", (event) => {
	event.preventDefault();
	void flushChanges();
});
form.addEventListener("input", (event) => {
	if (event.target.type !== "checkbox" && event.target.tagName !== "SELECT") {
		queueSetting(settingForInput(event.target), false);
	}
});
form.addEventListener("change", (event) => queueSetting(settingForInput(event.target), true));
form.addEventListener("focusout", () => { void flushChanges(); });
window.addEventListener("pagehide", () => {
	clearTimeout(saveTimer);
	if (pendingChanges.size) {
		// Send the final patch before this document goes away. The storage API
		// handles requests in order even when a previous write is still pending.
		void browser.storage.local.set(Object.fromEntries(pendingChanges)).catch(console.error);
	}
});
restoreDefaultsButton.addEventListener("click", restoreDefaults);
addRegexButton.addEventListener("click", addRegexItem);
testButton.addEventListener("click", testVerificationCode);
