import assert from "node:assert/strict";
import test from "node:test";
import { serializeAnkiExport } from "../src/learning/ankiExport.ts";

const vocabulary = {
  targetText: "buenos días",
  sourceText: "good morning",
  partOfSpeech: "",
  exampleTargetText: "Buenos días.",
  exampleSourceText: "Good morning.",
  difficulty: "beginner",
  learningStatus: "new",
} as const;

test("exports vocabulary fields in Anki import order", () => {
  assert.equal(
    serializeAnkiExport([vocabulary], "Spanish"),
    [
      "#separator:Tab",
      "#columns:Spanish\tEnglish\tPart of speech\tExample (Spanish)\tExample (English)\tDifficulty\tLearning status",
      "buenos días\tgood morning\t\tBuenos días.\tGood morning.\tbeginner\tNew",
    ].join("\r\n"),
  );
});

test("quotes tabs, newlines, and quotes in example fields", () => {
  assert.equal(
    serializeAnkiExport([
      {
        ...vocabulary,
        exampleTargetText: "Buenos\tdías.\n¿Todo bien?",
        exampleSourceText: 'She said "hello".\nGood morning.',
      },
    ], "Spanish"),
    [
      "#separator:Tab",
      "#columns:Spanish\tEnglish\tPart of speech\tExample (Spanish)\tExample (English)\tDifficulty\tLearning status",
      'buenos días\tgood morning\t\t"Buenos\tdías.\n¿Todo bien?"\t"She said ""hello"".\nGood morning."\tbeginner\tNew',
    ].join("\r\n"),
  );
});

test("labels the export columns with the selected target language", () => {
  const exportText = serializeAnkiExport([vocabulary], "French");
  assert.match(exportText, /^#columns:French\tEnglish\tPart of speech\tExample \(French\)/m);
});
