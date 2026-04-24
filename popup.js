/* NextDNS Reporter — popup.js — v1.4.0 */
"use strict";

// ─── Éléments ────────────────────────────────────────────────────────────────
const statusDot     = document.getElementById("status-dot");
const statusLabel   = document.getElementById("status-label");
const statusDesc    = document.getElementById("status-desc");
const statusAction  = document.getElementById("status-action");
const oneClicToggle = document.getElementById("oneclic-toggle");

// ─── Version (toujours depuis le manifest, jamais codée en dur) ──────────────
document.getElementById("ext-version").textContent =
  "v" + chrome.runtime.getManifest().version;

// ─── Statut de la configuration ──────────────────────────────────────────────
function updateStatus(ep) {
  if (ep && ep.includes("formspree.io/f/")) {
    statusDot.className      = "dot ok";
    statusLabel.textContent  = "Extension active";
    statusDesc.textContent   = "Le bouton apparaît sur les pages bloquées par NextDNS.";
    statusAction.hidden      = true;
  } else if (ep) {
    statusDot.className      = "dot warn";
    statusLabel.textContent  = "Format inattendu";
    statusDesc.textContent   = "Vérifiez l'URL Formspree dans les paramètres.";
    statusAction.hidden      = true;
  } else {
    statusDot.className      = "dot off";
    statusLabel.textContent  = "Non configuré";
    statusDesc.textContent   = "";
    // Le bouton "Configure l'extension →" ouvre les paramètres
    statusAction.hidden      = false;
  }
}

// Lecture initiale du stockage
chrome.storage.local.get(["ndns_endpoint", "ndns_oneclic"], data => {
  updateStatus(data.ndns_endpoint || "");
  oneClicToggle.checked = !!data.ndns_oneclic;
});

// "Configure l'extension →" → ouvre la page de paramètres
statusAction.addEventListener("click", () => chrome.runtime.openOptionsPage());

// ─── Toggle one-click (sauvegarde immédiate au changement) ───────────────────
oneClicToggle.addEventListener("change", () => {
  chrome.storage.local.set({ ndns_oneclic: oneClicToggle.checked });
});

// ─── Panneau info hors page NextDNS ──────────────────────────────────────────
// Affiche un message si l'onglet actif n'est pas une page NextDNS.
// host_permissions "<all_urls>" suffit pour lire tab.url sans permission "tabs".
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const url = (tabs[0] && tabs[0].url) || "";
  if (!url.includes("nextdns.io")) {
    document.getElementById("info-panel").style.display = "block";
  }
});

// ─── Boutons du pied de page ─────────────────────────────────────────────────
document.getElementById("btn-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("btn-guide").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});

// ─── Bannière Firefox Android ────────────────────────────────────────────────
if (/Android/i.test(navigator.userAgent)) {
  document.getElementById("android-banner").style.display = "block";
}
document.getElementById("open-options-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
