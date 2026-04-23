export interface Section {
  id: string;
  title: string;
  element: HTMLElement;
  rawText: string;
  domOrder: number;
}

function normalizeText(text: string): string {
  return text
    .replace(/^You said:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(text: string): string {
  let t = normalizeText(text);

  t = t.replace(
    /^(can you|could you|help me|please|i need|how do i|what about|also)\s+/i,
    ""
  );
  t = t.replace(/\s+/g, " ");

  const words = t.split(" ").slice(0, 7);
  const result = words.join(" ").trim();

  if (!result) return "Untitled";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function parseSections(): Section[] {
  const sections: Section[] = [];
  const seenText = new Set<string>();

  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-message-author-role="user"], [data-turn="user"]'
    )
  );

  nodes.forEach((node, index) => {
    const rawText = node.textContent?.trim() ?? "";
    const normalized = normalizeText(rawText);

    if (!normalized) return;

    const dedupeKey = normalized.toLowerCase();
    if (seenText.has(dedupeKey)) return;
    seenText.add(dedupeKey);

    const id = `smart-tab-${index}`;
    node.dataset.smartTabId = id;

    sections.push({
      id,
      title: cleanTitle(normalized),
      element: node,
      rawText: normalized,
      domOrder: index
    });
  });

  return sections;
}