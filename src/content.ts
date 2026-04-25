import { parseSections, type Section } from "./parser";
import { renderSidebar, resetSidebarState } from "./sidebar";

let updateTimeout: number | null = null;
let currentChatKey = "";

const sectionMap = new Map<string, Section>();
const removedKeys = new Set<string>();

function getKey(section: Section): string {
  return section.id || section.turnId || section.rawText.toLowerCase();
}

function getChatKey(): string {
  return window.location.pathname;
}

function resetForNewChat() {
  sectionMap.clear();
  removedKeys.clear();
  resetSidebarState();
}

function getOrderedSections(): Section[] {
  return Array.from(sectionMap.values())
    .filter((section) => !removedKeys.has(getKey(section)))
    .sort((a, b) => {
      if (a.type === "bookmark" && b.type !== "bookmark") return -1;
      if (a.type !== "bookmark" && b.type === "bookmark") return 1;

      if (a.type === "bookmark" && b.type === "bookmark") {
        return b.domOrder - a.domOrder;
      }

      return a.domOrder - b.domOrder;
    });
}

function renderCurrentSidebar() {
  renderSidebar(getOrderedSections(), {
    onRemoveTab: removeTab,
    onRenameTab: renameTab,
    onToggleHidden: () => {}
  });
}

function mergeSections(newSections: Section[]) {
  newSections.forEach((section) => {
    const key = getKey(section);
    const existing = sectionMap.get(key);

    if (existing) {
      sectionMap.set(key, {
        ...section,
        title: existing.title
      });
    } else {
      sectionMap.set(key, section);
    }
  });

  renderCurrentSidebar();
}

function removeTab(section: Section) {
  removedKeys.add(getKey(section));
  renderCurrentSidebar();
}

function renameTab(section: Section, newTitle: string) {
  const key = getKey(section);
  const existing = sectionMap.get(key);

  if (!existing) return;

  sectionMap.set(key, {
    ...existing,
    title: newTitle
  });

  renderCurrentSidebar();
}

function createBookmarkFromSelection() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (!selection || !selectedText) return;

  const anchorNode = selection.anchorNode;
  const anchorElement =
    anchorNode instanceof HTMLElement
      ? anchorNode
      : anchorNode?.parentElement;

  if (!anchorElement) return;

  const container = anchorElement.closest(
    "[data-turn-id-container]"
  ) as HTMLElement | null;

  if (!container) return;

  const turnId = container.getAttribute("data-turn-id-container") ?? "";
  const bookmarkId = `bookmark-${turnId}-${Date.now()}`;

  const bookmark: Section = {
    id: bookmarkId,
    title: `★ ${selectedText.slice(0, 60)}`,
    element: container,
    rawText: selectedText,
    domOrder: Date.now(),
    turnId,
    type: "bookmark"
  };

  sectionMap.set(getKey(bookmark), bookmark);
  renderCurrentSidebar();

  selection.removeAllRanges();
}

function init() {
  const newChatKey = getChatKey();

  if (newChatKey !== currentChatKey) {
    currentChatKey = newChatKey;
    resetForNewChat();
  }

  const parsed = parseSections();

  if (parsed.length > 0) {
    mergeSections(parsed);
  }
}

function shouldIgnoreMutation(mutations: MutationRecord[]): boolean {
  return mutations.every((mutation) => {
    const target = mutation.target as HTMLElement | null;
    if (!target) return false;
    return !!target.closest("#smart-tabs-sidebar");
  });
}

function scheduleInit() {
  if (updateTimeout !== null) {
    window.clearTimeout(updateTimeout);
  }

  updateTimeout = window.setTimeout(() => {
    init();
  }, 250);
}

function observeChanges() {
  const observer = new MutationObserver((mutations) => {
    if (shouldIgnoreMutation(mutations)) return;
    scheduleInit();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  let lastHref = window.location.href;

  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      scheduleInit();
    }
  }, 500);
}

document.addEventListener("keydown", (event) => {
  const isBookmarkShortcut =
    event.shiftKey &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "b";

  if (!isBookmarkShortcut) return;

  event.preventDefault();
  createBookmarkFromSelection();
});

window.addEventListener("load", () => {
  setTimeout(() => {
    currentChatKey = getChatKey();
    init();
    observeChanges();
  }, 1500);
});