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
  if (!v) {
    epStatus.innerHTML = `<span class="badge badge-red">✕ Non configuré — les envois sont désactivés</span>`;
  } else if (v.includes("formspree.io/f/")) {
    epStatus.innerHTML = `<span class="badge badge-green">✓ Endpoint valide</span>`;
  } else {
    epStatus.innerHTML = `<span class="badge badge-amber">⚠ Format inattendu</span>`;
  }
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

    if (!entries.length) {
      container.innerHTML = `<div class="empty-state">Aucun signalement dans l'historique.</div>`;
      return;
    }

    container.innerHTML = entries.map(([domain, entry]) => {
      const date = new Date(entry.ts).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const elapsed = Date.now() - entry.ts;
      const hoursLeft = Math.max(0, Math.ceil((48*3600*1000 - elapsed) / 3600000));
      const badge = hoursLeft > 0
        ? `<span class="badge badge-amber">${hoursLeft}h avant de pouvoir re-signaler</span>`
        : `<span class="badge badge-green">Nouveau signalement possible</span>`;
      return `
        <div class="history-item">
          <div>
            <div class="history-domain">${esc(domain)}</div>
            <div class="history-meta" style="margin-top:4px">${badge}</div>
          </div>
          <div class="history-time">${date}</div>
        </div>`;
    }).join("");
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
