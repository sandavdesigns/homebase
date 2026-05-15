const state = {
  setupComplete: true,
  title: "Homebase",
  subtitle: "",
  theme: "retro",
  activeProfileId: "default",
  profiles: [],
  categories: [],
  links: [],
  widgets: { clock: true, stats: true, quickNote: "" },
  auth: { enabled: false, authenticated: true },
  query: ""
};

const elements = {
  title: document.querySelector("#pageTitle"),
  subtitle: document.querySelector("#pageSubtitle"),
  date: document.querySelector("#dateLabel"),
  time: document.querySelector("#timeLabel"),
  groups: document.querySelector("#groups"),
  empty: document.querySelector("#emptyState"),
  locked: document.querySelector("#lockedState"),
  search: document.querySelector("#searchInput"),
  addButton: document.querySelector("#addButton"),
  categoriesButton: document.querySelector("#categoriesButton"),
  settingsButton: document.querySelector("#settingsButton"),
  importButton: document.querySelector("#importButton"),
  adminButton: document.querySelector("#adminButton"),
  profileSelect: document.querySelector("#profileSelect"),
  newProfileButton: document.querySelector("#newProfileButton"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  themeSelect: document.querySelector("#themeSelect"),
  widgets: document.querySelector("#widgets"),
  widgetClock: document.querySelector("#widgetClock"),
  widgetStats: document.querySelector("#widgetStats"),
  quickNoteInput: document.querySelector("#quickNoteInput"),
  setupDialog: document.querySelector("#setupDialog"),
  setupForm: document.querySelector("#setupForm"),
  setupTitle: document.querySelector("#setupTitle"),
  setupProfileName: document.querySelector("#setupProfileName"),
  setupPassword: document.querySelector("#setupPassword"),
  completeSetupButton: document.querySelector("#completeSetupButton"),
  editorDialog: document.querySelector("#editorDialog"),
  settingsDialog: document.querySelector("#settingsDialog"),
  categoriesDialog: document.querySelector("#categoriesDialog"),
  profileDialog: document.querySelector("#profileDialog"),
  importDialog: document.querySelector("#importDialog"),
  adminDialog: document.querySelector("#adminDialog"),
  adminPassword: document.querySelector("#adminPassword"),
  adminSubmitButton: document.querySelector("#adminSubmitButton"),
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
  testLinkButton: document.querySelector("#testLinkButton"),
  linkStatus: document.querySelector("#linkStatus"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsTitle: document.querySelector("#settingsTitle"),
  settingsSubtitle: document.querySelector("#settingsSubtitle"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  categoryEditor: document.querySelector("#categoryEditor"),
  addCategoryButton: document.querySelector("#addCategoryButton"),
  saveCategoriesButton: document.querySelector("#saveCategoriesButton"),
  profileName: document.querySelector("#profileName"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  importFile: document.querySelector("#importFile"),
  importText: document.querySelector("#importText"),
  runImportButton: document.querySelector("#runImportButton"),
  toast: document.querySelector("#toast")
};

let categoryDrafts = [];

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0] || {
    id: "default",
    name: "Start",
    categories: [],
    links: []
  };
}

function canEdit() {
  return !state.auth?.enabled || state.auth?.authenticated;
}

function updateClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(now);
  elements.time.textContent = time;
  elements.widgetClock.textContent = time;
  elements.date.textContent = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(now);
}

async function loadData() {
  const response = await fetch("/api/homebase");
  if (!response.ok) throw new Error("Startseite konnte nicht geladen werden.");
  Object.assign(state, await response.json());
  syncActiveProfileAliases();
  render();
  if (!state.setupComplete) elements.setupDialog.showModal();
}

function syncActiveProfileAliases() {
  const profile = activeProfile();
  state.categories = profile.categories || [];
  state.links = profile.links || [];
}

async function saveData(message = "Gespeichert") {
  if (!canEdit()) {
    openAdminDialog();
    return;
  }
  syncProfileFromAliases();
  const response = await fetch("/api/homebase", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: state.schemaVersion || 4,
      setupComplete: state.setupComplete,
      title: state.title,
      subtitle: state.subtitle,
      theme: state.theme,
      activeProfileId: state.activeProfileId,
      widgets: state.widgets,
      profiles: state.profiles
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Speichern fehlgeschlagen.");
  }

  Object.assign(state, await response.json());
  syncActiveProfileAliases();
  render();
  showToast(message);
}

function syncProfileFromAliases() {
  const index = state.profiles.findIndex((profile) => profile.id === state.activeProfileId);
  const nextProfile = {
    ...activeProfile(),
    categories: state.categories,
    links: state.links
  };
  if (index >= 0) state.profiles.splice(index, 1, nextProfile);
  else state.profiles.push(nextProfile);
}

function render() {
  document.title = state.title || "Homebase";
  document.body.dataset.theme = state.theme || "retro";
  elements.title.textContent = state.title;
  elements.subtitle.textContent = state.subtitle;
  elements.themeSelect.value = state.theme || "retro";
  renderAdminState();
  renderProfiles();
  renderCategoryList();
  renderWidgets();
  renderGroups();
}

function renderAdminState() {
  const editable = canEdit();
  document.body.classList.toggle("is-locked", !editable);
  elements.locked.hidden = editable;
  elements.adminButton.textContent = state.auth?.enabled ? (editable ? "Admin offen" : "Admin gesperrt") : "Admin aus";
  elements.adminButton.classList.toggle("is-unlocked", editable);
  elements.adminButton.setAttribute("aria-pressed", String(editable));
}

function renderProfiles() {
  elements.profileSelect.replaceChildren(
    ...state.profiles
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }))
      .map((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        return option;
      })
  );
  elements.profileSelect.value = state.activeProfileId;
  elements.deleteProfileButton.disabled = state.profiles.length <= 1 || !canEdit();
}

function renderWidgets() {
  elements.widgets.hidden = !state.widgets.clock && !state.widgets.stats && !state.widgets.quickNote;
  elements.widgets.querySelector('[data-widget="clock"]').hidden = !state.widgets.clock;
  elements.widgets.querySelector('[data-widget="stats"]').hidden = !state.widgets.stats;
  elements.widgets.querySelector('[data-widget="quickNote"]').hidden = state.widgets.quickNote === undefined;
  elements.widgetStats.textContent = `${state.links.length}`;
  elements.quickNoteInput.value = state.widgets.quickNote || "";
  elements.quickNoteInput.disabled = !canEdit();
}

function renderCategoryList() {
  elements.categoryList.replaceChildren(
    ...getCategoryNames().map((category) => {
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
    ...[...grouped.entries()].sort(([a], [b]) => compareNames(a, b)).map(([category, groupLinks]) => {
      const section = document.createElement("article");
      section.className = "group";
      const heading = document.createElement("h2");
      heading.textContent = `${category} (${groupLinks.length})`;
      const list = document.createElement("div");
      list.className = "link-list";
      if (groupLinks.length) {
        list.replaceChildren(...groupLinks.slice().sort((a, b) => compareNames(a.title, b.title)).map(createLinkCard));
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
  elements.empty.hidden = links.length > 0 || !query;
}

function compareNames(a, b) {
  return String(a).localeCompare(String(b), "de", { sensitivity: "base" });
}

function getCategoryNames() {
  const seen = new Set();
  const names = [];
  for (const category of state.categories || []) {
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
  return names.sort(compareNames);
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
  edit.className = "edit-link admin-only";
  edit.type = "button";
  edit.textContent = "...";
  edit.ariaLabel = `${link.title} bearbeiten`;
  edit.addEventListener("click", () => openLinkDialog(link));
  wrapper.append(anchor, edit);
  return wrapper;
}

function openLinkDialog(link = null) {
  if (!canEdit()) return openAdminDialog();
  elements.dialogTitle.textContent = link ? "Link bearbeiten" : "Link hinzufügen";
  elements.linkId.value = link?.id || "";
  elements.linkTitle.value = link?.title || "";
  elements.linkUrl.value = link?.url || "";
  elements.linkCategory.value = link?.category || getCategoryNames()[0] || "Links";
  elements.linkNote.value = link?.note || "";
  setLinkStatus("idle", "Nicht getestet");
  elements.deleteButton.hidden = !link;
  elements.editorDialog.showModal();
  elements.linkTitle.focus();
}

function openSettingsDialog() {
  if (!canEdit()) return openAdminDialog();
  elements.settingsTitle.value = state.title;
  elements.settingsSubtitle.value = state.subtitle;
  elements.settingsDialog.showModal();
}

function openCategoriesDialog() {
  if (!canEdit()) return openAdminDialog();
  categoryDrafts = getCategoryNames().map((name) => {
    const category = state.categories.find((candidate) => candidate.name === name);
    return { id: category?.id || createId(), originalName: name, name };
  });
  renderCategoryEditor();
  elements.categoriesDialog.showModal();
}

function renderCategoryEditor() {
  elements.categoryEditor.replaceChildren(
    ...categoryDrafts.sort((a, b) => compareNames(a.name, b.name)).map((category) => {
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
  categoryDrafts.push({ id: createId(), originalName: "", name: "Neue Kategorie" });
  renderCategoryEditor();
}

async function saveCategories() {
  const seen = new Set();
  const nextCategories = categoryDrafts
    .map((category) => ({ id: category.id || createId(), originalName: category.originalName, name: category.name.trim() }))
    .filter((category) => {
      if (!category.name || seen.has(category.name)) return false;
      seen.add(category.name);
      return true;
    });
  const renames = new Map();
  for (const category of nextCategories) {
    if (category.originalName && category.originalName !== category.name) renames.set(category.originalName, category.name);
  }
  const nextNames = new Set(nextCategories.map((category) => category.name));
  state.links = state.links.map((link) => {
    if (renames.has(link.category)) return { ...link, category: renames.get(link.category) };
    if (!nextNames.has(link.category)) return { ...link, category: "Links" };
    return link;
  });
  if (state.links.some((link) => link.category === "Links") && !nextNames.has("Links")) {
    nextCategories.push({ id: createId(), name: "Links" });
  }
  state.categories = nextCategories.map(({ id, name }) => ({ id, name })).sort((a, b) => compareNames(a.name, b.name));
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
  if (existingIndex >= 0) state.links.splice(existingIndex, 1, link);
  else state.links.push(link);
  await saveData("Link gespeichert");
  elements.editorDialog.close();
}

async function deleteLink() {
  state.links = state.links.filter((link) => link.id !== elements.linkId.value);
  await saveData("Link gelöscht");
  elements.editorDialog.close();
}

async function testLink() {
  const url = normalizeUrl(elements.linkUrl.value || "");
  if (!url) return setLinkStatus("bad", "Keine URL");
  setLinkStatus("idle", "Teste...");
  const response = await fetch(`/api/link-status?url=${encodeURIComponent(url)}`);
  const result = await response.json();
  setLinkStatus(result.ok ? "good" : "bad", result.ok ? `OK ${result.status}` : `Fehler ${result.status || ""}`.trim());
}

function setLinkStatus(kind, text) {
  elements.linkStatus.className = `status-pill is-${kind}`;
  elements.linkStatus.textContent = text;
}

async function saveSettings() {
  if (!elements.settingsForm.reportValidity()) return;
  state.title = elements.settingsTitle.value.trim();
  state.subtitle = elements.settingsSubtitle.value.trim();
  await saveData("Titel gespeichert");
  elements.settingsDialog.close();
}

function openProfileDialog() {
  if (!canEdit()) return openAdminDialog();
  elements.profileName.value = "";
  elements.profileDialog.showModal();
}

async function saveProfile() {
  const name = elements.profileName.value.trim();
  if (!name) return;
  const id = createId();
  state.profiles.push({ id, name, categories: [{ id: createId(), name: "Links" }], links: [] });
  state.activeProfileId = id;
  syncActiveProfileAliases();
  await saveData("Profil erstellt");
  elements.profileDialog.close();
}

async function deleteProfile() {
  if (!canEdit() || state.profiles.length <= 1) return;
  const current = activeProfile();
  if (!window.confirm(`Profil "${current.name}" wirklich löschen?`)) return;
  state.profiles = state.profiles.filter((profile) => profile.id !== current.id);
  state.activeProfileId = state.profiles[0].id;
  syncActiveProfileAliases();
  await saveData("Profil gelöscht");
}

async function runImport() {
  let text = elements.importText.value.trim();
  if (!text && elements.importFile.files[0]) text = await elements.importFile.files[0].text();
  if (!text) return showToast("Keine JSON-Daten");
  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text
  });
  if (!response.ok) throw new Error((await response.json()).error || "Import fehlgeschlagen");
  Object.assign(state, await response.json());
  syncActiveProfileAliases();
  render();
  elements.importDialog.close();
  showToast("Importiert");
}

async function completeSetup() {
  if (!elements.setupForm.reportValidity()) return;
  const response = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: elements.setupTitle.value.trim(),
      profileName: elements.setupProfileName.value.trim(),
      password: elements.setupPassword.value,
      categories: ["Links"],
      theme: state.theme || "retro"
    })
  });
  if (!response.ok) throw new Error((await response.json()).error || "Setup fehlgeschlagen");
  Object.assign(state, await response.json());
  state.auth = { ...(state.auth || {}), authenticated: true };
  syncActiveProfileAliases();
  render();
  elements.setupDialog.close();
  showToast("Homebase eingerichtet");
}

async function toggleAdmin() {
  if (state.auth?.enabled && state.auth?.authenticated) {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    state.auth = await response.json();
    render();
    showToast("Admin gesperrt");
    return;
  }
  openAdminDialog();
}

function openAdminDialog() {
  if (!state.auth?.enabled) return;
  elements.adminPassword.value = "";
  elements.adminDialog.showModal();
}

async function submitAdmin() {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: elements.adminPassword.value })
  });
  if (!response.ok) throw new Error("Passwort stimmt nicht");
  state.auth = await response.json();
  render();
  elements.adminDialog.close();
  showToast("Admin entsperrt");
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
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
elements.importButton.addEventListener("click", () => canEdit() ? elements.importDialog.showModal() : openAdminDialog());
elements.adminButton.addEventListener("click", () => toggleAdmin().catch((error) => showToast(error.message)));
elements.saveLinkButton.addEventListener("click", () => saveLink().catch((error) => showToast(error.message)));
elements.deleteButton.addEventListener("click", () => deleteLink().catch((error) => showToast(error.message)));
elements.testLinkButton.addEventListener("click", () => testLink().catch((error) => setLinkStatus("bad", error.message)));
elements.saveSettingsButton.addEventListener("click", () => saveSettings().catch((error) => showToast(error.message)));
elements.addCategoryButton.addEventListener("click", addCategory);
elements.saveCategoriesButton.addEventListener("click", () => saveCategories().catch((error) => showToast(error.message)));
elements.newProfileButton.addEventListener("click", openProfileDialog);
elements.saveProfileButton.addEventListener("click", () => saveProfile().catch((error) => showToast(error.message)));
elements.deleteProfileButton.addEventListener("click", () => deleteProfile().catch((error) => showToast(error.message)));
elements.profileSelect.addEventListener("change", async (event) => {
  state.activeProfileId = event.target.value;
  syncActiveProfileAliases();
  await saveData("Profil gewechselt");
});
elements.themeSelect.addEventListener("change", async (event) => {
  state.theme = event.target.value;
  await saveData("Theme gespeichert");
});
elements.quickNoteInput.addEventListener("change", async (event) => {
  state.widgets.quickNote = event.target.value;
  await saveData("Notiz gespeichert");
});
elements.runImportButton.addEventListener("click", () => runImport().catch((error) => showToast(error.message)));
elements.completeSetupButton.addEventListener("click", () => completeSetup().catch((error) => showToast(error.message)));
elements.adminSubmitButton.addEventListener("click", () => submitAdmin().catch((error) => showToast(error.message)));

updateClock();
window.setInterval(updateClock, 1000);
loadData().catch((error) => showToast(error.message));
