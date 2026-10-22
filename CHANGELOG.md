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
