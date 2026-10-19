const excludedTags = new Set([
  "A",
  "AUDIO",
  "BUTTON",
  "CANVAS",
  "CODE",
  "DETAILS",
  "EMBED",
  "IFRAME",
  "INPUT",
  "KBD",
  "LABEL",
  "NOSCRIPT",
  "OBJECT",
  "OPTION",
  "PRE",
  "SAMP",
  "SCRIPT",
  "SELECT",
  "STYLE",
  "SUMMARY",
  "TEXTAREA",
  "VIDEO",
]);

const interactiveRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menu",
  "menuitem",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
]);

function isExcludedElement(element: Element): boolean {
  if (
    excludedTags.has(element.tagName) ||
    element.hasAttribute("data-linguapop-ui") ||
    element.hasAttribute("data-linguapop-replacement")
  ) {
    return true;
  }

  const editableValue = element.getAttribute("contenteditable");
  if (editableValue !== null && editableValue.toLowerCase() !== "false") {
    return true;
  }

  const role = element.getAttribute("role")?.toLowerCase();
  if (role && interactiveRoles.has(role)) return true;

  const tabIndex = element.getAttribute("tabindex");
  return tabIndex !== null && tabIndex !== "-1";
}

function isExcludedTextNode(node: Node, root: Node): boolean {
  let element = node.parentElement;

  while (element) {
    if (isExcludedElement(element)) return true;
    if (element === root) break;
    element = element.parentElement;
  }

  return false;
}

export function isWithinLinguaPopOwnedElement(node: Node): boolean {
  let element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  while (element) {
    if (
      element.hasAttribute("data-linguapop-ui") ||
      element.hasAttribute("data-linguapop-replacement")
    ) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

/** Finds readable text without changing the page or its attributes. */
export function getEligibleTextNodes(root: Node = document.body): Text[] {
  const ownerDocument = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  if (!ownerDocument) return [];

  if (root.nodeType === 3) {
    const textNode = root as Text;
    return textNode.data.trim() && !isExcludedTextNode(textNode, ownerDocument) ? [textNode] : [];
  }

  const nodeFilter = ownerDocument.defaultView?.NodeFilter;
  const walker = ownerDocument.createTreeWalker(
    root,
    nodeFilter?.SHOW_TEXT ?? 4,
    {
      acceptNode(node) {
        if (node.nodeType !== 3 || !node.textContent?.trim()) {
          return nodeFilter?.FILTER_REJECT ?? 2;
        }

        return isExcludedTextNode(node, root)
          ? nodeFilter?.FILTER_REJECT ?? 2
          : nodeFilter?.FILTER_ACCEPT ?? 1;
      },
    },
  );

  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  return textNodes;
}
