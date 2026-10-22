import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import {
  getContainingSentence,
  MAX_CONTEXT_SENTENCE_LENGTH,
  renderHighlightedContextSentence,
} from "../src/learning/context-sentence.ts";

test("extracts the trimmed sentence around a match and caps long text", () => {
  const text = "Before.  The Apple is ripe! After.";
  const start = text.indexOf("Apple");

  assert.equal(getContainingSentence(text, start, start + "Apple".length), "The Apple is ripe!");
  assert.equal(getContainingSentence(`${"x".repeat(600)} apple`, 601, 606).length, MAX_CONTEXT_SENTENCE_LENGTH);
});

test("renders only text and highlights the source word safely", () => {
  const window = new Window();
  const context = window.document.createElement("p");

  renderHighlightedContextSentence(context, "Read <b>the Apple</b> today.", "Apple", "en");

  assert.equal(context.textContent, "Read <b>the Apple</b> today.");
  assert.equal(context.querySelectorAll("b").length, 0);
  assert.equal(context.querySelector("mark")?.textContent, "Apple");
  assert.equal(context.hidden, false);
  window.close();
});
