import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Load the same classic script used by the Thunderbird background page.
const module = { exports: {} };
runInNewContext(readFileSync(new URL("../lib/verification-core.js", import.meta.url), "utf8"), {
	module,
	console: { log() {}, error: console.error },
});
const { VerificationCodeExtractor } = module.exports;

test("Sample regression: Brim Financial alphanumeric code 3CWTRQ is detected, street number 4101 ignored", () => {
	const extractor = new VerificationCodeExtractor();
	const subject = "Verification code";
	const content = `Hi John,
Please enter the following code to proceed with accessing the credit card portal.
3CWTRQ
The Brim Team
brimfinancial.com @brimfinancial
FOLLOW US
Brim Financial Inc.
Brim is a trademark of Brim Financial Inc.
4101 Yonge Street, Suite 506 Toronto, Ontario M2P 1N6`;
	const combined = `${subject} ${content}`;

	const code = extractor.extractVerificationCode(combined);
	assert.equal(code, "3CWTRQ", "Should extract 3CWTRQ preserving exact uppercase capitalization");
});

test("Sample regression: Japan eVisa 6-digit numeric code 074037 is detected with multi-factor authentication", () => {
	const extractor = new VerificationCodeExtractor();
	const subject = "JAPAN eVISA [Notification of multi-factor authentication One-time password]";
	const content = `Thank you for using JAPAN eVISA.

This is to inform you that a one-time password for authentication has been issued.
Please enter the one-time password below to log-in to JAPAN eVISA.

074037

The One-time password will expire in 15 minutes for security reasons.
If you fail to enter the One-time password in time, you will need to log-in to JAPAN eVISA again.`;
	const combined = `${subject} ${content}`;

	const code = extractor.extractVerificationCode(combined);
	assert.equal(code, "074037");
});

test("Normal numeric cases: 6-digit, 4-digit, 8-digit, and year-like OTP", () => {
	const extractor = new VerificationCodeExtractor();

	// 6-digit standard
	assert.equal(
		extractor.extractVerificationCode("Your verification code is 849201. Please enter it to login."),
		"849201"
	);

	// 4-digit standard
	assert.equal(
		extractor.extractVerificationCode("Your login verification code is 5821."),
		"5821"
	);

	// 8-digit standard
	assert.equal(
		extractor.extractVerificationCode("Two-factor authentication code: 91827364"),
		"91827364"
	);

	// Valid 4-digit OTP that happens to be in 19xx/20xx range must NOT be blanket rejected
	assert.equal(
		extractor.extractVerificationCode("Your verification code is 2026. Do not share this login code."),
		"2026"
	);
});

test("Contextual alphanumeric codes: mixed letters and digits", () => {
	const extractor = new VerificationCodeExtractor();

	// Uppercase mixed code near code keyword
	assert.equal(
		extractor.extractVerificationCode("Please enter the following code to proceed: 9X3K21. Verification required."),
		"9X3K21"
	);

	// Preserves lowercase casing if code is lowercase
	assert.equal(
		extractor.extractVerificationCode("Your authentication code is 4a9b2k."),
		"4a9b2k"
	);

	// Rejects CSS hex color codes
	const htmlWithHex = "Verification code email. Background: #00c1d5. Your code: 7B9X2M.";
	assert.equal(
		extractor.extractVerificationCode(htmlWithHex),
		"7B9X2M"
	);
});

test("Single contextual authentication keyword triggers detection", () => {
	const extractor = new VerificationCodeExtractor();

	// 'authentication' matches both 'authentication' and 'authenticat'
	assert.equal(
		extractor.extractVerificationCode("Authentication: 849201"),
		"849201"
	);

	assert.equal(
		extractor.extractVerificationCode("Authentication: 3CWTRQ"),
		"3CWTRQ"
	);
});

test("Street address false positives are rejected", () => {
	const extractor = new VerificationCodeExtractor();

	// Street number alone without real code should return null
	const text1 = "Verification of your account. Office address: 4101 Yonge Street, Toronto. Please login.";
	assert.equal(extractor.extractVerificationCode(text1), null);

	// Preceded by Suite / Apt
	const text2 = "Verification notice for your login. Location: Suite 1506, Market Plaza.";
	assert.equal(extractor.extractVerificationCode(text2), null);

	// Street number present alongside real code: real code is extracted, street number rejected
	const text3 = "Your verification code is 654321. Our office is located at 1234 Main Street.";
	assert.equal(extractor.extractVerificationCode(text3), "654321");
});

test("Postal code false positives are rejected", () => {
	const extractor = new VerificationCodeExtractor();

	// Canadian postal code
	const text1 = "Verification notice for login. Postal code: M2P 1N6.";
	assert.equal(extractor.extractVerificationCode(text1), null);

	// US ZIP code preceded by state
	const text2 = "Account login verification. Beverly Hills, CA 90210.";
	assert.equal(extractor.extractVerificationCode(text2), null);

	// US ZIP code preceded by label
	const text3 = "Login verification details. Zip code: 90210.";
	assert.equal(extractor.extractVerificationCode(text3), null);

	// Postal code alongside real code
	const text4 = "Your verification code is 192837. Billing zip code: 90210.";
	assert.equal(extractor.extractVerificationCode(text4), "192837");
});

test("Year false positives are rejected only in date/copyright contexts", () => {
	const extractor = new VerificationCodeExtractor();

	// Copyright notice
	const text1 = "Please verify your login. Copyright © 2025 Brim Financial Inc.";
	assert.equal(extractor.extractVerificationCode(text1), null);

	// Month date
	const text2 = "Verification notice for your login on August 18, 2025.";
	assert.equal(extractor.extractVerificationCode(text2), null);

	// ISO date
	const text3 = "Verification notice. Login at 2025-08-18.";
	assert.equal(extractor.extractVerificationCode(text3), null);

	// Year in copyright alongside real code
	const text4 = "Your login verification code is 987654. © 2025 Example Corp.";
	assert.equal(extractor.extractVerificationCode(text4), "987654");
});

test("Phone number false positives are rejected", () => {
	const extractor = new VerificationCodeExtractor();

	// Phone number alone
	const text1 = "Customer login verification. Call our hotline at 1-800-555-0199.";
	assert.equal(extractor.extractVerificationCode(text1), null);

	// Phone number alongside real code
	const text2 = "Your verification code is 384920. Support: 1-800-123-4567.";
	assert.equal(extractor.extractVerificationCode(text2), "384920");
});

test("Non-verification 'code' prefixes do not create false keyword triggers", () => {
	const extractor = new VerificationCodeExtractor();

	// 'postal code' alone should not satisfy 2-keyword threshold
	const text1 = "Your postal code is 90210. Thank you.";
	assert.equal(extractor.extractVerificationCode(text1), null);

	// 'promo code' alone
	const text2 = "Use promo code 50OFF for your discount.";
	assert.equal(extractor.extractVerificationCode(text2), null);
});

test("Custom configuration: custom keyword 'voucher' and 3-digit pattern", () => {
	const customExtractor = new VerificationCodeExtractor({
		keywords: "voucher",
		regexItems: [{ pattern: "\\b[0-9]{3}\\b", priority: 1 }]
	});

	// Should extract 3-digit code when single custom keyword 'voucher' is present
	const result = customExtractor.extractVerificationCode("Redeem your voucher with 789");
	assert.equal(result, "789");

	// Alphanumeric code should NOT be extracted when custom regexItems is numeric-only
	const resultAlpha = customExtractor.extractVerificationCode("Your voucher code is 3CWTRQ");
	assert.equal(resultAlpha, null);
});

test("testExtraction diagnostics alignment", async () => {
	const extractor = new VerificationCodeExtractor();

	// Success case
	const resSuccess = await extractor.testExtraction("Your verification code is 3CWTRQ");
	assert.equal(resSuccess.success, true);
	assert.equal(resSuccess.code, "3CWTRQ");
	assert.ok(resSuccess.matchedPattern);
	assert.ok(resSuccess.foundKeywords.length >= 2);

	// Insufficient keywords
	const resInsufficient = await extractor.testExtraction("Here is some text with only code: 123456");
	assert.equal(resInsufficient.success, false);
	assert.equal(resInsufficient.reason, "insufficient_keywords");

	// Keywords present but candidates are false positives
	const resFalsePos = await extractor.testExtraction("Verification login address: 4101 Yonge Street");
	assert.equal(resFalsePos.success, false);
	assert.equal(resFalsePos.reason, "no_code_found");
});

test("Explicit verification labels preserve codes resembling postal codes and colors", () => {
	const extractor = new VerificationCodeExtractor();
	assert.equal(extractor.extractVerificationCode("Your verification code is A1B2C3."), "A1B2C3");
	assert.equal(extractor.extractVerificationCode("Your verification code: #3CWTRQ"), "3CWTRQ");
	assert.equal(extractor.extractVerificationCode("Your verification code: 123456\n1 Main Street"), "123456");
});

test("Separator-only keyword settings do not bypass verification context", async () => {
	const extractor = new VerificationCodeExtractor({ keywords: ", ," });
	assert.equal(extractor.extractVerificationCode("Order 123456"), null);
	const result = await extractor.testExtraction("Order 123456");
	assert.equal(result.success, false);
	assert.equal(result.reason, "insufficient_keywords");
});
