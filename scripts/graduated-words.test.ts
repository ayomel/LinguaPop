import assert from "node:assert/strict";
import test from "node:test";
import { getGraduatedWords, type GraduationStorage } from "../src/learning/graduated-words.ts";

test("graduation state accepts only valid entry IDs marked true", async () => {
  const storage = {
    async get() {
      return {
        graduatedWords: {
          "en-apple": true,
          "en-book": false,
          "bad id": true,
        },
      };
    },
  };

  assert.deepEqual(await getGraduatedWords(storage as unknown as GraduationStorage), {
    "en-apple": true,
  });
});
