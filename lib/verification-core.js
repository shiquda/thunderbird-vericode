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

// Default verification code patterns - used to identify possible verification code formats
const DEFAULT_CODE_PATTERNS = [
	{ pattern: "\\b[0-9]{6}\\b", priority: 1 }, // 6-digit number (most common)
	{ pattern: "\\b[0-9]{4}\\b", priority: 2 }, // 4-digit number
	{ pattern: "\\b[0-9]{8}\\b", priority: 3 }, // 8-digit number
	{ pattern: "\\b[0-9]{5}\\b", priority: 4 }, // 5-digit number
	{ pattern: "\\b[0-9]{7}\\b", priority: 5 }, // 7-digit number
];

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
			if (keyword && textLower.includes(keyword.toLowerCase())) {
				foundKeywords.push(keyword);
			}
		}

		// Need at least 2 keywords to trigger detection
		if (foundKeywords.length < 2) {
			return {
				success: false,
				reason: "insufficient_keywords",
				foundKeywords: foundKeywords,
				message: foundKeywords.length > 0 
					? `Found ${foundKeywords.length} keywords (${foundKeywords.join(", ")}), but need at least 2. Please check your keywords settings.`
					: "No enough keywords (at least 2). Please check your keywords settings."
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