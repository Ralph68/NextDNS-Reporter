"use strict";

const mv = chrome.runtime.getManifest();
document.getElementById("opt-version").textContent = "v" + mv.version;

// ─── Navigation ─────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("page-" + btn.dataset.page).classList.add("active");
    if (btn.dataset.page === "history") renderHistory();
  });
});

// ─── Charger ─────────────────────────────────────────────────────────────────
const epInput    = document.getElementById("opt-ep");
const emailInput = document.getElementById("opt-email");
const nameInput  = document.getElementById("opt-name");
const oneClicChk = document.getElementById("opt-oneclic");
const epStatus   = document.getElementById("ep-status");

chrome.storage.local.get(["ndns_endpoint", "ndns_email", "ndns_username", "ndns_oneclic"], data => {
  epInput.value    = data.ndns_endpoint || "";
  emailInput.value = data.ndns_email    || "";
  nameInput.value  = data.ndns_username || "";
  oneClicChk.checked = !!data.ndns_oneclic;
  validateEp(epInput.value);
});

function validateEp(v) {
  epStatus.textContent = "";
  const span = document.createElement("span");
  if (!v) {
    span.className = "badge badge-red";
    span.textContent = "✕ Non configuré — les envois sont désactivés";
  } else if (v.includes("formspree.io/f/")) {
    span.className = "badge badge-green";
    span.textContent = "✓ Endpoint valide";
  } else {
    span.className = "badge badge-amber";
    span.textContent = "⚠ Format inattendu";
  }
  epStatus.appendChild(span);
}
epInput.addEventListener("input", () => validateEp(epInput.value));

// ─── Sauvegarder ─────────────────────────────────────────────────────────────
document.getElementById("opt-save").addEventListener("click", () => {
  let ep = epInput.value.trim();
  if (ep && !ep.startsWith("https://")) ep = `https://formspree.io/f/${ep}`;

  chrome.storage.local.set({
    ndns_endpoint:  ep,
    ndns_email:     emailInput.value.trim(),
    ndns_username:  nameInput.value.trim(),
    ndns_oneclic:   oneClicChk.checked
  }, () => {
    const msg = document.getElementById("opt-confirm");
    msg.style.color = "#6ee7b7";
    msg.textContent = "Paramètres enregistrés ✓";
    validateEp(ep);
    setTimeout(() => msg.textContent = "", 3000);
  });
});

// ─── Historique ──────────────────────────────────────────────────────────────
function renderHistory() {
  chrome.storage.local.get(["ndns_reported"], data => {
    const container = document.getElementById("history-list");
    const map = data.ndns_reported || {};
    const entries = Object.entries(map).sort((a,b) => b[1].ts - a[1].ts);
    container.textContent = "";

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Aucun signalement dans l'historique.";
      container.appendChild(empty);
      return;
    }

    entries.forEach(([domain, entry]) => {
      const date = new Date(entry.ts).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const elapsed = Date.now() - entry.ts;
      const hoursLeft = Math.max(0, Math.ceil((48*3600*1000 - elapsed) / 3600000));

      const item = document.createElement("div");
      item.className = "history-item";

      const left = document.createElement("div");

      const domEl = document.createElement("div");
      domEl.className = "history-domain";
      domEl.textContent = domain; // textContent — pas d'injection possible

      const metaEl = document.createElement("div");
      metaEl.className = "history-meta";
      metaEl.style.marginTop = "4px";

      const badge = document.createElement("span");
      badge.className = hoursLeft > 0 ? "badge badge-amber" : "badge badge-green";
      badge.textContent = hoursLeft > 0
        ? hoursLeft + "h avant de pouvoir re-signaler"
        : "Nouveau signalement possible";

      metaEl.appendChild(badge);
      left.appendChild(domEl);
      left.appendChild(metaEl);

      const timeEl = document.createElement("div");
      timeEl.className = "history-time";
      timeEl.textContent = date;

      item.appendChild(left);
      item.appendChild(timeEl);
      container.appendChild(item);
    });
  });
}

document.getElementById("clear-history").addEventListener("click", () => {
  if (!confirm("Effacer tout l'historique des signalements ?")) return;
  chrome.storage.local.set({ ndns_reported: {} }, () => {
    renderHistory();
    const msg = document.getElementById("history-confirm");
    msg.style.color = "#6ee7b7";
    msg.textContent = "Historique effacé.";
    setTimeout(() => msg.textContent = "", 3000);
  });
});

function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
