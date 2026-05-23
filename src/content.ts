import { parseSections, simpleHash, type Section } from "./parser";
import { renderSidebar, resetSidebarState } from "./sidebar";

console.log("[SmartTabs] content script loaded", window.location.href);

let updateTimeout: number | null = null;
let currentChatKey = "";
let autoTabsEnabled = true;
let hasScrolledToLoadMessages = false;

const STORAGE_KEY = "smart-tabs-bookmarks-v2";

const sectionMap = new Map<string, Section>();
const removedKeys = new Set<string>();

type StoredBookmark = Omit<Section, "element">;

function getKey(section: Section): string {
  return section.id || section.turnId || section.rawText.toLowerCase();
}

function getChatKey(): string {
  return window.location.pathname;
}

function isInChat(): boolean {
  return window.location.pathname.startsWith("/c/");
}

function removeSidebarFromPage() {
  document.getElementById("smart-tabs-sidebar")?.remove();
  document.getElementById("smart-tabs-collapsed")?.remove();
}

function getStoredBookmarks(): Record<string, StoredBookmark[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBookmarksForCurrentChat() {
  if (!currentChatKey) return;

  const allBookmarks = getStoredBookmarks();

  const bookmarks: StoredBookmark[] = Array.from(sectionMap.values())
    .filter((section) => section.type === "bookmark")
    .map(({ element, ...rest }) => rest);

  allBookmarks[currentChatKey] = bookmarks;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(allBookmarks));
}

function loadBookmarksForCurrentChat() {
  const allBookmarks = getStoredBookmarks();
  const bookmarks = allBookmarks[currentChatKey] || [];

  bookmarks.forEach((bookmark) => {
    const restored: Section = {
      ...bookmark,
      element: document.body
    };

    sectionMap.set(getKey(restored), restored);
  });
}

function resetForNewChat() {
  sectionMap.clear();
  removedKeys.clear();
  hasScrolledToLoadMessages = false;
  resetSidebarState();
  loadBookmarksForCurrentChat();
}

function getScrollContainer(): HTMLElement | null {
  const firstMessage = document.querySelector<HTMLElement>(
    '[data-message-author-role="user"]'
  );
  if (firstMessage) {
    let parent = firstMessage.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const canScroll =
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        parent.scrollHeight > parent.clientHeight;
      if (canScroll) return parent;
      parent = parent.parentElement;
    }
  }
  return document.querySelector<HTMLElement>("main");
}

async function scrollToTopAndLoad(scrollContainer: Element): Promise<void> {
  return new Promise(resolve => {
    let lastHeight = 0;
    let stableCount = 0;

    const interval = setInterval(() => {
      scrollContainer.scrollTop = 0;
      const newHeight = scrollContainer.scrollHeight;

      if (newHeight === lastHeight) {
        stableCount++;
        if (stableCount >= 3) {
          clearInterval(interval);
          setTimeout(resolve, 300);
        }
      } else {
        stableCount = 0;
      }
      lastHeight = newHeight;
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 15000);
  });
}

function getOrderedSections(): Section[] {
  return Array.from(sectionMap.values())
    .filter((section) => !removedKeys.has(getKey(section)))
    .filter((section) => autoTabsEnabled || section.type === "bookmark")
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
    autoTabsEnabled,
    onRemoveTab: removeTab,
    onRenameTab: renameTab,
    onToggleHidden: () => {},
    onToggleAutoTabs: toggleAutoTabs,
    onCreateBookmark: createLocationBookmark
  });
}

function mergeSections(newSections: Section[]) {
  newSections.forEach((section) => {
    const key = getKey(section);
    const existing = sectionMap.get(key);

    if (existing) {
      sectionMap.set(key, { ...section, title: existing.title });
    } else {
      sectionMap.set(key, section);
    }
  });

  const entries = [...sectionMap.entries()];
  sectionMap.clear();
  entries
    .sort(([, a], [, b]) => {
      if (a.type === "bookmark" && b.type === "bookmark") return b.domOrder - a.domOrder;
      if (a.type === "bookmark") return -1;
      if (b.type === "bookmark") return 1;
      return a.domOrder - b.domOrder;
    })
    .forEach(([key, val]) => sectionMap.set(key, val));

  renderCurrentSidebar();
}

function removeTab(section: Section) {
  removedKeys.add(getKey(section));

  if (section.type === "bookmark") {
    sectionMap.delete(getKey(section));
    saveBookmarksForCurrentChat();
  }

  renderCurrentSidebar();
}

function renameTab(section: Section, newTitle: string) {
  const key = getKey(section);
  const existing = sectionMap.get(key);

  if (!existing) return;

  const title =
    existing.type === "bookmark" && !newTitle.startsWith("★ ")
      ? `★ ${newTitle}`
      : newTitle;

  sectionMap.set(key, {
    ...existing,
    title
  });

  if (existing.type === "bookmark") {
    saveBookmarksForCurrentChat();
  }

  renderCurrentSidebar();
}

function toggleAutoTabs() {
  autoTabsEnabled = !autoTabsEnabled;
  renderCurrentSidebar();
}

function createLocationBookmark(section: Section, name: string) {
  const contextText = (
    section.contextText ||
    section.element?.textContent ||
    section.rawText ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

  const bookmark: Section = {
    ...section,
    id: `bookmark-${Date.now()}-${simpleHash(section.id)}`,
    title: `★ ${name}`,
    contextText,
    domOrder: Date.now(),
    type: "bookmark"
  };

  sectionMap.set(getKey(bookmark), bookmark);
  saveBookmarksForCurrentChat();
  renderCurrentSidebar();
}

async function init() {
  const newChatKey = getChatKey();

  if (!isInChat()) {
    resetForNewChat();
    removeSidebarFromPage();
    currentChatKey = newChatKey;
    return;
  }

  if (newChatKey !== currentChatKey) {
    currentChatKey = newChatKey;
    resetForNewChat();
    removeSidebarFromPage();
    await new Promise<void>(resolve => window.setTimeout(resolve, 400));
    renderCurrentSidebar();
  }

  if (!hasScrolledToLoadMessages) {
    hasScrolledToLoadMessages = true;
    const scrollContainer = getScrollContainer();
    if (scrollContainer) {
      await scrollToTopAndLoad(scrollContainer);
    }
    const parsed = parseSections();
    mergeSections(parsed);
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
    return;
  }

  mergeSections(parseSections());
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

  window.setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      scheduleInit();
    }
  }, 500);
}

window.addEventListener("load", () => {
  window.setTimeout(() => {
    currentChatKey = getChatKey();
    resetForNewChat();
    init();
    observeChanges();
  }, 1500);
});