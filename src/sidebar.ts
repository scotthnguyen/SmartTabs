import type { Section } from "./parser";

const SIDEBAR_ID = "smart-tabs-sidebar";

function clearActiveTabs() {
  document.querySelectorAll(".smart-tab-item").forEach((item) => {
    item.classList.remove("smart-tab-active");
  });
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

      section.element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      section.element.classList.add("smart-tab-highlight");
      setTimeout(() => {
        section.element.classList.remove("smart-tab-highlight");
      }, 1500);
    });

    list.appendChild(item);
  });

  sidebar.appendChild(list);
}