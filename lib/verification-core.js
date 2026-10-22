/**
 * Thunderbird Vericode - Core verification code extraction library
 * Shared logic for verification code detection across all components
 */

// Default verification keyword list - used to identify verification code context
const DEFAULT_VERIFICATION_KEYWORDS = [
	// English keywords
	"code",
	"verif",
	"login",
	"log-in",
	"validat",
	"authentication",
	"authenticate",
	"authenticat",
	"authorization",
	"authorize",
	"password",
	"passcode",
	"one-time",
	"onetime",
	"one time",
	"two-factor",
	"two factor",
	"multi-factor",
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

// Default verification code patterns - used to identify possible verification code formats
const DEFAULT_CODE_PATTERNS = [
	{ pattern: "\\b[0-9]{6}\\b", priority: 1 }, // 6-digit number (most common)
	{ pattern: "\\b[0-9]{4}\\b", priority: 2 }, // 4-digit number
	{ pattern: "\\b[0-9]{8}\\b", priority: 3 }, // 8-digit number
	{ pattern: "\\b[0-9]{5}\\b", priority: 4 }, // 5-digit number
	{ pattern: "\\b[0-9]{7}\\b", priority: 5 }, // 7-digit number
	{ pattern: "\\b(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{4,8}\\b", priority: 6 }, // Mixed letter-digit codes, below numeric patterns
];

// Helper regexes for false-positive detection
const NON_VERIFICATION_CODE_PREFIX = /(?:postal|zip|area|country|promo|promotional|discount|coupon|qr|bar|barcode|source)\s+$/i;
const STREET_SUFFIX_REGEX = /^[ \t]+(?:[A-Za-z0-9.'-]+[ \t]+){1,4}(?:street|st\.?|avenue|ave\.?|boulevard|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|way|court|ct\.?|place|pl\.?|terrace|ter\.?|parkway|pkwy\.?|highway|hwy\.?|circle|cir\.?|square|sq\.?|loop|alley|broadway)\b/i;
const UNIT_PREFIX_REGEX = /(?:suite|ste|apt|apartment|unit|room|rm|floor|fl|box|p\.?o\.?\s*box|bldg|building)\.?\s*#?\s*$/i;
const CHINESE_ROAD_PREFIX = /(?:路|街|道|巷)\s*$/;
const CHINESE_ADDR_SUFFIX = /^\s*(?:号楼|号院|弄|号|栋|单元|室)/;
const CANADIAN_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const US_POSTAL_LABEL_PREFIX = /(?:zip(?:\s*code)?|postal(?:\s*code)?|postcode)\s*[:#-]?\s*$/i;
const US_STATE_PREFIX = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+$/i;
const ZIP_PLUS_4_SUFFIX = /^\s*-\s*\d{4}\b/;
const COPYRIGHT_PREFIX = /(?:©|&copy;|\(c\)|copyright)\s*(?:\d{4}\s*[-–—]\s*)?$/i;
const COPYRIGHT_SUFFIX = /^\s*(?:[-–—]\s*\d{4})?\s*(?:all\s+rights\s+reserved|inc\b|llc\b|ltd\b|corp\b)/i;
const DATE_MONTH_PREFIX = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(?:\d{1,2}(?:st|nd|rd|th)?,\s*)?$/i;
const DATE_DAY_MONTH_PREFIX = /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*$/i;
const PHONE_LABEL_PREFIX = /(?:tel|telephone|phone|call|fax|mobile|cell|hotline)\.?\s*[:#-]?\s*$/i;
const PHONE_NUMBER_PREFIX = /(?:\+\d{1,3}[- ]?|\(\d{3}\)\s*|\b\d{3}[-.]\s*)$/;
const PHONE_NUMBER_SUFFIX = /^\s*[-.]\d{4}\b/;
const DIRECT_CODE_LABEL_PREFIX = /(?:\b(?:verification\s+code|authentication(?:\s+code)?|security\s+code|one[- ]time\s+(?:code|password)|code|password|passcode|token|otp|pin)|验证码|校验码|动态码)\s*(?:is\s*)?[:：=]?\s*#?\s*$/i;

/**
 * Check if a candidate code is a false positive
 * @param {string} candidate Candidate code string
 * @param {number} index Index of candidate in text
 * @param {string} text Full text
 * @param {number} nearestDistance Distance to nearest keyword
 * @returns {boolean} True if candidate is a false positive
 */
function isFalsePositiveCandidate(candidate, index, text, nearestDistance) {
	const textBefore = text.slice(Math.max(0, index - 60), index);
	const textAfter = text.slice(index + candidate.length, Math.min(text.length, index + candidate.length + 80));
	const isNumeric = /^\d+$/.test(candidate);
	const isMixed = /[A-Za-z]/.test(candidate) && /\d/.test(candidate);
	// An explicit code label wins over shape-only exclusions, such as a code
	// which happens to have the same format as a Canadian postal code.
	const hasCodeLabel = DIRECT_CODE_LABEL_PREFIX.test(textBefore) &&
		!NON_VERIFICATION_CODE_PREFIX.test(textBefore.replace(/code\s*(?:is\s*)?[:：=]?\s*#?\s*$/i, ""));
	if (hasCodeLabel) return false;

	// 1. Street address number false positive
	if (isNumeric) {
		if (STREET_SUFFIX_REGEX.test(textAfter)) return true;
		if (UNIT_PREFIX_REGEX.test(textBefore)) return true;
		if (CHINESE_ROAD_PREFIX.test(textBefore) && CHINESE_ADDR_SUFFIX.test(textAfter)) return true;
	}

	// 2. Postal / ZIP code false positive
	if (CANADIAN_POSTAL_REGEX.test(candidate)) return true;
	if (/^[A-Za-z]\d[A-Za-z]$/.test(candidate) && /^\s*\d[A-Za-z]\d\b/.test(textAfter)) return true;
	if (/^\d[A-Za-z]\d$/.test(candidate) && /\b[A-Za-z]\d[A-Za-z]\s*$/.test(textBefore)) return true;
	if (/^\d{5}$/.test(candidate)) {
		if (US_POSTAL_LABEL_PREFIX.test(textBefore)) return true;
		if (US_STATE_PREFIX.test(textBefore)) return true;
		if (ZIP_PLUS_4_SUFFIX.test(textAfter)) return true;
	}

	// 3. Year false positive (contextual copyright and dates only)
	if (/^\d{4}$/.test(candidate)) {
		const num = parseInt(candidate, 10);
		if (num >= 1900 && num <= 2099) {
			if (COPYRIGHT_PREFIX.test(textBefore)) return true;
			if (COPYRIGHT_SUFFIX.test(textAfter)) return true;
			if (DATE_MONTH_PREFIX.test(textBefore)) return true;
			if (DATE_DAY_MONTH_PREFIX.test(textBefore)) return true;
			if (/\b\d{1,2}[/-]\s*$/.test(textBefore) || /^\s*[/-]\d{1,2}\b/.test(textAfter)) return true;
			if (/^\s*年/.test(textAfter)) return true;
		}
	}

	// 4. Phone number false positive
	if (PHONE_LABEL_PREFIX.test(textBefore)) return true;
	if (PHONE_NUMBER_PREFIX.test(textBefore)) return true;
	if (PHONE_NUMBER_SUFFIX.test(textAfter)) return true;

	// 5. Mixed alphanumeric contextual constraints
	if (isMixed) {
		// CSS hex colors: e.g. #00c1d5
		if (/#\s*$/.test(textBefore)) return true;
		// URLs, paths, query strings, emails
		if (/(?:https?:\/\/|www\.|\/|\?|&|=|@)\s*$/i.test(textBefore) || /^\s*(?:\/|\?|&|=|@)/.test(textAfter)) return true;
		// HTML attributes: e.g. color="00c1d5"
		if (/(?:color|bgcolor|style|class|id|href|src)=["']?\s*$/i.test(textBefore)) return true;
		// Distance / context check: must have nearby keyword or direct code label
		if (nearestDistance > 150) return true;
	}

	return false;
}
/**
 * Verification Code Extractor Class
 * Provides unified verification code detection functionality
 */
class VerificationCodeExtractor {
	constructor(config = {}) {
		this.updateConfig(config);
	}

	/**
	 * Update configuration
	 * @param {Object} config Configuration object
	 */
	updateConfig(config) {
		// Update verification keywords
		this.activeVerificationKeywords = [];
		if (config.keywords && config.keywords.trim() !== "") {
			const keywords = config.keywords
				.split(",")
				.map((keyword) => keyword.trim())
				.filter((keyword) => keyword !== "");
			this.activeVerificationKeywords = [...keywords];
		} else {
			this.activeVerificationKeywords = [...DEFAULT_VERIFICATION_KEYWORDS];
		}

		// Update code patterns
		this.activeCodePatterns = [];
		if (config.regexItems && config.regexItems.length > 0) {
			const patterns = config.regexItems
				.map((item) => {
					try {
						return {
							regex: new RegExp(item.pattern, "g"),
							priority: item.priority,
							pattern: item.pattern,
						};
					} catch (error) {
						console.error(`Invalid regex pattern: ${item.pattern}`, error);
						return null;
					}
				})
				.filter((pattern) => pattern !== null);
			this.activeCodePatterns = [...patterns];
		} else {
			this.activeCodePatterns = DEFAULT_CODE_PATTERNS.map((item) => {
				return {
					regex: new RegExp(item.pattern, "g"),
					priority: item.priority,
					pattern: item.pattern,
				};
			});
		}

		// Update exclusion rules
		this.activeExcludedEmails = [];
		if (config.excludedEmails && config.excludedEmails.trim() !== "") {
			this.activeExcludedEmails = config.excludedEmails
				.split(",")
				.map((email) => email.trim().toLowerCase())
				.filter((email) => email !== "");
		}

		this.activeExcludeRegexPatterns = [];
		if (config.excludeRegex && config.excludeRegex.trim() !== "") {
			const patterns = config.excludeRegex
				.split("\n")
				.map((pattern) => pattern.trim())
				.filter((pattern) => pattern !== "");

			this.activeExcludeRegexPatterns = patterns
				.map((pattern) => {
					try {
						return new RegExp(pattern, "i");
					} catch (error) {
						console.error(`Invalid exclude regex pattern: ${pattern}`, error);
						return null;
					}
				})
				.filter((pattern) => pattern !== null);
		}
	}

	/**
	 * Check if message should be excluded based on exclusion rules
	 * @param {Object} message Message object with author property
	 * @param {string} combinedText Combined subject and content text
	 * @returns {Promise<boolean>} True if message should be excluded
	 */
	async shouldExcludeMessage(message, combinedText) {
		// Check if sender email is in the excluded emails list
		if (this.activeExcludedEmails.length > 0 && message && message.author) {
			try {
				// For test environment, check if message.author is already an email
				let senderEmail = message.author.toLowerCase();
				
				// If browser.messengerUtilities is available (in extension context)
				if (typeof browser !== "undefined" && browser.messengerUtilities) {
					const parsedAddresses = await browser.messengerUtilities.parseMailboxString(message.author);
					if (parsedAddresses && parsedAddresses.length > 0) {
						senderEmail = parsedAddresses[0].email.toLowerCase();
					}
				}
				
				if (this.activeExcludedEmails.includes(senderEmail)) {
					console.log(`Message excluded: sender email ${senderEmail} is in the excluded list`);
					return true;
				}
			} catch (error) {
				console.error("Error parsing sender email:", error);
			}
		}

		// Check if message content matches any exclude regex pattern
		if (this.activeExcludeRegexPatterns.length > 0 && combinedText) {
			for (const pattern of this.activeExcludeRegexPatterns) {
				if (pattern.test(combinedText)) {
					console.log(`Message excluded: content matches exclude pattern ${pattern}`);
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Extract verification code from text
	 * @param {string} text Text to extract verification code from
	 * @returns {string|null} Extracted verification code or null if not found
	 */
	extractVerificationCode(text) {
		if (!text) return null;
		const textLower = text.toLowerCase();
		let candidates = [];

		// 1. Find positions of all keywords
		let keywordPositions = [];
		for (const keyword of this.activeVerificationKeywords) {
			let keywordLower = keyword.toLowerCase();
			let pos = textLower.indexOf(keywordLower);
			while (pos !== -1) {
				// Avoid non-verification code keywords like "postal code", "discount code", etc.
				if (keywordLower === "code" || keywordLower === "码") {
					const prefix = textLower.slice(Math.max(0, pos - 20), pos);
					if (NON_VERIFICATION_CODE_PREFIX.test(prefix)) {
						pos = textLower.indexOf(keywordLower, pos + 1);
						continue;
					}
				}
				keywordPositions.push({
					keyword: keyword,
					index: pos,
					length: keyword.length,
				});
				pos = textLower.indexOf(keywordLower, pos + 1);
			}
		}

		// Return null if fewer than required keywords are found
		const uniqueKeywords = new Set(keywordPositions.map((pos) => pos.keyword));
		const minKeywords = Math.min(2, Math.max(1, this.activeVerificationKeywords.length));
		if (uniqueKeywords.size < minKeywords) return null;

		// 2. Find all possible verification codes
		for (const pattern of this.activeCodePatterns) {
			// Reset regex to ensure clean state
			pattern.regex.lastIndex = 0;
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

		console.log(`Found ${candidates.length} possible verification code candidates`);
		console.log(`Found ${keywordPositions.length} keyword positions`);

		// 3. Calculate the distance from each candidate code to the nearest keyword
		for (let candidate of candidates) {
			for (let keywordPos of keywordPositions) {
				// Calculate distance between verification code and keyword
				if (candidate.index > keywordPos.index) {
					const distance =
						candidate.index - (keywordPos.index + keywordPos.length);
					candidate.distance = Math.min(candidate.distance, distance);
				} else {
					const distance =
						keywordPos.index - (candidate.index + candidate.code.length);
					candidate.distance = Math.min(candidate.distance, distance);
				}
			}
		}

		// 4. Filter out false positive candidates (street numbers, postal codes, copyright years, phone numbers, invalid mixed alphanum)
		const validCandidates = candidates.filter(
			(candidate) => !isFalsePositiveCandidate(candidate.code, candidate.index, text, candidate.distance)
		);

		if (validCandidates.length === 0) {
			console.log("All candidates were identified as false positives");
			return null;
		}

		// 5. Sort candidate codes by distance and priority
		validCandidates.sort((a, b) => {
			// Sort by distance first
			if (a.distance !== b.distance) {
				return a.distance - b.distance;
			}
			// Sort by priority when distances are equal
			return a.priority - b.priority;
		});

		// 6. Return the best match (exact capitalization preserved)
		console.log("Selected best verification code:", validCandidates[0].code);
		return validCandidates[0].code;
	}

	/**
	 * Test verification code extraction with detailed results
	 * @param {string} text Text to test
	 * @param {Object} testMessage Optional message object for exclusion testing
	 * @returns {Object} Test result object
	 */
	async testExtraction(text, testMessage = null) {
		if (!text || !text.trim()) {
			return {
				success: false,
				reason: "empty",
				message: "Please paste the text to test"
			};
		}

		// Check exclusion rules first if testMessage is provided
		if (testMessage) {
			const shouldExclude = await this.shouldExcludeMessage(testMessage, text);
			if (shouldExclude) {
				return {
					success: false,
					reason: "excluded",
					message: "Message excluded by exclusion rules"
				};
			}
		}

		// Check for keywords
		const foundKeywords = [];
		const textLower = text.toLowerCase();
		for (const keyword of this.activeVerificationKeywords) {
			if (keyword) {
				const keywordLower = keyword.toLowerCase();
				let pos = textLower.indexOf(keywordLower);
				let hasValidOccurrence = false;
				while (pos !== -1) {
					if (keywordLower === "code" || keywordLower === "码") {
						const prefix = textLower.slice(Math.max(0, pos - 20), pos);
						if (NON_VERIFICATION_CODE_PREFIX.test(prefix)) {
							pos = textLower.indexOf(keywordLower, pos + 1);
							continue;
						}
					}
					hasValidOccurrence = true;
					break;
				}
				if (hasValidOccurrence) {
					foundKeywords.push(keyword);
				}
			}
		}

		// Need at least minKeywords to trigger detection
		const minKeywords = Math.min(2, Math.max(1, this.activeVerificationKeywords.length));
		if (foundKeywords.length < minKeywords) {
			return {
				success: false,
				reason: "insufficient_keywords",
				foundKeywords: foundKeywords,
				message: foundKeywords.length > 0 
					? `Found ${foundKeywords.length} keywords (${foundKeywords.join(", ")}), but need at least ${minKeywords}. Please check your keywords settings.`
					: `No enough keywords (at least ${minKeywords}). Please check your keywords settings.`
			};
		}

		// Try to extract verification code
		const verificationCode = this.extractVerificationCode(text);

		if (verificationCode) {
			// Find which pattern matched
			let matchedPattern = null;
			for (const pattern of this.activeCodePatterns) {
				const regex = new RegExp(pattern.pattern, "g");
				if (regex.test(verificationCode)) {
					matchedPattern = pattern.pattern;
					break;
				}
			}

			return {
				success: true,
				code: verificationCode,
				matchedPattern: matchedPattern,
				foundKeywords: foundKeywords
			};
		} else {
			return {
				success: false,
				reason: "no_code_found",
				foundKeywords: foundKeywords,
				message: `Found ${foundKeywords.length} keywords (${foundKeywords.join(", ")}), but no verification code. Please check your regex patterns.`
			};
		}
	}

	/**
	 * Get current configuration
	 * @returns {Object} Current configuration
	 */
	getConfig() {
		return {
			keywords: this.activeVerificationKeywords,
			regexPatterns: this.activeCodePatterns,
			excludedEmails: this.activeExcludedEmails,
			excludeRegexPatterns: this.activeExcludeRegexPatterns
		};
	}
}

// Export for different environments
if (typeof module !== "undefined" && module.exports) {
	// Node.js environment
	module.exports = { VerificationCodeExtractor, DEFAULT_VERIFICATION_KEYWORDS, DEFAULT_CODE_PATTERNS };
} else {
	// Browser/Extension environment
	window.VerificationCodeExtractor = VerificationCodeExtractor;
}