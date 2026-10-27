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
	// Traditional Chinese variants that appear in real login/verification mail
	"驗證",
	"登入",
	"校驗",
	"認證",
	"動態",
	"授權",
	"動態密",
	"臨時密",
	"一次性密",
	"雙重驗證",
	"兩步驟驗證",
	"安全碼",
	"確認碼",
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

// ---------------------------------------------------------------------------
// Delivery binding evidence.
//
// A candidate is only trustworthy when the message actually delivers it. The
// tiers below are deterministic and report which evidence accepted a value, so
// every extraction can be explained. Generic labels (code/password/token/pin)
// are deliberately weak: they are common in alerts, receipts and static
// credential mail, and must not by themselves outrank local contradicting
// context.
// ---------------------------------------------------------------------------
const TIER1_PREFIX_EN = /(?:\b(?:verification\s+code|security\s+code|authentication\s+code|authorization\s+code|login\s+code|log-in\s+code|sign-in\s+code|access\s+code|one[- ]time\s+(?:passcode|password|code)|two[- ]factor\s+(?:code|passcode)|2fa\s+code|mfa\s+code|otp\s+code|\botp\b|\bpasscode\b))\s*(?:\([A-Za-z0-9]+\))?\s*(?:is|are|as|to\s+use|for\s+login)?\s*[:：=—\-#]?\s*#?\s*$/i;
const TIER1_PREFIX_ZH = /(?:验证码|驗證碼|校验码|校驗碼|认证码|認證碼|动态码|動態碼|动态口令|動態口令|动态密码|動態密碼|一次性密码|一次性密碼|一次性验证码|一次性驗證碼|两步验证码|兩步驟驗證碼|双重验证码|雙重驗證碼|登录验证码|登入驗證碼|登录码|登入碼|身份验证码|身分驗證碼|安全验证码|安全驗證碼|授权码|授權碼|安全码|安全碼|确认码|確認碼)(?:\s*(?:登录|登入|验证|驗證|认证|認證)?\s*(?:账号|帳號|帐号|账户|帳戶)?)?\s*(?:为|為|是|:|：|=|-|—|\s)*#?\s*$/;
const TIER2_POSTFIX_EN = /^\s*(?:is|was)\s*(?:your|the)?\s*(?:one[- ]time\s+)?(?:verification|security|authentication|login|sign[- ]in|authorization)?\s*(?:code|passcode|otp|pin)\b/i;
const TIER2_POSTFIX_ZH = /^\s*(?:是|为|為)\s*(?:您|你)?\s*(?:的)?\s*(?:本次)?\s*(?:登录|登入|注册|註冊|安全|身份)?\s*(?:的)?\s*(?:验证码|驗證碼|校验码|动态码|动态口令|動態密碼)/;
const TIER3_COMMAND_EN = /\b(?:please\s+)?(?:enter|input|type|use|submit)\s+(?:the\s+)?(?:following\s+)?(?:verification\s+|security\s+|authentication\s+|one[- ]time\s+|login\s+)?code(?:\s*[:：=]|\s+is)?\s*$/i;
const TIER3_COMMAND_ZH = /(?:请|請)?\s*(?:输入|輸入|使用)\s*(?:以下)?\s*(?:授权|授權|安全|登录|登入)?\s*(?:验证码|驗證碼|动态码|口令|代码|代碼)[：:]?\s*$/;
const TIER5_GENERIC_EN = /(?:\b(?:code|password|passcode|token|pin))\s*(?:is|are)?\s*[:：=—\-#]?\s*#?\s*$/i;
const TIER5_GENERIC_ZH = /(?:代码|口令|密码|密碼|码|碼)\s*(?:为|為|是|:|：|=|-|—|\s)*#?\s*$/;

// Local contradicting labels. These reject a single occurrence, never the whole
// message, so a valid delivery elsewhere in the same mail still wins.
const NEGATIVE_LABEL_PREFIX = /(?:\b(?:promo(?:tional)?|discount|coupon|voucher|referral|gift\s*card|deal|offer|postal(?:\s*code)?|zip(?:\s*code)?|postcode|area(?:\s*code)?|country(?:\s*code)?|source|barcode|qr(?:\s*code)?|order(?:\s*(?:no\.?|number|id|#|code))?|invoice(?:\s*(?:no\.?|number|id|#))?|tracking(?:\s*(?:no\.?|number|id|#))?|shipment(?:\s*(?:no\.?|number|id|#))?|waybill|flight(?:\s*(?:no\.?|number|#))?|booking(?:\s*(?:ref|code|reference|number|#))?|pnr|reservation(?:\s*(?:code|number|#))?|meeting(?:\s*(?:id|number|code|passcode))?|conference(?:\s*id)?|zoom(?:\s*(?:meeting|id))?|account(?:\s*(?:number|id|#))?|acct|card(?:\s*(?:ending\s*in|number))?|sample(?:\s*code)?|example(?:\s*code)?|test(?:\s*code)?|static\s+password|default\s+password|current\s+password|old\s+password)\s*(?:is|are|was|:|=|：|—|-|#)*\s*#?\s*$|(?:优惠(?:券|码)?|折扣(?:券|码)?|代金券|礼品卡|邀请(?:码)?|邮编|邮政编码|区号|订单(?:号|编号)?|运单(?:号)?|快递(?:单号)?|物流(?:号)?|包裹(?:号)?|账单(?:号)?|发票(?:号)?|航班(?:号)?|预订(?:号)?|会议(?:号|密码)?|入会(?:密码)?|账号|卡号|尾号|示例|例子|如|初始密码|临时密码|默认密码|静态密码|旧密码|原密码)\s*(?:为|為|是|:|：|—|-|#)*\s*#?\s*$)/i;
const NEGATIVE_LABEL_SUFFIX = /^\s*(?:off\b|discount|coupon|voucher|points|miles|usd|cny|eur|gbp|cad|aud|yen|yuan|rmb|元|折|点|积分|street|st\b|avenue|ave\b|boulevard|blvd\b|road|rd\b|drive|dr\b|lane|ln\b|way|court|ct\b|place|pl\b|highway|hwy\b)/i;
const MONEY_PREFIX = /(?:[$€£¥￥]|US\$|HK\$|NT\$|RMB)\s*$|(?:\b(?:price|total|subtotal|amount|paid|payment|fee|balance|tax|charge|refund|cost|billed|due)\b|(?:金额|总计|合计|应付|实付|扣款|消费|费用|价格))\s*[:：=]?\s*[$€£¥￥]?\s*$/i;
const MONEY_SUFFIX = /^\s*(?:元|块|USD|EUR|GBP|CNY|RMB|dollars?|cents?)\b|^\.\d{2}\b/i;
const ACCOUNT_CARD_PREFIX = /(?:\b(?:account|card|acct)\s+(?:ending\s+in|number|no\.?|#)\b|\b(?:ending\s+in|ending\s+with)\b|\b(?:user(?:\s*id)?|customer(?:\s*id)?|client(?:\s*id)?|member(?:\s*id|ship)?|subscriber(?:\s*id)?|login\s+id)\s*[:：=]?\s*#?\s*$|(?:账号|卡号|账户)?(?:尾号|后[四4]位)\s*(?:为|是)?\s*[:：=]?\s*#?\s*$|(?:银行卡号|卡号|账户号)\s*[:：=]?\s*#?\s*$|\*{3,}|x{3,}|X{3,}|•{3,}\s*$)/i;
const PHONE_LABEL_PREFIX_EXT = /(?:\b(?:tel|telephone|phone|call|fax|mobile|cell|hotline|contact|support|helpline|dial)\b\.?|(?:电话|客服电话|服务热线|联系电话|咨询热线|热线|致电|拨打))\s*[:#-]?\s*$/i;
const PHONE_NUMBER_EXT = /(?:\+\d{1,3}[- ]?|\(\d{3}\)\s*|\b\d{3}[-.]\s*|\b(?:1-?800|1-?888|1-?877|1-?866|1-?855|400|800)[- ]?)$/i;
const TIME_OR_DATE_EXT = /(?:\b\d{1,2}[/-]\s*|\b\d{4}[/-]\s*|\b\d{1,4}\s*年\s*)$|^\s*(?:[/-]\d{1,2}\b|[/-]\d{4}\b|年|月|日)|\b\d{1,2}:\s*$|^\s*:\d{2}\b/;
const SAFETY_WARNING_CLAUSE = /(?:\b(?:never\s+share|do\s+not\s+share|will\s+never\s+ask|beware\s+of\s+scam|fraud\s+hotline|report\s+suspicious)\b|(?:请勿告知|不要透露|严防诈骗|警惕诈骗|客服不会向您索要))/i;
const URL_SPAN_REGEX = /https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi;
const URL_EDGE_PREFIX = /(?:https?:\/\/|www\.|\/|\?|&|=|@|href=["']?|src=["']?|action=["']?|url=)\s*$/i;
const URL_EDGE_SUFFIX = /^\s*(?:\/|\?|&|=|@|#|[.][a-zA-Z][a-zA-Z0-9_-]*)/i;
const HTML_ATTR_EDGE = /(?:color|bgcolor|style|class|id|href|src|name|value)=["']?\s*$/i;
const YYYYMMDD = /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/;

// Shapes that only count when a delivery label is directly bound. They are not
// offered as user-visible patterns because an unbound separated/pure-letter
// token is far more often a word or a formatted reference number.
const GATED_CODE_PATTERNS = [
	{ pattern: "\\b([0-9]{3})[- ]([0-9]{3})\\b", priority: 1, normalize: (m) => m[1] + m[2] },
	{ pattern: "\\b([0-9]{2})[- ]([0-9]{2})[- ]([0-9]{2})\\b", priority: 1, normalize: (m) => m[1] + m[2] + m[3] },
	{ pattern: "\\b([0-9]{4})[- ]([0-9]{4})\\b", priority: 3, normalize: (m) => m[1] + m[2] },
	{ pattern: "\\b([0-9]{3})[- ]([0-9]{4})\\b", priority: 5, normalize: (m) => m[1] + m[2] },
	{ pattern: "\\b[A-Za-z][-]([0-9]{6})\\b", priority: 1, normalize: (m) => m[1] },
];
const GATED_PURE_LETTER = { pattern: "\\b([A-Za-z]{4,8})\\b", priority: 6 };
// Words that are never a delivered code even when a label is adjacent.
const NON_CODE_WORDS = new Set([
	"code", "codes", "passcode", "passcodes", "password", "passwords", "login",
	"token", "tokens", "auth", "verif", "verify", "validat", "otp", "pin",
	"pins", "security", "access", "author", "authorize", "secret", "number",
	"numbers", "your", "yours", "this", "that", "with", "from", "have", "will",
	"been", "only", "also", "please", "enter", "below", "above", "click",
	"here", "hereby", "team", "support", "service", "account", "email",
	"http", "https", "html", "null", "true", "false", "usdt", "usdc",
]);

/**
 * Whether a candidate occurrence sits inside a URL or URL-shaped fragment.
 */
function isInsideUrl(text, start, end) {
	URL_SPAN_REGEX.lastIndex = 0;
	let match;
	while ((match = URL_SPAN_REGEX.exec(text)) !== null) {
		if (start >= match.index && end <= match.index + match[0].length) return true;
	}
	const before = text.slice(Math.max(0, start - 60), start);
	const after = text.slice(end, Math.min(text.length, end + 60));
	return URL_EDGE_PREFIX.test(before) || URL_EDGE_SUFFIX.test(after);
}

/**
 * Evidence tier for a candidate at a given offset.
 * 1-4 are delivery binding, 5 is a generic weak label, 6 is unbound.
 * @returns {{tier: number, reason: string}}
 */
function evaluateBinding(code, index, text) {
	const before = text.slice(Math.max(0, index - 60), index);
	const beforeLong = text.slice(Math.max(0, index - 120), index);
	const after = text.slice(index + code.length, Math.min(text.length, index + code.length + 60));

	if (NEGATIVE_LABEL_PREFIX.test(before) || NEGATIVE_LABEL_SUFFIX.test(after)) {
		return { tier: 99, reason: "negative_label" };
	}
	if (TIER1_PREFIX_EN.test(before) || TIER1_PREFIX_ZH.test(before)) {
		return { tier: 1, reason: "explicit_label_prefix" };
	}
	if (TIER2_POSTFIX_EN.test(after) || TIER2_POSTFIX_ZH.test(after)) {
		return { tier: 2, reason: "explicit_label_suffix" };
	}
	if (TIER3_COMMAND_EN.test(before) || TIER3_COMMAND_ZH.test(before)) {
		return { tier: 3, reason: "delivery_command" };
	}
	// Label on the previous line, code alone on its own line.
	const lines = beforeLong.split(/\r?\n/);
	if (lines.length >= 2) {
		const previous = lines[lines.length - 2].trim();
		const current = lines[lines.length - 1].trim();
		if (current.length <= 4 && (TIER1_PREFIX_EN.test(previous) || TIER1_PREFIX_ZH.test(previous))) {
			return { tier: 4, reason: "label_previous_line" };
		}
	}
	if (TIER5_GENERIC_EN.test(before) || TIER5_GENERIC_ZH.test(before)) {
		return { tier: 5, reason: "generic_label" };
	}
	return { tier: 6, reason: "unbound_keyword_proximity" };
}

/**
 * Whether one occurrence is contradicted by local field/amount/safety context.
 * A delivery label on this occurrence wins over weaker negatives.
 */
function isContradictedOccurrence(code, index, text, tier) {
	const before = text.slice(Math.max(0, index - 60), index);
	const after = text.slice(index + code.length, Math.min(text.length, index + code.length + 60));
	const bound = tier <= 4;

	// Amounts and URLs are never a delivered code, even next to a generic label.
	if (MONEY_SUFFIX.test(after) || MONEY_PREFIX.test(before)) return "money_amount";
	if (isInsideUrl(text, index, index + code.length)) return "url_fragment";
	if (HTML_ATTR_EDGE.test(before)) return "html_attribute";
	if (bound) return null;

	if (ACCOUNT_CARD_PREFIX.test(before)) return "account_or_card_id";
	if (PHONE_LABEL_PREFIX_EXT.test(before) || PHONE_NUMBER_EXT.test(before) || /^\s*[-.]\d{4}\b/.test(after)) return "phone_number";
	if (TIME_OR_DATE_EXT.test(before) || TIME_OR_DATE_EXT.test(after)) return "date_or_time";
	if (YYYYMMDD.test(code)) return "date_timestamp";
	// Safety boilerplate ("never share this code", "call our hotline") must not
	// veto a real delivery, so only unbound numbers in such a passage are dropped.
	const clauseStart = Math.max(0, text.lastIndexOf(".", index), text.lastIndexOf("\n", index));
	const periodEnd = text.indexOf(".", index + code.length);
	const newlineEnd = text.indexOf("\n", index + code.length);
	const clauseEnd = Math.min(text.length, periodEnd === -1 ? text.length : periodEnd, newlineEnd === -1 ? text.length : newlineEnd);
	if (SAFETY_WARNING_CLAUSE.test(text.slice(clauseStart, Math.max(clauseEnd, index + code.length))) &&
		/call|contact|hotline|致电|拨打|联系/i.test(text.slice(clauseStart, Math.max(clauseEnd, index + code.length)))) {
		return "safety_warning_contact";
	}
	return null;
}

/**
 * Shape-level and local false-positive checks.
 * @param {string} candidate Candidate code string
 * @param {number} index Index of candidate in text
 * @param {string} text Full text
 * @param {number} nearestDistance Distance to nearest keyword
 * @param {boolean} deliveryBound Whether an explicit delivery label binds this occurrence
 * @returns {boolean} True if candidate is a false positive
 */
function isFalsePositiveCandidate(candidate, index, text, nearestDistance, deliveryBound = false) {
	const textBefore = text.slice(Math.max(0, index - 60), index);
	const textAfter = text.slice(index + candidate.length, Math.min(text.length, index + candidate.length + 80));
	const isNumeric = /^\d+$/.test(candidate);
	const isMixed = /[A-Za-z]/.test(candidate) && /\d+/.test(candidate);
	// Only an explicit delivery label exempts a code from shape exclusions.
	// A bare "code:"/"password:" must not bypass the checks below, otherwise
	// static passwords and reference numbers slip through as codes.
	if (deliveryBound && hasDirectCodeLabel(textBefore)) return false;

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
 * A generic label such as "code:" or "password:" used directly before a value.
 */
function hasDirectCodeLabel(textBefore) {
	return DIRECT_CODE_LABEL_PREFIX.test(textBefore);
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
		this.useDefaultPatterns = !(config.regexItems && config.regexItems.length > 0);
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
		return this.extractWithEvidence(text).code;
	}

	/**
	 * Extract a verification code together with the rule that accepted it.
	 * @param {string} text Text to extract a verification code from
	 * @returns {{code: string|null, tier: number|null, reason: string}}
	 */
	extractWithEvidence(text) {
		if (!text) return { code: null, tier: null, reason: "empty_text" };
		const textLower = text.toLowerCase();
		let candidates = [];

		// 1. Find positions of all keywords
		let keywordPositions = [];
		for (const keyword of this.activeVerificationKeywords) {
			let keywordLower = keyword.toLowerCase();
			let pos = textLower.indexOf(keywordLower);
			while (pos !== -1) {
				// Avoid non-verification code keywords like "postal code", "discount code", etc.
				if (keywordLower === "code" || keywordLower === "码" || keywordLower === "碼") {
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

		// The count gate exists to avoid firing on mail that merely mentions the
		// word "code". It is evaluated after candidates are collected so that a
		// single explicit delivery label ("請輸入以下驗證碼：") is sufficient: that
		// phrase is far stronger evidence than two incidental keyword hits, and
		// counting translation variants as separate hits would be double counting.
		const uniqueKeywords = new Set(keywordPositions.map((pos) => pos.keyword));
		const minKeywords = Math.min(2, Math.max(1, this.activeVerificationKeywords.length));
		const keywordGatePassed = uniqueKeywords.size >= minKeywords;

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
					tier: 6,
				});
			}
		}

		// 2b. Shapes that are only meaningful with an explicit delivery label are
		// considered after the ordinary patterns, because pure letters and grouped
		// digits are otherwise dominated by words and reference numbers. They are
		// enabled only for the default patterns: a user who declares exact patterns
		// must not get values their patterns did not match.
		const hasStandardCandidate = candidates.length > 0;
		if (this.useDefaultPatterns && !hasStandardCandidate) {
			for (const pattern of GATED_CODE_PATTERNS) {
				const regex = new RegExp(pattern.pattern, "g");
				const matches = [...text.matchAll(regex)];
				for (const match of matches) {
					const code = pattern.normalize(match);
					const binding = evaluateBinding(code, match.index, text);
					if (binding.tier > 4) continue;
					candidates.push({
						code,
						index: match.index,
						priority: pattern.priority,
						distance: Infinity,
						tier: binding.tier,
					});
				}
			}
			const letterRegex = new RegExp(GATED_PURE_LETTER.pattern, "g");
			for (const match of text.matchAll(letterRegex)) {
				const code = match[1];
				if (NON_CODE_WORDS.has(code.toLowerCase())) continue;
				const binding = evaluateBinding(code, match.index, text);
				if (binding.tier > 4) continue;
				candidates.push({
					code,
					index: match.index,
					priority: GATED_PURE_LETTER.priority,
					distance: Infinity,
					tier: binding.tier,
				});
			}
		}

		if (candidates.length === 0) {
			console.log("No possible verification codes found");
			return { code: null, tier: null, reason: "no_candidates" };
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
			// Delivery binding is independent of keyword distance: a label right
			// next to the value is stronger evidence than a distant keyword.
			const binding = evaluateBinding(candidate.code, candidate.index, text);
			candidate.tier = binding.tier;
			candidate.bindingReason = binding.reason;
		}

		// 4. Drop occurrences contradicted by local context, then shape-based
		// false positives. Grouping by value keeps a code that also appears in a
		// clean position, so one bad occurrence cannot delete the whole message.
		const byValue = new Map();
		for (const candidate of candidates) {
			if (candidate.tier === 99) continue;
			const contradiction = isContradictedOccurrence(candidate.code, candidate.index, text, candidate.tier);
			if (contradiction) {
				candidate.rejectedBy = contradiction;
				continue;
			}
			const key = candidate.code;
			const existing = byValue.get(key);
			// Prefer the strongest tier, then the shortest distance for that value.
			if (!existing || candidate.tier < existing.tier ||
				(candidate.tier === existing.tier && candidate.distance < existing.distance)) {
				byValue.set(key, candidate);
			}
		}

		const validCandidates = [...byValue.values()].filter((candidate) => {
			// When the message does not even contain enough verification words, only
			// an explicit delivery label can justify an output. This keeps single-word
			// promo mail quiet without discarding a clear "验证码：123456" line.
			if (!keywordGatePassed && candidate.tier > 4) {
				candidate.rejectedBy = "insufficient_keywords";
				return false;
			}
			// Without a delivery label, a numeric value far from any verification
			// vocabulary is a weak guess; the bound branch above is what earns the
			// right to override proximity.
			if (candidate.tier >= 5 && /^\d+$/.test(candidate.code) && candidate.distance > 100) {
				candidate.rejectedBy = "unbound_distance";
				return false;
			}
			return !isFalsePositiveCandidate(
				candidate.code, candidate.index, text, candidate.distance, candidate.tier <= 1
			);
		});

		if (validCandidates.length === 0) {
			console.log("All candidates were identified as false positives");
			return { code: null, tier: null, reason: "all_rejected" };
		}

		// 5. Explicit delivery binding outranks keyword proximity; within the same
		// tier fall back to distance and then shape priority for a total order.
		validCandidates.sort((a, b) => {
			if (a.tier !== b.tier) return a.tier - b.tier;
			if (a.distance !== b.distance) return a.distance - b.distance;
			return a.priority - b.priority;
		});

		// 6. Return the best match (exact capitalization preserved)
		const winner = validCandidates[0];
		console.log(`Selected best verification code (${winner.bindingReason})`);
		return { code: winner.code, tier: winner.tier, reason: winner.bindingReason };
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