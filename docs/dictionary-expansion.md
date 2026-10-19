# Dictionary expansion plan

The starter dictionary contains 120 reviewed, context-light entries. It is an offline seed, not a claim that the vocabulary set is complete.

Each entry includes a `difficulty` value: `beginner`, `intermediate`, or `advanced`. Treat difficulty as a reviewed editorial estimate: beginner covers familiar, high-frequency terms; intermediate covers less common or more abstract terms; advanced covers uncommon or specialized vocabulary. The popup selects one level at a time; new installs start at `beginner`. Keep these values on dictionary entries so the content script can filter replacement candidates without changing the static data when a user updates their preference.

Grow the dictionary to 500 entries in four reviewed batches:

1. Add 100 everyday nouns for home, food, travel, and places.
2. Add 100 common verbs with one clear infinitive translation each.
3. Add 100 adjectives and adverbs, checking gender and part-of-speech assumptions.
4. Add 80 school, work, health, and nature terms.

After those batches, add 120 more high-frequency terms from topics that pass the same review. Check every addition for duplicate English terms, regional ambiguity, and context-dependent meanings before calling the 500-word target complete. Keep user learning state in `chrome.storage.local`, never in this static dictionary.
