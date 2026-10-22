export const MAX_CONTEXT_SENTENCE_LENGTH = 500;

const sentenceEnding = /[.!?…。！？]/u;

export function getContainingSentence(text: string, start: number, end: number): string {
  let sentenceStart = 0;
  for (let index = start - 1; index >= 0; index -= 1) {
    if (sentenceEnding.test(text[index] ?? "")) {
      sentenceStart = index + 1;
      break;
    }
  }

  let sentenceEnd = text.length;
  for (let index = end; index < text.length; index += 1) {
    if (sentenceEnding.test(text[index] ?? "")) {
      sentenceEnd = index + 1;
      break;
    }
  }

  const sentence = text.slice(sentenceStart, sentenceEnd).trim();
  if (sentence.length <= MAX_CONTEXT_SENTENCE_LENGTH) return sentence;
  return `${sentence.slice(0, MAX_CONTEXT_SENTENCE_LENGTH - 1).trimEnd()}…`;
}

export function renderHighlightedContextSentence(
  container: HTMLElement,
  sentence: string,
  sourceText: string,
  locale: string,
): void {
  const normalizedSentence = sentence.toLocaleLowerCase(locale);
  const start = normalizedSentence.indexOf(sourceText.toLocaleLowerCase(locale));
  container.replaceChildren();

  if (start < 0) {
    container.textContent = sentence;
    container.hidden = false;
    return;
  }

  const end = start + sourceText.length;
  const mark = container.ownerDocument.createElement("mark");
  mark.textContent = sentence.slice(start, end);
  container.append(
    container.ownerDocument.createTextNode(sentence.slice(0, start)),
    mark,
    container.ownerDocument.createTextNode(sentence.slice(end)),
  );
  container.hidden = false;
}
