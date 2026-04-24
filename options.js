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

// ─── Test d'envoi ────────────────────────────────────────────────────────────
document.getElementById("opt-test").addEventListener("click", async () => {
  const ep  = epInput.value.trim();
  const msg = document.getElementById("opt-test-msg");

  if (!ep) {
    msg.style.color = "#fca5a5";
    msg.textContent = "✕ Aucun endpoint configuré — enregistrez d'abord un endpoint.";
    setTimeout(() => { msg.textContent = ""; }, 5000);
    return;
  }

  msg.style.color = "var(--muted)";
  msg.textContent = "Envoi en cours…";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(ep, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        Test:    "true",
        Source:  "NextDNS Reporter test button",
        Version: chrome.runtime.getManifest().version,
        Date:    new Date().toISOString()
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      msg.style.color = "#6ee7b7";
      msg.textContent = "✓ Test envoyé avec succès — vérifiez votre boîte mail.";
    } else {
      msg.style.color = "#fca5a5";
      msg.textContent = "✕ Erreur HTTP " + res.status + " — " + res.statusText;
    }
  } catch (err) {
    clearTimeout(timer);
    msg.style.color = "#fca5a5";
    msg.textContent = err.name === "AbortError"
      ? "✕ Délai dépassé (10 s) — vérifiez l'endpoint."
      : "✕ Erreur réseau : " + err.message;
  }
  setTimeout(() => { msg.textContent = ""; }, 7000);
});

// ─── Historique ──────────────────────────────────────────────────────────────
function renderHistory() {
  chrome.storage.local.get(["ndns_reported"], data => {
    const container = document.getElementById("history-list");
    const map = data.ndns_reported || {};

    // Compatibilité : ancien format = { domain: timestamp }, nouveau = { domain: { ts, url, … } }
    const entries = Object.entries(map).sort((a, b) => {
      const ta = typeof a[1] === "object" ? (a[1].ts || 0) : a[1];
      const tb = typeof b[1] === "object" ? (b[1].ts || 0) : b[1];
      return tb - ta;
    });

    container.textContent = "";

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Aucun signalement dans l'historique.";
      container.appendChild(empty);
      return;
    }

    entries.forEach(([domain, raw]) => {
      // Normalisation : ancien format = nombre brut, nouveau = objet
      const entry   = typeof raw === "object" ? raw : { ts: raw };
      const ts      = entry.ts || 0;
      const date    = new Date(ts).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const elapsed = Date.now() - ts;
      const hoursLeft = Math.max(0, Math.ceil((48 * 3600 * 1000 - elapsed) / 3600000));

      const item = document.createElement("div");
      item.className = "history-item";

      // ── Colonne gauche ──────────────────────────────────────────────────────
      const left = document.createElement("div");
      left.style.minWidth = "0"; // nécessaire pour que text-overflow fonctionne sur les enfants

      // Domaine
      const domEl = document.createElement("div");
      domEl.className = "history-domain";
      domEl.textContent = domain;
      left.appendChild(domEl);

      // URL tronquée (title = URL complète au survol)
      if (entry.url) {
        const urlEl = document.createElement("div");
        urlEl.className = "history-url";
        urlEl.title = entry.url;
        urlEl.textContent = entry.url;
        left.appendChild(urlEl);
      }

      // Motif de blocage
      if (entry.reason) {
        const reasonEl = document.createElement("div");
        reasonEl.className = "history-reason";
        reasonEl.textContent = "Motif : " + entry.reason;
        left.appendChild(reasonEl);
      }

      // Badges
      const metaEl = document.createElement("div");
      metaEl.className = "history-meta";

      // Badge statut envoi (sent / error)
      if (entry.status) {
        const statusBadge = document.createElement("span");
        statusBadge.className = entry.status === "sent" ? "badge badge-green" : "badge badge-red";
        statusBadge.textContent = entry.status === "sent" ? "Envoyé" : "Erreur";
        metaEl.appendChild(statusBadge);
      }

      // Badge accès direct proposé
      if (entry.hadDirectLink) {
        const linkBadge = document.createElement("span");
        linkBadge.className = "badge badge-amber";
        linkBadge.textContent = "↗ Accès direct proposé";
        metaEl.appendChild(linkBadge);
      }

      // Badge cooldown 48 h
      const coolBadge = document.createElement("span");
      coolBadge.className = hoursLeft > 0 ? "badge badge-amber" : "badge badge-green";
      coolBadge.textContent = hoursLeft > 0
        ? hoursLeft + "h avant re-signalement"
        : "Re-signalement possible";
      metaEl.appendChild(coolBadge);

      left.appendChild(metaEl);

      // ── Colonne droite : date ───────────────────────────────────────────────
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

// ─── Guide de démarrage ───────────────────────────────────────────────────────
document.getElementById("btn-guide-link").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});
