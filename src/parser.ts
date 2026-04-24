export interface Section {
  id: string;
  title: string;
  element: HTMLElement;
  rawText: string;
  domOrder: number;
  turnId: string;
}

function normalizeText(text: string): string {
  return text.replace(/^You said:\s*/i, "").replace(/\s+/g, " ").trim();
}

function cleanTitle(text: string): string {
  let t = normalizeText(text);

  t = t.replace(
    /^(can you|could you|help me|please|i need|how do i|what about|also)\s+/i,
    ""
  );

  const words = t.split(" ").slice(0, 7);
  const result = words.join(" ").trim();

  if (!result) return "";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function getFileName(container: HTMLElement): string | null {
  const text = container.textContent ?? "";

  const match = text.match(
    /[\w\s()._-]+\.(pdf|docx?|pptx?|xlsx?|csv|txt|png|jpe?g|webp)/i
  );

  return match ? match[0].trim() : null;
}

function hasImage(container: HTMLElement): boolean {
  return Boolean(container.querySelector("img"));
}

function makeTitle(userText: string, container: HTMLElement): string {
  const cleanedText = cleanTitle(userText);
  const fileName = getFileName(container);
  const imageAttached = hasImage(container);

  let attachmentLabel = "";

  if (fileName) {
    attachmentLabel = fileName;
  } else if (imageAttached) {
    attachmentLabel = "Image attached";
  }

  if (cleanedText && attachmentLabel) {
    return `${cleanedText} — ${attachmentLabel}`;
  }

  if (cleanedText) {
    return cleanedText;
  }

  if (attachmentLabel) {
    return attachmentLabel;
  }

  return "Untitled";
}

export function parseSections(): Section[] {
  const sections: Section[] = [];
  let userOrder = 0;

  const containers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-turn-id-container]")
  );

  containers.forEach((container, index) => {
    const userNode = container.querySelector<HTMLElement>(
      '[data-message-author-role="user"]'
    );

    if (!userNode) return;

    const turnId = container.getAttribute("data-turn-id-container") ?? "";
    const rawText = normalizeText(userNode.textContent ?? "");
    const title = makeTitle(rawText, container);

    if (!turnId && !rawText) return;

    sections.push({
      id: turnId || `smart-tab-${userOrder}`,
      title,
      element: container,
      rawText,
      domOrder: index,
      turnId
    });

    userOrder++;
  });

  console.log(
  "PARSER OUTPUT",
  sections.map((s) => ({
    title: s.title,
    turnId: s.turnId,
    domOrder: s.domOrder,
    rawText: s.rawText.slice(0, 80)
  }))
);

  return sections;
}