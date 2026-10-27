## 0.0.1

- First version🎉

## 0.0.2

- Refine code detection algorithm. Use a context-aware algo instead of old regex algo.

## 0.0.3

- Refine notification interaction.

## 0.0.4

- Enable user to customize regex patterns and keywords, and test them in option page.
- Add a option to auto copy code to clipboard. @Nandiniae
- Refine notification interaction.

## 0.0.5

- Add exclusion rules feature to filter out unwanted notifications.
- Support excluding messages by sender email address.
- Support excluding messages by content regex patterns.
- Update test area to validate exclusion rules.

## Unreleased

- Detect mixed letter-digit verification codes and recognize authentication and one-time password messages (#9).
- Reduce false matches from street addresses, postal codes, phone numbers, and contextual years; preserve explicitly labeled codes that resemble those formats.
- Support a single custom verification keyword and keep test-area diagnostics consistent with detection.
- Include the shared verification library in built XPI files so packaged background and settings scripts can load.
- Add local detection regression tests, including the anonymized examples from #9.
- Add a separate post-copy Email action setting: leave unchanged (default), archive with Thunderbird's archive settings, or move explicitly to the account's Trash folder (#4).
- Run post-copy mail actions only after clipboard success, including automatic copying; report failures without falling back to deletion.
- Route each notification click to its own email and code, with protection against repeated clicks while copying.
- Request `messagesMove` permission for the optional archive and Trash actions.
- Save settings automatically: switches and selections apply immediately; text edits save after a short pause or on leaving the field, with persistent saving and error feedback.
- Preserve saved values while regex patterns or numeric inputs are incomplete, without blocking changes to other settings.
- Use ordered writes and ignore stale background reads so rapid setting changes keep the latest automatic-copy selection.
- Compact the settings page with collapsible advanced rules, readable pattern priorities, responsive light/dark themes, and notification time shown in seconds.
- Confirm before restoring defaults and remove the manual Save Settings button.
- Rank candidates by delivery evidence instead of nearest keyword alone: an explicit verification/one-time-code label next to the value now outranks a merely closer unrelated number.
- Treat generic labels such as `code:` or `password:` as weak evidence so they no longer bypass address, phone, postal and amount exclusions.
- Reject a contradicting occurrence instead of the whole message, and keep the code when the same value also appears in a clean position (for example in both the body and a link).
- Add Traditional Chinese verification vocabulary (`驗證碼`, `登入`, `校驗`, `認證`, `動態`, `授權` and related phrases).
- Accept grouped digits (`123-456`) and pure-letter codes only under an explicit delivery label, never ahead of an ordinary numeric code.
- Limit unbound numeric candidates to 100 characters from the nearest verification word, and ignore eight-digit `YYYYMMDD` values that are not delivered codes.
