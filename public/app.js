const state = {
  title: "Startseite",
  subtitle: "",
  categories: [],
  links: [],
  query: ""
};

const elements = {
  title: document.querySelector("#pageTitle"),
  subtitle: document.querySelector("#pageSubtitle"),
  date: document.querySelector("#dateLabel"),
  time: document.querySelector("#timeLabel"),
  groups: document.querySelector("#groups"),
  empty: document.querySelector("#emptyState"),
  search: document.querySelector("#searchInput"),
  addButton: document.querySelector("#addButton"),
  categoriesButton: document.querySelector("#categoriesButton"),
  settingsButton: document.querySelector("#settingsButton"),
  editorDialog: document.querySelector("#editorDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
  categoriesDialog: document.querySelector("#categoriesDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  linkForm: document.querySelector("#linkForm"),
  linkId: document.querySelector("#linkId"),
  linkTitle: document.querySelector("#linkTitle"),
  linkUrl: document.querySelector("#linkUrl"),
  linkCategory: document.querySelector("#linkCategory"),
  linkNote: document.querySelector("#linkNote"),
  categoryList: document.querySelector("#categoryList"),
  deleteButton: document.querySelector("#deleteButton"),
  saveLinkButton: document.querySelector("#saveLinkButton"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsTitle: document.querySelector("#settingsTitle"),
  settingsSubtitle: document.querySelector("#settingsSubtitle"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  categoryEditor: document.querySelector("#categoryEditor"),
  addCategoryButton: document.querySelector("#addCategoryButton"),
  saveCategoriesButton: document.querySelector("#saveCategoriesButton"),
  toast: document.querySelector("#toast")
};

let categoryDrafts = [];

function updateClock() {
  const now = new Date();
  elements.time.textContent = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
  elements.date.textContent = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(now);
}

async function loadData() {
  const response = await fetch("/api/homebase");
  if (!response.ok) throw new Error("Startseite konnte nicht geladen werden.");
  const data = await response.json();
  Object.assign(state, data);
  render();
}

async function saveData(message = "Gespeichert") {
  const response = await fetch("/api/homebase", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: state.schemaVersion || 3,
      title: state.title,
      subtitle: state.subtitle,
      categories: state.categories,
      links: state.links
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Speichern fehlgeschlagen.");
  }

  Object.assign(state, await response.json());
  render();
  showToast(message);
}

function render() {
  document.title = state.title || "Homebase";
  elements.title.textContent = state.title;
  elements.subtitle.textContent = state.subtitle;
  renderCategoryList();
  renderGroups();
}

function renderCategoryList() {
  const categories = getCategoryNames();
  elements.categoryList.replaceChildren(
    ...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category;
      return option;
    })
  );
}

function renderGroups() {
  const query = state.query.trim().toLowerCase();
  const links = state.links.filter((link) => {
    const haystack = `${link.title} ${link.url} ${link.category} ${link.note}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  const grouped = links.reduce((groups, link) => {
    const category = link.category || "Links";
    groups.set(category, [...(groups.get(category) || []), link]);
    return groups;
  }, new Map());
  if (!query) {
    for (const category of getCategoryNames()) {
      if (!grouped.has(category)) grouped.set(category, []);
    }
  }

  elements.groups.replaceChildren(
    ...[...grouped.entries()].sort(([a], [b]) => compareCategories(a, b)).map(([category, groupLinks]) => {
      const section = document.createElement("article");
      section.className = "group";

      const heading = document.createElement("h2");
      heading.textContent = `${category} (${groupLinks.length})`;

      const list = document.createElement("div");
      list.className = "link-list";
      if (groupLinks.length) {
        list.replaceChildren(...groupLinks.sort((a, b) => a.title.localeCompare(b.title, "de")).map(createLinkCard));
      } else {
        const empty = document.createElement("p");
        empty.className = "empty-category";
        empty.textContent = "Noch leer";
        list.append(empty);
      }

      section.append(heading, list);
      return section;
    })
  );

  elements.empty.hidden = links.length > 0;
}

function compareCategories(a, b) {
  return a.localeCompare(b, "de", { sensitivity: "base" });
}

function getCategoryNames() {
  const names = [];
  const seen = new Set();
  const source = state.categories.length ? state.categories : [];

  for (const category of source) {
    const name = String(category.name || "").trim();
    if (name && !seen.has(name)) {
      names.push(name);
      seen.add(name);
    }
  }

  for (const link of state.links) {
    if (link.category && !seen.has(link.category)) {
      names.push(link.category);
      seen.add(link.category);
    }
  }

  return names.sort(compareCategories);
}

function createLinkCard(link) {
  const wrapper = document.createElement("div");
  wrapper.className = "link-card";

  const anchor = document.createElement("a");
  anchor.href = link.url;
  anchor.target = "_self";
  anchor.rel = "noreferrer";

  const title = document.createElement("p");
  title.className = "link-title";

  const icon = document.createElement("img");
  icon.className = "favicon";
  icon.alt = "";
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.src = `/api/favicon?url=${encodeURIComponent(link.url)}`;

  const titleText = document.createElement("span");
  titleText.textContent = link.title;
  title.append(icon, titleText);

  const meta = document.createElement("p");
  meta.className = "link-meta";
  meta.textContent = link.note || link.url;

  anchor.append(title, meta);
  anchor.className = "link-content";

  const edit = document.createElement("button");
  edit.className = "edit-link";
  edit.type = "button";
  edit.textContent = "...";
  edit.ariaLabel = `${link.title} bearbeiten`;
  edit.addEventListener("click", () => openLinkDialog(link));

  wrapper.append(anchor, edit);
  return wrapper;
}

function openLinkDialog(link = null) {
  elements.dialogTitle.textContent = link ? "Link bearbeiten" : "Link hinzufügen";
  elements.linkId.value = link?.id || "";
  elements.linkTitle.value = link?.title || "";
  elements.linkUrl.value = link?.url || "";
  elements.linkCategory.value = link?.category || getCategoryNames()[0] || "Links";
  elements.linkNote.value = link?.note || "";
  elements.deleteButton.hidden = !link;
  elements.editorDialog.showModal();
  elements.linkTitle.focus();
}

function openSettingsDialog() {
  elements.settingsTitle.value = state.title;
  elements.settingsSubtitle.value = state.subtitle;
  elements.settingsDialog.showModal();
  elements.settingsTitle.focus();
}

function openCategoriesDialog() {
  categoryDrafts = getCategoryNames().map((name) => {
    const category = state.categories.find((candidate) => candidate.name === name);
    return {
      id: category?.id || createId(),
      originalName: name,
      name
    };
  });
  renderCategoryEditor();
  elements.categoriesDialog.showModal();
}

function renderCategoryEditor() {
  elements.categoryEditor.replaceChildren(
    ...categoryDrafts.sort((a, b) => compareCategories(a.name, b.name)).map((category, index) => {
      const row = document.createElement("div");
      row.className = "category-row";

      const input = document.createElement("input");
      input.value = category.name;
      input.maxLength = 40;
      input.ariaLabel = "Kategoriename";
      input.addEventListener("input", (event) => {
        category.name = event.target.value;
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger subtle-danger";
      remove.textContent = "Löschen";
      remove.addEventListener("click", () => {
        categoryDrafts = categoryDrafts.filter((candidate) => candidate.id !== category.id);
        renderCategoryEditor();
      });

      row.append(input, remove);
      return row;
    })
  );
}

function addCategory() {
  categoryDrafts.push({
    id: createId(),
    originalName: "",
    name: "Neue Kategorie"
  });
  renderCategoryEditor();
}

async function saveCategories() {
  const seen = new Set();
  const nextCategories = categoryDrafts
    .map((category) => ({
      id: category.id || createId(),
      originalName: category.originalName,
      name: category.name.trim()
    }))
    .filter((category) => {
      if (!category.name || seen.has(category.name)) return false;
      seen.add(category.name);
      return true;
    });

  const renames = new Map();
  for (const category of nextCategories) {
    if (category.originalName && category.originalName !== category.name) {
      renames.set(category.originalName, category.name);
    }
  }
  const nextNames = new Set(nextCategories.map((category) => category.name));

  state.links = state.links.map((link) => {
    const renamedCategory = renames.get(link.category);
    if (renamedCategory) return { ...link, category: renamedCategory };
    if (!nextNames.has(link.category)) return { ...link, category: "Links" };
    return link;
  });

  if (state.links.some((link) => link.category === "Links") && !nextNames.has("Links")) {
    nextCategories.push({ id: createId(), name: "Links" });
  }

  state.categories = nextCategories.map(({ id, name }) => ({ id, name })).sort((a, b) => compareCategories(a.name, b.name));
  await saveData("Kategorien gespeichert");
  elements.categoriesDialog.close();
}

async function saveLink() {
  if (!elements.linkForm.reportValidity()) return;

  const link = {
    id: elements.linkId.value || createId(),
    title: elements.linkTitle.value.trim(),
    url: normalizeUrl(elements.linkUrl.value),
    category: elements.linkCategory.value.trim() || "Links",
    note: elements.linkNote.value.trim()
  };

  const existingIndex = state.links.findIndex((candidate) => candidate.id === link.id);
  if (existingIndex >= 0) {
    state.links.splice(existingIndex, 1, link);
  } else {
    state.links.push(link);
  }

  await saveData("Link gespeichert");
  elements.editorDialog.close();
}

async function deleteLink() {
  const id = elements.linkId.value;
  state.links = state.links.filter((link) => link.id !== id);
  await saveData("Link gelöscht");
  elements.editorDialog.close();
}

async function saveSettings() {
  if (!elements.settingsForm.reportValidity()) return;
  state.title = elements.settingsTitle.value.trim();
  state.subtitle = elements.settingsSubtitle.value.trim();
  await saveData("Titel gespeichert");
  elements.settingsDialog.close();
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 1600);
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderGroups();
});
elements.addButton.addEventListener("click", () => openLinkDialog());
elements.categoriesButton.addEventListener("click", openCategoriesDialog);
elements.settingsButton.addEventListener("click", openSettingsDialog);
elements.saveLinkButton.addEventListener("click", () => saveLink().catch((error) => showToast(error.message)));
elements.deleteButton.addEventListener("click", () => deleteLink().catch((error) => showToast(error.message)));
elements.saveSettingsButton.addEventListener("click", () => saveSettings().catch((error) => showToast(error.message)));
elements.addCategoryButton.addEventListener("click", addCategory);
elements.saveCategoriesButton.addEventListener("click", () => saveCategories().catch((error) => showToast(error.message)));

updateClock();
window.setInterval(updateClock, 1000);
loadData().catch((error) => showToast(error.message));
