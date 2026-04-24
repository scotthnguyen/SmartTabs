import { parseSections, type Section } from "./parser";
import { renderSidebar, resetSidebarState } from "./sidebar";

let updateTimeout: number | null = null;
let currentChatKey = "";

const sectionMap = new Map<string, Section>();
let orderedKeys: string[] = [];

function getKey(section: Section): string {
  return section.turnId || section.rawText.toLowerCase();
}

function getChatKey(): string {
  return window.location.pathname;
}

function resetForNewChat() {
  sectionMap.clear();
  orderedKeys = [];
  resetSidebarState();
}

function mergeSections(newSections: Section[]) {
  newSections.forEach((section) => {
    sectionMap.set(getKey(section), section);
  });

  const orderedSections = Array.from(sectionMap.values()).sort(
    (a, b) => a.domOrder - b.domOrder
  );

  orderedKeys = orderedSections.map(getKey);

  renderSidebar(orderedSections);
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

window.addEventListener("load", () => {
  setTimeout(() => {
    currentChatKey = getChatKey();
    init();
    observeChanges();
  }, 1500);
});