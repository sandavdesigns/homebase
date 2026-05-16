const state = {
  setupComplete: true,
  title: "Homebase",
  subtitle: "",
  theme: "retro",
  activeProfileId: "default",
  profiles: [],
  categories: [],
  links: [],
  widgets: { clock: true, notes: [] },
  preferences: { showCategoryCounts: false, showLinkStatus: true, showNotes: true, openLinksInNewTab: true },
  auth: { enabled: false, authenticated: true },
  status: { configured: 0, updatedAt: "", items: [] },
  statusLoading: false,
  query: "",
  searchOpen: false
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
  searchPanel: document.querySelector("#searchPanel"),
  searchToggleButton: document.querySelector("#searchToggleButton"),
  addButton: document.querySelector("#addButton"),
  newNoteButton: document.querySelector("#newNoteButton"),
  settingsButton: document.querySelector("#settingsButton"),
  adminButton: document.querySelector("#adminButton"),
  profileSelect: document.querySelector("#profileSelect"),
  newProfileButton: document.querySelector("#newProfileButton"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  themeSelect: document.querySelector("#themeSelect"),
  widgets: document.querySelector("#widgets"),
  statusWidget: document.querySelector("#statusWidget"),
  statusList: document.querySelector("#statusList"),
  statusUpdated: document.querySelector("#statusUpdated"),
  refreshStatusButton: document.querySelector("#refreshStatusButton"),
  notesWidget: document.querySelector("#notesWidget"),
  notesList: document.querySelector("#notesList"),
  noteInput: document.querySelector("#noteInput"),
  addNoteButton: document.querySelector("#addNoteButton"),
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
  linkStatusEnabled: document.querySelector("#linkStatusEnabled"),
  linkStatusFields: document.querySelector("#linkStatusFields"),
  linkStatusType: document.querySelector("#linkStatusType"),
  linkStatusUrl: document.querySelector("#linkStatusUrl"),
  linkStatusTokenId: document.querySelector("#linkStatusTokenId"),
  linkStatusTokenSecret: document.querySelector("#linkStatusTokenSecret"),
  linkStatusApiKey: document.querySelector("#linkStatusApiKey"),
  linkStatusUsername: document.querySelector("#linkStatusUsername"),
  linkStatusPassword: document.querySelector("#linkStatusPassword"),
  linkStatusPath: document.querySelector("#linkStatusPath"),
  linkStatusDebug: document.querySelector("#linkStatusDebug"),
  deleteButton: document.querySelector("#deleteButton"),
  saveLinkButton: document.querySelector("#saveLinkButton"),
  testLinkButton: document.querySelector("#testLinkButton"),
  linkStatus: document.querySelector("#linkStatus"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsTitle: document.querySelector("#settingsTitle"),
  settingsSubtitle: document.querySelector("#settingsSubtitle"),
  settingShowCategoryCounts: document.querySelector("#settingShowCategoryCounts"),
  settingShowLinkStatus: document.querySelector("#settingShowLinkStatus"),
  settingShowNotes: document.querySelector("#settingShowNotes"),
  settingOpenLinksInNewTab: document.querySelector("#settingOpenLinksInNewTab"),
  settingsCategoriesButton: document.querySelector("#settingsCategoriesButton"),
  settingsImportButton: document.querySelector("#settingsImportButton"),
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
  loadStatus().catch(() => {});
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
      preferences: state.preferences,
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

async function loadStatus() {
  state.statusLoading = true;
  renderStatus();
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error("Status konnte nicht geladen werden");
    state.status = await response.json();
  } finally {
    state.statusLoading = false;
    renderStatus();
    renderGroups();
  }
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
  renderSearch();
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
  const notes = getNotes();
  renderStatus();
  const notesHidden = state.preferences?.showNotes === false || (!notes.length && !state.noteComposerOpen);
  elements.notesWidget.hidden = notesHidden;
  elements.widgets.hidden = notesHidden && elements.statusWidget.hidden;
  elements.noteInput.disabled = !canEdit();
  elements.addNoteButton.disabled = !canEdit();
  elements.notesList.replaceChildren(...notes.map(createNoteCard));
}

function renderStatus() {
  const items = Array.isArray(state.status.items) ? state.status.items : [];
  elements.statusWidget.hidden = true;
  elements.refreshStatusButton.disabled = state.statusLoading;
  elements.refreshStatusButton.textContent = state.statusLoading ? "Lädt..." : "Aktualisieren";
  elements.statusList.replaceChildren(
    ...(items.length ? items.map(createStatusCard) : [createEmptyStatus()])
  );
  elements.statusUpdated.textContent = state.status.updatedAt
    ? `Stand ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(state.status.updatedAt))}`
    : "";
}

function createStatusCard(item) {
  const card = document.createElement("article");
  card.className = `service-card is-${item.status || "offline"}`;

  const head = document.createElement("div");
  head.className = "service-head";
  const title = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = item.name;
  const type = document.createElement("span");
  type.textContent = formatStatusType(item.type);
  title.append(name, type);
  const badge = document.createElement("span");
  badge.className = "service-badge";
  badge.textContent = item.status === "online" ? "Online" : item.status === "warning" ? "Warnung" : "Offline";
  head.append(title, badge);

  const message = document.createElement("p");
  message.className = "service-message";
  message.textContent = item.message || (item.ok ? "Erreichbar" : "Nicht erreichbar");

  const metrics = document.createElement("div");
  metrics.className = "service-metrics";
  const metricItems = Array.isArray(item.metrics) ? item.metrics : [];
  metrics.replaceChildren(
    ...(metricItems.length ? metricItems.map(createStatusMetric) : [createStatusMetric({ label: "Status", value: item.ok ? "OK" : "Fehler" })])
  );

  card.append(head, message, metrics);
  const details = createStatusDetails(item.details);
  if (details) card.append(details);
  return card;
}

function createStatusMetric(metric) {
  const item = document.createElement("span");
  item.className = "service-metric";
  const label = document.createElement("small");
  label.textContent = metric.label;
  const value = document.createElement("strong");
  value.textContent = metric.value;
  item.append(label, value);
  return item;
}

function createStatusDetails(details) {
  const detailItems = Array.isArray(details) ? details.slice(0, 6) : [];
  if (!detailItems.length) return null;
  const list = document.createElement("div");
  list.className = "status-details";
  list.replaceChildren(...detailItems.map((detail) => {
    const row = document.createElement("p");
    if (typeof detail.online === "boolean") row.classList.add(detail.online ? "is-online" : "is-offline");
    const label = document.createElement("span");
    label.className = "status-detail-name";
    if (typeof detail.online === "boolean") {
      const dot = document.createElement("i");
      dot.className = "status-detail-dot";
      dot.ariaHidden = "true";
      label.append(dot);
    }
    const name = document.createElement("span");
    name.textContent = detail.label || "Status";
    label.append(name);
    const value = document.createElement("strong");
    value.className = "status-detail-value";
    if (detail.memory) {
      const memory = document.createElement("span");
      memory.textContent = detail.memory;
      value.append(memory);
    }
    if (detail.users !== undefined && detail.users !== "") {
      const users = document.createElement("span");
      users.className = "status-detail-users";
      users.ariaLabel = `${detail.users} User`;
      const icon = document.createElement("i");
      icon.className = "user-icon";
      icon.ariaHidden = "true";
      const count = document.createElement("span");
      count.textContent = detail.users;
      users.append(icon, count);
      value.append(users);
    }
    if (!value.childElementCount) value.textContent = detail.value || "";
    row.append(label, value);
    return row;
  }));
  return list;
}

function createEmptyStatus() {
  const empty = document.createElement("p");
  empty.className = "empty-note";
  empty.textContent = "Keine Statusquellen konfiguriert";
  return empty;
}

function formatStatusType(type) {
  const names = {
    proxmox: "Proxmox",
    unraid: "Unraid",
    amp: "AMP",
    basic: "Service"
  };
  return names[type] || type || "Service";
}

function renderSearch() {
  const open = state.searchOpen || Boolean(state.query);
  elements.searchPanel.hidden = !open;
  elements.searchToggleButton.setAttribute("aria-expanded", String(open));
  elements.searchToggleButton.textContent = open ? "Suche ausblenden" : "Suche";
}

function getNotes() {
  const notes = Array.isArray(state.widgets.notes) ? state.widgets.notes : [];
  if (!notes.length && state.widgets.quickNote) {
    return [{ id: createId(), text: state.widgets.quickNote }];
  }
  return notes;
}

function createNoteCard(note) {
  const card = document.createElement("div");
  card.className = "note-card";
  const text = document.createElement("p");
  text.textContent = note.text;
  const remove = document.createElement("button");
  remove.className = "icon-button admin-only";
  remove.type = "button";
  remove.textContent = "x";
  remove.ariaLabel = "Notiz löschen";
  remove.addEventListener("click", async () => {
    const nextNotes = getNotes().filter((candidate) => candidate.id !== note.id);
    state.widgets.notes = nextNotes;
    if (!nextNotes.length) state.noteComposerOpen = false;
    await saveData("Notiz gelöscht");
  });
  card.append(text, remove);
  return card;
}

function renderCategoryList() {
  elements.linkCategory.replaceChildren(
    ...getCategoryNames().map((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      return option;
    })
  );
}

function renderGroups() {
  const query = state.query.trim().toLowerCase();
  const links = state.links.filter((link) => {
    const haystack = `${link.title} ${link.category} ${link.note}`.toLowerCase();
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
      heading.textContent = state.preferences?.showCategoryCounts ? `${category} (${groupLinks.length})` : category;
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
  const status = state.preferences?.showLinkStatus === false ? null : getStatusForLink(link);
  if (status) wrapper.classList.add(`has-status`, `is-${status.status || "offline"}`);
  const anchor = document.createElement("a");
  anchor.href = link.url;
  if (state.preferences?.openLinksInNewTab !== false) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }

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

  anchor.append(title);
  if (link.note) {
    const note = document.createElement("p");
    note.className = "link-note";
    note.textContent = link.note;
    anchor.append(note);
  }
  if (status) anchor.append(createLinkStatus(status));
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

function getStatusForLink(link) {
  const items = Array.isArray(state.status.items) ? state.status.items : [];
  const linkOrigin = getUrlOrigin(link.url);
  const title = normalizeMatchText(link.title);
  return items.find((item) => {
    if (item.id && item.id === link.id) return true;
    const itemOrigin = getUrlOrigin(item.url);
    if (linkOrigin && itemOrigin && linkOrigin === itemOrigin) return true;
    const itemName = normalizeMatchText(item.name);
    return itemName && title && itemName === title;
  });
}

function createLinkStatus(status) {
  const panel = document.createElement("div");
  panel.className = "link-status-panel";

  const line = document.createElement("p");
  line.className = "link-status-line";
  const dot = document.createElement("span");
  dot.className = "link-status-dot";
  const message = document.createElement("span");
  message.textContent = status.message || (status.ok ? "Online" : "Offline");
  line.append(dot, message);

  const metrics = document.createElement("div");
  metrics.className = "link-status-metrics";
  const metricItems = (Array.isArray(status.metrics) ? status.metrics : [])
    .filter((metric) => String(metric.label).toLowerCase() !== "user")
    .slice(0, 5);
  metrics.replaceChildren(...metricItems.map((metric) => {
    const item = document.createElement("span");
    const metricKind = getStatusMetricKind(metric.label);
    if (metricKind) {
      item.className = `link-status-metric is-${metricKind}`;
      item.ariaLabel = `${metric.label} ${metric.value}`;
      const icon = document.createElement("i");
      icon.className = `metric-icon metric-icon-${metricKind}`;
      icon.ariaHidden = "true";
      const value = document.createElement("span");
      value.textContent = metric.value;
      item.append(icon, value);
    } else {
      item.textContent = `${metric.label} ${metric.value}`;
    }
    return item;
  }));

  panel.append(line);
  if (metricItems.length) panel.append(metrics);
  const details = createStatusDetails(status.details);
  if (details) panel.append(details);
  if (Array.isArray(status.debug) && status.debug.length) {
    const debug = document.createElement("pre");
    debug.className = "link-status-debug";
    debug.textContent = status.debug.join("\n");
    panel.append(debug);
  }
  return panel;
}

function getStatusMetricKind(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized === "server") return "server";
  if (normalized === "cpu") return "cpu";
  if (normalized === "ram" || normalized === "speicher") return "ram";
  return "";
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeMatchText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function openLinkDialog(link = null) {
  if (!canEdit()) return openAdminDialog();
  elements.dialogTitle.textContent = link ? "Link bearbeiten" : "Link hinzufügen";
  elements.linkId.value = link?.id || "";
  elements.linkTitle.value = link?.title || "";
  elements.linkUrl.value = link?.url || "";
  renderCategoryList();
  elements.linkCategory.value = link?.category || getCategoryNames()[0] || "Links";
  elements.linkNote.value = link?.note || "";
  setLinkStatusWidgetForm(link?.statusWidget);
  setLinkStatus("idle", "Nicht getestet");
  elements.deleteButton.hidden = !link;
  elements.editorDialog.showModal();
  elements.linkTitle.focus();
}

function setLinkStatusWidgetForm(widget = {}) {
  elements.linkStatusEnabled.checked = widget?.enabled === true;
  elements.linkStatusType.value = widget?.type || "basic";
  elements.linkStatusUrl.value = widget?.url || "";
  elements.linkStatusTokenId.value = widget?.tokenId || "";
  elements.linkStatusTokenSecret.value = widget?.tokenSecret || "";
  elements.linkStatusApiKey.value = widget?.apiKey || "";
  elements.linkStatusUsername.value = widget?.username || "";
  elements.linkStatusPassword.value = widget?.password || "";
  elements.linkStatusPath.value = widget?.statusPath || "";
  elements.linkStatusDebug.checked = widget?.debug === true;
  renderLinkStatusFields();
}

function renderLinkStatusFields() {
  const enabled = elements.linkStatusEnabled.checked;
  const type = elements.linkStatusType.value || "basic";
  elements.linkStatusFields.hidden = !enabled;
  elements.linkStatusFields.querySelectorAll("[data-status-field]").forEach((field) => {
    field.hidden = field.dataset.statusField !== type;
  });
}

function openSettingsDialog() {
  if (!canEdit()) return openAdminDialog();
  elements.settingsTitle.value = state.title;
  elements.settingsSubtitle.value = state.subtitle;
  elements.themeSelect.value = state.theme || "retro";
  elements.settingShowCategoryCounts.checked = state.preferences?.showCategoryCounts === true;
  elements.settingShowLinkStatus.checked = state.preferences?.showLinkStatus !== false;
  elements.settingShowNotes.checked = state.preferences?.showNotes !== false;
  elements.settingOpenLinksInNewTab.checked = state.preferences?.openLinksInNewTab !== false;
  elements.settingsDialog.showModal();
}

function openNoteComposer() {
  if (!canEdit()) return openAdminDialog();
  state.preferences = {
    ...(state.preferences || {}),
    showNotes: true
  };
  state.noteComposerOpen = true;
  elements.settingsDialog.close();
  renderWidgets();
  window.requestAnimationFrame(() => elements.noteInput.focus());
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
    note: elements.linkNote.value.trim(),
    statusWidget: {
      enabled: elements.linkStatusEnabled.checked,
      type: elements.linkStatusType.value,
      url: normalizeUrl(elements.linkStatusUrl.value || elements.linkUrl.value),
      tokenId: elements.linkStatusTokenId.value.trim(),
      tokenSecret: elements.linkStatusTokenSecret.value.trim(),
      apiKey: elements.linkStatusApiKey.value.trim(),
      username: elements.linkStatusUsername.value.trim(),
      password: elements.linkStatusPassword.value,
      statusPath: elements.linkStatusPath.value.trim(),
      debug: elements.linkStatusDebug.checked
    }
  };
  const existingIndex = state.links.findIndex((candidate) => candidate.id === link.id);
  if (existingIndex >= 0) state.links.splice(existingIndex, 1, link);
  else state.links.push(link);
  await saveData("Link gespeichert");
  elements.editorDialog.close();
  loadStatus().catch(() => {});
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
  state.theme = elements.themeSelect.value || "retro";
  state.preferences = {
    ...(state.preferences || {}),
    showCategoryCounts: elements.settingShowCategoryCounts.checked,
    showLinkStatus: elements.settingShowLinkStatus.checked,
    showNotes: elements.settingShowNotes.checked,
    openLinksInNewTab: elements.settingOpenLinksInNewTab.checked
  };
  await saveData("Einstellungen gespeichert");
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
elements.searchToggleButton.addEventListener("click", () => {
  state.searchOpen = !state.searchOpen;
  if (!state.searchOpen) {
    state.query = "";
    elements.search.value = "";
    renderGroups();
  }
  renderSearch();
  if (state.searchOpen) elements.search.focus();
});
elements.addButton.addEventListener("click", () => openLinkDialog());
elements.settingsButton.addEventListener("click", openSettingsDialog);
elements.newNoteButton.addEventListener("click", openNoteComposer);
elements.settingsCategoriesButton.addEventListener("click", () => {
  elements.settingsDialog.close();
  openCategoriesDialog();
});
elements.settingsImportButton.addEventListener("click", () => {
  elements.settingsDialog.close();
  if (canEdit()) elements.importDialog.showModal();
  else openAdminDialog();
});
elements.refreshStatusButton.addEventListener("click", () => loadStatus().catch((error) => showToast(error.message)));
elements.adminButton.addEventListener("click", () => toggleAdmin().catch((error) => showToast(error.message)));
elements.saveLinkButton.addEventListener("click", () => saveLink().catch((error) => showToast(error.message)));
elements.deleteButton.addEventListener("click", () => deleteLink().catch((error) => showToast(error.message)));
elements.testLinkButton.addEventListener("click", () => testLink().catch((error) => setLinkStatus("bad", error.message)));
elements.linkStatusEnabled.addEventListener("change", renderLinkStatusFields);
elements.linkStatusType.addEventListener("change", renderLinkStatusFields);
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
elements.addNoteButton.addEventListener("click", async () => {
  if (!canEdit()) return openAdminDialog();
  const text = elements.noteInput.value.trim();
  if (!text) return;
  state.widgets.notes = [...getNotes(), { id: createId(), text }];
  delete state.widgets.quickNote;
  state.noteComposerOpen = false;
  elements.noteInput.value = "";
  await saveData("Notiz gespeichert");
});
elements.runImportButton.addEventListener("click", () => runImport().catch((error) => showToast(error.message)));
elements.completeSetupButton.addEventListener("click", () => completeSetup().catch((error) => showToast(error.message)));
elements.adminSubmitButton.addEventListener("click", () => submitAdmin().catch((error) => showToast(error.message)));

updateClock();
window.setInterval(updateClock, 1000);
window.setInterval(() => loadStatus().catch(() => {}), 60000);
loadData().catch((error) => showToast(error.message));
