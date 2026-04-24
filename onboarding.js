/* NextDNS Reporter — onboarding.js — v1.4.0
 * Logique du guide de démarrage guidé (4 étapes).
 */
"use strict";

let current = 0;
let certChoice = null;

// ─── Navigation ─────────────────────────────────────────────────────────────
function goTo(n) {
  document.getElementById("step-" + current).classList.remove("active");
  document.querySelectorAll(".ob-step-dot").forEach((dot, i) => {
    dot.classList.remove("active", "done");
    if (i < n)       dot.classList.add("done");
    else if (i === n) dot.classList.add("active");
  });
  current = n;
  document.getElementById("step-" + current).classList.add("active");
  if (current === 3) buildSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── Étape 1 — Comment ça marche ────────────────────────────────────────────
document.getElementById("next-0").addEventListener("click", () => goTo(1));

// ─── Étape 2 — Certificat ───────────────────────────────────────────────────
["cert-installed", "cert-managed", "cert-need"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.querySelectorAll(".ob-choice-btn").forEach(b => b.classList.remove("selected"));
    document.getElementById(id).classList.add("selected");
    certChoice = id;
    document.getElementById("managed-msg").style.display =
      id === "cert-managed" ? "block" : "none";
    if (id === "cert-need") {
      window.open("https://help.nextdns.io/t/g9hmv0a/how-to-install-and-trust-nextdns-root-ca", "_blank");
    }
  });
});

document.getElementById("prev-1").addEventListener("click", () => goTo(0));
document.getElementById("next-1").addEventListener("click", () => goTo(2));

// ─── Étape 3 — Configuration endpoint ───────────────────────────────────────
const epInput     = document.getElementById("ob-ep");
const epStatus    = document.getElementById("ob-ep-status");
const saveConfirm = document.getElementById("ob-save-confirm");

function validateEp(v) {
  epStatus.textContent = "";
  const badge = document.createElement("span");
  if (!v) {
    badge.className = "ob-badge ob-badge-red";
    badge.textContent = "✕ Non configuré";
  } else if (v.includes("formspree.io/f/")) {
    badge.className = "ob-badge ob-badge-green";
    badge.textContent = "✓ Endpoint valide";
  } else if (v.startsWith("https://")) {
    badge.className = "ob-badge ob-badge-amber";
    badge.textContent = "⚠ Format inattendu — vérifiez l'URL";
  } else {
    badge.className = "ob-badge ob-badge-red";
    badge.textContent = "✕ URL invalide";
  }
  epStatus.appendChild(badge);
}

epInput.addEventListener("input", () => validateEp(epInput.value.trim()));

// Pré-remplir depuis le storage si valeurs existantes
chrome.storage.local.get(["ndns_endpoint", "ndns_email", "ndns_username"], data => {
  if (data.ndns_endpoint) { epInput.value = data.ndns_endpoint; validateEp(data.ndns_endpoint); }
  if (data.ndns_email)    document.getElementById("ob-email").value = data.ndns_email;
  if (data.ndns_username) document.getElementById("ob-name").value  = data.ndns_username;
});

document.getElementById("ob-save").addEventListener("click", () => {
  let ep = epInput.value.trim();
  if (ep && !ep.startsWith("https://")) ep = "https://formspree.io/f/" + ep;
  if (ep) epInput.value = ep;

  const email = document.getElementById("ob-email").value.trim();
  const name  = document.getElementById("ob-name").value.trim();

  chrome.storage.local.set({ ndns_endpoint: ep, ndns_email: email, ndns_username: name }, () => {
    saveConfirm.textContent = "✓ Enregistré";
    saveConfirm.style.color = "#6ee7b7";
    validateEp(ep);
    setTimeout(() => { saveConfirm.textContent = ""; }, 3000);
  });
});

document.getElementById("prev-2").addEventListener("click", () => goTo(1));
document.getElementById("next-2").addEventListener("click", () => {
  // Sauvegarde automatique avant de passer à l'étape 4
  const ep = epInput.value.trim();
  if (ep) {
    const email = document.getElementById("ob-email").value.trim();
    const name  = document.getElementById("ob-name").value.trim();
    chrome.storage.local.set({ ndns_endpoint: ep, ndns_email: email, ndns_username: name });
  }
  goTo(3);
});

// ─── Étape 4 — Résumé ───────────────────────────────────────────────────────
function buildSummary() {
  chrome.storage.local.get(["ndns_endpoint", "ndns_email", "ndns_username"], data => {
    const container = document.getElementById("ob-summary");
    container.textContent = "";

    const certLabel = certChoice === "cert-installed" ? "Installé ✓"
                    : certChoice === "cert-managed"   ? "Géré par l'admin ✓"
                    : certChoice === "cert-need"       ? "À vérifier"
                    : "Non confirmé";

    const rows = [
      ["Endpoint",  data.ndns_endpoint || "Non configuré"],
      ["Email",     data.ndns_email    || "Non configuré"],
      ["Prénom",    data.ndns_username || "Non renseigné"],
      ["Certificat", certLabel]
    ];

    rows.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "ob-summary-row";

      const l = document.createElement("span");
      l.textContent = label;

      const v = document.createElement("span");
      v.textContent = value;
      if (value === "Non configuré" || value === "À vérifier") {
        v.style.color = "rgba(252,211,77,0.9)";
      }

      row.appendChild(l);
      row.appendChild(v);
      container.appendChild(row);
    });
  });
}

document.getElementById("ob-close").addEventListener("click", () => window.close());
document.getElementById("ob-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
