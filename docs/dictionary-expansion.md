# Dictionary coverage and expansion

The dictionary contains 506 entries: 270 nouns, 90 verbs, 80 adjectives, 60 adverbs, and six subject pronouns. It covers food, home, travel, animals, family, the body, school, technology, health, nature, and everyday actions and descriptions.

Each entry includes a `difficulty` value: `beginner`, `intermediate`, or `advanced`. Treat difficulty as a reviewed editorial estimate: beginner covers familiar, high-frequency terms; intermediate covers less common or more abstract terms; advanced covers uncommon or specialized vocabulary. The popup selects one level at a time; new installs start at `beginner`. Keep these values on dictionary entries so the content script can filter replacement candidates without changing the static data when a user updates their preference.

The 500-word target was reached in three batches, followed by six everyday pronouns:

1. Original starter: 120 entries across four parts of speech.
2. First expansion: 100 nouns for food, home, travel, animals, and the body.
3. Second expansion: 140 nouns, 60 verbs, 50 adjectives, and 30 adverbs.
4. Everyday subject pronouns: I, you, he, she, we, and they.

Context-sensitive expressions such as “I am” are stored as complete phrase entries instead of one generic translation. Common Latin American Spanish uses `tú` for informal singular “you” and `ustedes` for plural “you”. Spanish typically omits standalone “it” as a subject.

For future additions, check for duplicate English terms, regional ambiguity, and context-dependent meanings. Preserve existing IDs and run `pnpm dictionary:check` after changes. Keep user learning state in `chrome.storage.local`, never in this static dictionary.
