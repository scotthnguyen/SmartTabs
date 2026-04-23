import type { Section } from "./parser";

const SIDEBAR_ID = "smart-tabs-sidebar";

let currentSections: Section[] = [];
let activeScrollContainer: HTMLElement | null = null;
let scrollTimeout: number | null = null;
let lastActiveRawText: string | null = null;

function normalizeText(text: string): string {
  return text.replace(/^You said:\s*/i, "").replace(/\s+/g, " ").trim();
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
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-message-author-role="user"], [data-turn="user"]'
    )
  );

  const match = nodes.find((node) => {
    const text = normalizeText(node.textContent ?? "");
    return text.toLowerCase() === section.rawText.toLowerCase();
  });

  return match || (section.element?.isConnected ? section.element : null);
}

function getVisualTarget(el: HTMLElement): HTMLElement {
  let current: HTMLElement | null = el;

  while (current) {
    const rect = current.getBoundingClientRect();

    if (rect.height > 20 && rect.width > 100) {
      return current;
    }

    current = current.parentElement;
  }

  return el;
}

function jumpToTarget(target: HTMLElement) {
  const scrollContainer = getScrollableAncestor(target);

  if (!scrollContainer) {
    target.scrollIntoView({ behavior: "auto", block: "center" });
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();

  const targetTopInsideContainer =
    targetRect.top - containerRect.top + scrollContainer.scrollTop;

  scrollContainer.scrollTop =
    targetTopInsideContainer - scrollContainer.clientHeight / 2;
}

function setActiveTab(rawText: string) {
  lastActiveRawText = rawText;

  const items = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".smart-tab-item")
  );

  items.forEach((item) => {
    if (item.dataset.rawText === rawText) {
      item.classList.add("smart-tab-active");
    } else {
      item.classList.remove("smart-tab-active");
    }
  });
}

function getTopVisibleSection(scrollContainer: HTMLElement): Section | null {
  const containerRect = scrollContainer.getBoundingClientRect();

  let bestSection: Section | null = null;
  let smallestTop = Infinity;

  currentSections.forEach((section) => {
    const liveElement = findLiveElement(section);
    if (!liveElement) return;

    const target = getVisualTarget(liveElement);
    const rect = target.getBoundingClientRect();

    if (rect.height <= 0) return;

    const isVisible =
      rect.bottom >= containerRect.top &&
      rect.top <= containerRect.bottom;

    if (!isVisible) return;

    if (rect.top < smallestTop) {
      smallestTop = rect.top;
      bestSection = section;
    }
  });

  return bestSection;
}

function updateActiveFromScroll() {
  if (!activeScrollContainer) return;

  const section = getTopVisibleSection(activeScrollContainer);
  if (!section) return;

  setActiveTab(section.rawText);
}

function handleScroll() {
  if (scrollTimeout !== null) {
    window.clearTimeout(scrollTimeout);
  }

  scrollTimeout = window.setTimeout(() => {
    updateActiveFromScroll();
  }, 200);
}

function setupScrollTracking() {
  const firstLive = currentSections
    .map(findLiveElement)
    .find((el): el is HTMLElement => Boolean(el));

  if (!firstLive) return;

  const scrollContainer = getScrollableAncestor(firstLive);
  if (!scrollContainer) return;

  if (activeScrollContainer === scrollContainer) {
    updateActiveFromScroll();
    return;
  }

  if (activeScrollContainer) {
    activeScrollContainer.removeEventListener("scroll", handleScroll);
  }

  activeScrollContainer = scrollContainer;
  activeScrollContainer.addEventListener("scroll", handleScroll);

  updateActiveFromScroll();
}

export function renderSidebar(sections: Section[]) {
  currentSections = sections;

  let sidebar = document.getElementById(SIDEBAR_ID);

  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    document.body.appendChild(sidebar);
  }

  sidebar.innerHTML = "";

  const title = document.createElement("div");
  title.className = "smart-tabs-title";
  title.textContent = "Smart Tabs";
  sidebar.appendChild(title);

  const list = document.createElement("div");
  list.className = "smart-tabs-list";

  sections.forEach((section) => {
    const item = document.createElement("button");
    item.className = "smart-tab-item";
    item.textContent = section.title;
    item.dataset.rawText = section.rawText;

    item.addEventListener("click", () => {
      const liveElement = findLiveElement(section);
      if (!liveElement) return;

      const target = getVisualTarget(liveElement);

      jumpToTarget(target);
      setActiveTab(section.rawText);

      target.classList.add("smart-tab-highlight");
      setTimeout(() => {
        target.classList.remove("smart-tab-highlight");
        updateActiveFromScroll();
      }, 300);
    });

    list.appendChild(item);
  });

  sidebar.appendChild(list);

  if (sections.length > 0) {
    if (lastActiveRawText) {
      setActiveTab(lastActiveRawText);
    } else {
      setActiveTab(sections[0].rawText);
    }
  }

  setupScrollTracking();
}