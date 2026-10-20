# Dictionary expansion plan

The dictionary contains 220 entries: the original 120 plus 100 nouns covering food, home, travel, animals, and the body. It is an offline seed, not a claim that the vocabulary set is complete.

Each entry includes a `difficulty` value: `beginner`, `intermediate`, or `advanced`. Treat difficulty as a reviewed editorial estimate: beginner covers familiar, high-frequency terms; intermediate covers less common or more abstract terms; advanced covers uncommon or specialized vocabulary. The popup selects one level at a time; new installs start at `beginner`. Keep these values on dictionary entries so the content script can filter replacement candidates without changing the static data when a user updates their preference.

Grow the dictionary to 500 entries through these batches:

1. Completed: add 100 nouns for food, home, travel, animals, and the body.
2. Add 100 common verbs with one clear infinitive translation each.
3. Add 100 adjectives and adverbs, checking gender and part-of-speech assumptions.
4. Add 80 school, work, health, and nature terms.

Check every addition for duplicate English terms, regional ambiguity, and context-dependent meanings before calling the 500-word target complete. Keep user learning state in `chrome.storage.local`, never in this static dictionary.
