import { parseSections, type Section } from "./parser";
import { renderSidebar } from "./sidebar";

let updateTimeout: number | null = null;
let currentChatKey = "";

const sectionMap = new Map<string, Section>();
let orderedKeys: string[] = [];

function getKey(section: Section): string {
  return section.rawText.toLowerCase();
}

function getChatKey(): string {
  return window.location.pathname;
}

function resetForNewChat() {
  sectionMap.clear();
  orderedKeys = [];
}

function mergeSections(newSections: Section[]) {
  const parsedKeys = newSections.map(getKey);

  newSections.forEach((section) => {
    sectionMap.set(getKey(section), section);
  });

  // Find where this visible DOM block belongs in the current sidebar order
  const firstExistingKey = parsedKeys.find((key) => orderedKeys.includes(key));
  const insertIndex =
    firstExistingKey !== undefined ? orderedKeys.indexOf(firstExistingKey) : orderedKeys.length;

  // Remove any keys from this visible block so we can reinsert them in correct DOM order
  orderedKeys = orderedKeys.filter((key) => !parsedKeys.includes(key));

  // Insert the currently visible block in its actual DOM order
  orderedKeys.splice(insertIndex, 0, ...parsedKeys);

  const orderedSections = orderedKeys
    .map((key) => sectionMap.get(key))
    .filter((section): section is Section => Boolean(section));

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