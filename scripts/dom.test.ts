import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { getEligibleTextNodes } from "../src/content/dom.ts";

test("TreeWalker returns readable text and skips protected subtrees", () => {
  const window = new Window({ url: "https://example.test/article" });
  const { document } = window;
  document.body.innerHTML = `
    <p>Learn <em>Spanish</em> today.</p>
    <input value="field value">
    <textarea>editable text</textarea>
    <select><option>option text</option></select>
    <div contenteditable="true">editable <span>descendant</span></div>
    <pre><code>code text</code></pre>
    <script>script text</script>
    <style>style text</style>
    <button>button text</button>
    <a href="/next">link text</a>
    <div role="button">role control</div>
    <div tabindex="0">focusable control</div>
    <div data-linguapop-ui>extension UI</div>
    <span data-linguapop-replacement="true">replaced word</span>
    <p>   \n </p>
  `;
  const before = document.body.innerHTML;

  const firstPass = getEligibleTextNodes(document.body);
  const secondPass = getEligibleTextNodes(document.body);

  assert.deepEqual(firstPass.map((node) => node.data), ["Learn ", "Spanish", " today."]);
  assert.deepEqual(secondPass.map((node) => node.data), firstPass.map((node) => node.data));
  assert.deepEqual(secondPass, firstPass);
  assert.equal(document.body.innerHTML, before);
  window.close();
});

test("TreeWalker does not return text inside LinguaPop UI nested in a readable element", () => {
  const window = new Window();
  window.document.body.innerHTML =
    '<p>before <span data-linguapop-ui><strong>tooltip text</strong></span> after</p>';

  assert.deepEqual(
    getEligibleTextNodes(window.document.body).map((node) => node.data),
    ["before ", " after"],
  );
  window.close();
});
