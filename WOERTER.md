# WORTWERK German word data, version 1

`words.js` is the finished, dependency-free ESM asset. It exports frozen `SOLUTIONS`, `EXTRA_GUESSES`, and `WORD_LIST_VERSION = 1`.

| Tiles | Solutions | Additional guesses | Accepted total |
|---:|---:|---:|---:|
| 4 | 413 | 160 | 573 |
| 5 | 811 | 550 | 1,361 |
| 6 | 701 | 1,083 | 1,784 |
| 7 | 215 | 539 | 754 |
| 8 | 310 | 229 | 539 |
| **Total** | **2,450** | **2,561** | **5,011** |

## Method

Manually authored and reviewed from ordinary German vocabulary, without copying or scraping an external dictionary. No third-party lexicon license or attribution is required. Targets emphasize familiar nouns, adjectives and adverbs; a small number of common inflections and verbs are included. Established German loanwords are included, e.g. COMPUTER, JAZZ and COUCH. Proper names, explicit insults and fabricated compounds were excluded. A final fairness pass removed unusually specialized target words.

Extra guesses include familiar inflections, infinitives, everyday compounds and some established spelling variants. This is a bounded game dictionary, not a comprehensive German morphological dictionary. Rejection means “not in this game’s word list,” not “not a German word.” A custom-word mode or dictionary toggle can make this limit less frustrating.

## Tile and seed contract

- Each word is NFC uppercase and contains only `A–Z`, `Ä`, `Ö`, `Ü`, `ẞ`.
- Umlauts and `ẞ` occupy **one** tile each. Do not transliterate them.
- Normalize user input with `input.normalize('NFC').replace(/ß/g, 'ẞ').toUpperCase()`. Plain `toUpperCase()` alone incorrectly converts `ß` to two letters.
- All target and extra-guess arrays use fixed Unicode/code-point lexicographic ordering, equivalent to JavaScript `.sort()` without a comparator.
- Accept guesses from the union of the relevant solution pool and `EXTRA_GUESSES` filtered to the same length.
- Some Swiss-style `SS` spellings are accepted as additional guesses. They retain their actual tile count; no automatic conversion to `ẞ` is implied.
- Include `WORD_LIST_VERSION` in deterministic challenge payloads. Once a version is published, retain its exact arrays. Changing membership or ordering can otherwise change old links’ target words.
- For repeat-free daily games, permute the entire six-letter pool into a deterministic deck and index by day. The 701-word daily pool provides almost two years before a cycle repeats. Simple `hash(date) % length` does not guarantee that consecutive days differ.

## Verification

Run `node work/word-data/validate.mjs` from the workspace root. Checks cover NFC, alphabet, exact code-point length, global uniqueness, fixed sort order, frozen arrays, supported lengths and minimum pool size. Final run passed for all 5,011 entries.

Manual curation reduces obvious mistakes but does not replace a lexicographer’s exhaustive review. Wording in the UI should describe the word list as curated, not Duden-certified.
