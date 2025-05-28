import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { simpleParser } from "mailparser";

// Get current file directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

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

// Test result statistics
const results = {
	total: 0,
	success: 0,
	failed: 0,
	codes: [],
};

// Process single email file
async function processEmailFile(filePath) {
	try {
		const fileContent = fs.readFileSync(filePath, "utf8");
		const parsed = await simpleParser(fileContent);

		// Get email subject and content
		const subject = parsed.subject || "";
		const textContent = parsed.text || "";

		// Combine subject and content
		const combinedText = subject + " " + textContent;

		// Extract verification code using imported function
		const verificationCode = extractVerificationCode(combinedText);

		// Get filename without path
		const fileName = path.basename(filePath);

		if (verificationCode) {
			console.log(`✅ Success: ${fileName}`);
			console.log(`  Subject: ${subject}`);
			console.log(`  Code: ${verificationCode}`);
			results.success++;
			results.codes.push({
				file: fileName,
				subject,
				code: verificationCode,
			});
		} else {
			console.log(`❌ No verification code found: ${fileName}`);
			results.failed++;
		}

		results.total++;
	} catch (error) {
		console.error(`Error processing file ${filePath}:`, error);
		results.failed++;
		results.total++;
	}
}

// Main function
async function main() {
	console.log("Starting verification code extraction test...");
	console.log(`Test directory: ${dataDir}`);

	try {
		// Get all .eml files
		const files = fs
			.readdirSync(dataDir)
			.filter((file) => file.toLowerCase().endsWith(".eml"))
			.map((file) => path.join(dataDir, file));

		console.log(`Found ${files.length} .eml files`);

		// Process all files
		for (const file of files) {
			await processEmailFile(file);
			console.log("--------------------------------------------");
		}

		// Output statistics
		console.log("\nTest Results:");
		console.log(`Total: ${results.total} files`);
		console.log(`Success: ${results.success} files`);
		console.log(`Failed: ${results.failed} files`);
		console.log(
			`Success rate: ${((results.success / results.total) * 100).toFixed(2)}%`
		);

		// Output all found verification codes
		if (results.codes.length > 0) {
			console.log("\nFound verification codes:");
			results.codes.forEach((result, index) => {
				console.log(`${index + 1}. ${result.file}`);
				console.log(`   Subject: ${result.subject}`);
				console.log(`   Code: ${result.code}`);
			});
		}
	} catch (error) {
		console.error("Error during test:", error);
	}
}

// Run test
main();
