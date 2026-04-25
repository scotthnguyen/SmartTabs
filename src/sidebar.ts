import type { Section } from "./parser";

const SIDEBAR_ID = "smart-tabs-sidebar";
const COLLAPSED_ID = "smart-tabs-collapsed";

let currentSections: Section[] = [];
let activeScrollContainer: HTMLElement | null = null;
let scrollTimeout: number | null = null;
let bookmarkHighlightTimeout: number | null = null;
let lastActiveId: string | null = null;
let isHidden = false;

interface SidebarActions {
  onRemoveTab: (section: Section) => void;
  onRenameTab: (section: Section, newTitle: string) => void;
  onToggleHidden: () => void;
}

export function resetSidebarState() {
  currentSections = [];

  if (activeScrollContainer) {
    activeScrollContainer.removeEventListener("scroll", handleScroll);
  }

  if (scrollTimeout !== null) {
    window.clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }

  if (bookmarkHighlightTimeout !== null) {
    window.clearTimeout(bookmarkHighlightTimeout);
    bookmarkHighlightTimeout = null;
  }

  clearBookmarkHighlights();

  activeScrollContainer = null;
  lastActiveId = null;
}

function getScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;

  while (parent) {
    const style = window.getComputedStyle(parent);

    const canScroll =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight;

    if (canScroll) return parent;

    parent = parent.parentElement;
  }

  return null;
}

function findLiveElement(section: Section): HTMLElement | null {
  if (section.turnId) {
    return document.querySelector(
      `[data-turn-id-container="${section.turnId}"]`
    ) as HTMLElement | null;
  }

  return null;
}

function getVisualTarget(el: HTMLElement): HTMLElement {
  return (el.closest("[data-turn-id-container]") as HTMLElement) || el;
}

function jumpToTarget(target: HTMLElement) {
  const scrollContainer = getScrollableAncestor(target);

  if (!scrollContainer) {
    target.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();

  const offset =
    targetRect.top - containerRect.top + scrollContainer.scrollTop;

  scrollContainer.scrollTop = offset - 16;
}

function setActiveTab(section: Section) {
  lastActiveId = section.id;

  document.querySelectorAll<HTMLButtonElement>(".smart-tab-item").forEach((el) => {
    if (el.dataset.sectionId === section.id) {
      el.classList.add("smart-tab-active");
    } else {
      el.classList.remove("smart-tab-active");
    }
  });
}

function getTopVisibleSection(scrollContainer: HTMLElement): Section | null {
  const containerRect = scrollContainer.getBoundingClientRect();

  let best: Section | null = null;
  let bestDist = Infinity;

  currentSections.forEach((section) => {
    if (section.type === "bookmark") return;

    const el = findLiveElement(section);
    if (!el) return;

    const target = getVisualTarget(el);
    const rect = target.getBoundingClientRect();

    const visible =
      rect.bottom >= containerRect.top &&
      rect.top <= containerRect.bottom;

    if (!visible) return;

    const dist = Math.abs(rect.top - containerRect.top);

    if (dist < bestDist) {
      bestDist = dist;
      best = section;
    }
  });

  return best;
}

function updateActiveFromScroll() {
  if (!activeScrollContainer) return;

  const section = getTopVisibleSection(activeScrollContainer);
  if (!section) return;

  setActiveTab(section);
}

function handleScroll() {
  if (scrollTimeout !== null) {
    window.clearTimeout(scrollTimeout);
  }

  scrollTimeout = window.setTimeout(updateActiveFromScroll, 150);
}

function clearBookmarkHighlights() {
  const highlights = document.querySelectorAll(".smart-bookmark-highlight");

  highlights.forEach((highlight) => {
    highlight.replaceWith(
      document.createTextNode(highlight.textContent || "")
    );
  });
}

function highlightExactText(container: HTMLElement, text: string) {
  if (!text) return;

  if (bookmarkHighlightTimeout !== null) {
    window.clearTimeout(bookmarkHighlightTimeout);
    bookmarkHighlightTimeout = null;
  }

  clearBookmarkHighlights();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const content = node.nodeValue;
    if (!content) continue;

    const normalizedContent = content.toLowerCase();
const normalizedText = text.toLowerCase().trim();

// try exact
let index = normalizedContent.indexOf(normalizedText);

// fallback: try substring chunks if exact fails
if (index === -1 && normalizedText.length > 20) {
  const chunk = normalizedText.slice(5, -5); // remove edges
  index = normalizedContent.indexOf(chunk);
}
    if (index === -1) continue;

    const before = content.slice(0, index);
    const match = content.slice(index, index + text.length);
    const after = content.slice(index + text.length);

    const span = document.createElement("span");
    span.className = "smart-bookmark-highlight";
    span.textContent = match;

    const parent = node.parentNode;
    if (!parent) return;

    const frag = document.createDocumentFragment();

    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, node);

    span.scrollIntoView({ behavior: "auto", block: "center" });

    bookmarkHighlightTimeout = window.setTimeout(() => {
      if (span.isConnected) {
        span.replaceWith(document.createTextNode(match));
      }

      bookmarkHighlightTimeout = null;
    }, 3000);

    return;
  }

  container.classList.add("smart-tab-highlight");

  bookmarkHighlightTimeout = window.setTimeout(() => {
    container.classList.remove("smart-tab-highlight");
    bookmarkHighlightTimeout = null;
  }, 1400);
}

function setupScrollTracking() {
  const first = currentSections
    .filter((s) => s.type !== "bookmark")
    .map(findLiveElement)
    .find((el): el is HTMLElement => Boolean(el));

  if (!first) return;

  const container = getScrollableAncestor(first);
  if (!container) return;

  if (activeScrollContainer === container) {
    updateActiveFromScroll();
    return;
  }

  if (activeScrollContainer) {
    activeScrollContainer.removeEventListener("scroll", handleScroll);
  }

  activeScrollContainer = container;
  activeScrollContainer.addEventListener("scroll", handleScroll);

  updateActiveFromScroll();
}

function showCollapsed(actions: SidebarActions) {
  let btn = document.getElementById(COLLAPSED_ID);

  if (!btn) {
    btn = document.createElement("button");
    btn.id = COLLAPSED_ID;
    btn.textContent = "Tabs";
    document.body.appendChild(btn);
  }

  btn.onclick = () => {
    isHidden = false;
    btn?.remove();
    actions.onToggleHidden();
    renderSidebar(currentSections, actions);
  };
}

function startRename(
  item: HTMLButtonElement,
  section: Section,
  actions: SidebarActions
) {
  const input = document.createElement("input");
  input.className = "smart-tab-rename-input";
  input.value = section.title;

  item.replaceWith(input);

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  let saved = false;

  const save = () => {
    if (saved) return;
    saved = true;

    const val = input.value.trim();

    if (val && val !== section.title) {
      actions.onRenameTab(section, val);
    } else {
      input.replaceWith(item);
    }
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") save();

    if (e.key === "Escape") {
      saved = true;
      input.replaceWith(item);
    }
  };

  input.onblur = save;
}

function createTabRow(section: Section, actions: SidebarActions) {
  const row = document.createElement("div");
  row.className = "smart-tab-row";

  const item = document.createElement("button");
  item.className = "smart-tab-item";
  item.textContent = section.title;
  item.dataset.sectionId = section.id;

  if (section.type === "bookmark") {
    item.classList.add("smart-tab-bookmark");
  }

  item.onclick = () => {
    const live = findLiveElement(section);
    if (!live) return;

    const target = getVisualTarget(live);

    console.log("[SmartTabs] clicked tab", {
  type: section.type,
  title: section.title,
  rawText: section.rawText,
  turnId: section.turnId,
  liveFound: Boolean(live),
  livePreview: live.textContent?.slice(0, 300)
});

    jumpToTarget(target);
    setActiveTab(section);

    if (section.type === "bookmark") {
      highlightExactText(target, section.rawText);
    } else {
      window.setTimeout(() => {
        target.classList.add("smart-tab-highlight");

        window.setTimeout(() => {
          target.classList.remove("smart-tab-highlight");
          updateActiveFromScroll();
        }, 1400);
      }, 50);
    }
  };

  const rename = document.createElement("button");
  rename.className = "smart-tab-rename";
  rename.textContent = "✎";
  rename.title = "Rename tab";

  rename.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startRename(item, section, actions);
  });

  const remove = document.createElement("button");
  remove.className = "smart-tab-remove";
  remove.textContent = "×";
  remove.title = "Remove tab";

  remove.onclick = (e) => {
    e.stopPropagation();
    actions.onRemoveTab(section);
  };

  row.appendChild(item);
  row.appendChild(rename);
  row.appendChild(remove);

  return row;
}

export function renderSidebar(sections: Section[], actions: SidebarActions) {
  currentSections = sections;

  let sidebar = document.getElementById(SIDEBAR_ID);

  if (isHidden) {
    sidebar?.remove();
    showCollapsed(actions);
    return;
  }

  document.getElementById(COLLAPSED_ID)?.remove();

  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    document.body.appendChild(sidebar);
  }

  sidebar.innerHTML = "";

  const header = document.createElement("div");
  header.className = "smart-tabs-header";

  const title = document.createElement("div");
  title.className = "smart-tabs-title";
  title.textContent = "Smart Tabs";

  const hide = document.createElement("button");
  hide.className = "smart-tabs-hide-btn";
  hide.textContent = "Hide";
  hide.title = "Hide Smart Tabs";

  hide.onclick = () => {
    isHidden = true;
    sidebar?.remove();
    actions.onToggleHidden();
    showCollapsed(actions);
  };

  header.appendChild(title);
  header.appendChild(hide);
  sidebar.appendChild(header);

  const hint = document.createElement("div");
  hint.className = "smart-tabs-hint";
  hint.innerHTML = `
    Bookmark: ⌘/Ctrl + Shift + B<br/>
    Use ✎ to rename tabs
  `;
  sidebar.appendChild(hint);

  const list = document.createElement("div");
  list.className = "smart-tabs-list";

  const bookmarks = sections.filter((s) => s.type === "bookmark");
  const normal = sections.filter((s) => s.type !== "bookmark");

  if (bookmarks.length) {
    const header = document.createElement("div");
    header.className = "smart-tabs-divider";
    header.textContent = "★ Bookmarks";
    list.appendChild(header);

    bookmarks.forEach((s) => list.appendChild(createTabRow(s, actions)));

    const line = document.createElement("div");
    line.className = "smart-tabs-divider-line";
    list.appendChild(line);
  }

  normal.forEach((s) => list.appendChild(createTabRow(s, actions)));

  sidebar.appendChild(list);

  if (sections.length) {
    const active =
      sections.find((s) => s.id === lastActiveId) || normal[0] || sections[0];

    setActiveTab(active);
  }

  setupScrollTracking();
}