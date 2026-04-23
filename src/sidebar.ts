import type { Section } from "./parser";

const SIDEBAR_ID = "smart-tabs-sidebar";

function clearActiveTabs() {
  document.querySelectorAll(".smart-tab-item").forEach((item) => {
    item.classList.remove("smart-tab-active");
  });
}

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

  const matches = nodes.filter((node) => {
    const text = normalizeText(node.textContent ?? "");
    return text.toLowerCase() === section.rawText.toLowerCase();
  });

  // Prefer actually visible/mounted elements
  const visibleMatch = matches.find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > 1 && rect.width > 1;
  });

  if (visibleMatch) return visibleMatch;

  if (section.element?.isConnected) return section.element;

  return matches[0] ?? null;
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

function scrollToTarget(target: HTMLElement) {
  const scrollContainer = getScrollableAncestor(target);

  if (!scrollContainer) {
    console.log("NO SCROLL CONTAINER FOUND");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const before = {
    containerScrollTop: scrollContainer.scrollTop,
    containerClientHeight: scrollContainer.clientHeight,
    containerScrollHeight: scrollContainer.scrollHeight,
    targetRect: target.getBoundingClientRect(),
    containerRect: scrollContainer.getBoundingClientRect()
  };

  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();

  const targetTopInsideContainer =
    targetRect.top - containerRect.top + scrollContainer.scrollTop;

  const desiredTop =
    targetTopInsideContainer - scrollContainer.clientHeight / 2;

  console.log("BEFORE SCROLL ATTEMPT", {
    before,
    targetTopInsideContainer,
    desiredTop
  });

  scrollContainer.scrollTop = desiredTop;

  setTimeout(() => {
    console.log("AFTER DIRECT SCROLLTOP", {
      actualScrollTop: scrollContainer.scrollTop,
      desiredTop,
      targetRectAfter: target.getBoundingClientRect()
    });
  }, 100);
}

export function renderSidebar(sections: Section[]) {
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

    item.addEventListener("click", () => {
      clearActiveTabs();
      item.classList.add("smart-tab-active");

      const liveElement = findLiveElement(section);

      if (!liveElement) {
        console.warn("Smart Tabs: message not currently mounted", section.rawText);
        return;
      }

      const target = getVisualTarget(liveElement);

      scrollToTarget(target);

      target.classList.add("smart-tab-highlight");
      setTimeout(() => {
        target.classList.remove("smart-tab-highlight");
      }, 1500);
    });

    list.appendChild(item);
  });

  sidebar.appendChild(list);
}