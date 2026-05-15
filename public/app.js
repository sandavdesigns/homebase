const state = {
  title: "Startseite",
  subtitle: "",
  links: [],
  query: ""
};

const preferredCategoryOrder = [
  "Business",
  "Server",
  "Netzwerk",
  "Smart Home",
  "Sicherheit",
  "Werkstatt",
  "Medien"
];

const elements = {
  title: document.querySelector("#pageTitle"),
  subtitle: document.querySelector("#pageSubtitle"),
  date: document.querySelector("#dateLabel"),
  time: document.querySelector("#timeLabel"),
  groups: document.querySelector("#groups"),
  empty: document.querySelector("#emptyState"),
  search: document.querySelector("#searchInput"),
  addButton: document.querySelector("#addButton"),
  settingsButton: document.querySelector("#settingsButton"),
  editorDialog: document.querySelector("#editorDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
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
  toast: document.querySelector("#toast")
};

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
      schemaVersion: state.schemaVersion || 2,
      title: state.title,
      subtitle: state.subtitle,
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
  const categories = [...new Set(state.links.map((link) => link.category).filter(Boolean))].sort(compareCategories);
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

  elements.groups.replaceChildren(
    ...[...grouped.entries()].sort(([a], [b]) => compareCategories(a, b)).map(([category, groupLinks]) => {
      const section = document.createElement("article");
      section.className = "group";

      const heading = document.createElement("h2");
      heading.textContent = `${category} (${groupLinks.length})`;

      const list = document.createElement("div");
      list.className = "link-list";
      list.replaceChildren(...groupLinks.sort((a, b) => a.title.localeCompare(b.title, "de")).map(createLinkCard));

      section.append(heading, list);
      return section;
    })
  );

  elements.empty.hidden = links.length > 0;
}

function compareCategories(a, b) {
  const aIndex = preferredCategoryOrder.indexOf(a);
  const bIndex = preferredCategoryOrder.indexOf(b);
  if (aIndex >= 0 || bIndex >= 0) {
    return (aIndex >= 0 ? aIndex : 999) - (bIndex >= 0 ? bIndex : 999);
  }
  return a.localeCompare(b, "de");
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
  title.textContent = link.title;

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
  elements.linkCategory.value = link?.category || "Zuhause";
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
elements.settingsButton.addEventListener("click", openSettingsDialog);
elements.saveLinkButton.addEventListener("click", () => saveLink().catch((error) => showToast(error.message)));
elements.deleteButton.addEventListener("click", () => deleteLink().catch((error) => showToast(error.message)));
elements.saveSettingsButton.addEventListener("click", () => saveSettings().catch((error) => showToast(error.message)));

updateClock();
window.setInterval(updateClock, 1000);
loadData().catch((error) => showToast(error.message));
