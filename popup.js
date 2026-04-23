"use strict";

const epInput       = document.getElementById("ep-input");
const saveBtn       = document.getElementById("save-btn");
const saveConfirm   = document.getElementById("save-confirm");
const statusDot     = document.getElementById("status-dot");
const statusLabel   = document.getElementById("status-label");
const statusDesc    = document.getElementById("status-desc");
const oneClicToggle = document.getElementById("oneclic-toggle");
const optionsLink   = document.getElementById("options-link");
const versionEl     = document.getElementById("ext-version");

const mv = chrome.runtime.getManifest();
versionEl.textContent = "v" + mv.version;

chrome.storage.local.get(["ndns_endpoint", "ndns_oneclic"], data => {
  epInput.value = data.ndns_endpoint || "";
  oneClicToggle.checked = !!data.ndns_oneclic;
  updateStatus(data.ndns_endpoint || "");
});

function updateStatus(ep) {
  if (ep && ep.includes("formspree.io/f/")) {
    statusDot.className = "dot ok";
    statusLabel.textContent = "Extension active";
    statusDesc.textContent = "Le bouton apparaît sur les pages bloquées par NextDNS.";
  } else if (ep) {
    statusDot.className = "dot warn";
    statusLabel.textContent = "Endpoint non standard";
    statusDesc.textContent = "Vérifiez l'URL Formspree dans les paramètres.";
  } else {
    statusDot.className = "dot off";
    statusLabel.textContent = "Non configuré";
    statusDesc.textContent = "Renseignez un endpoint Formspree pour activer les envois.";
  }
}

saveBtn.addEventListener("click", () => {
  let val = epInput.value.trim();
  if (val && !val.startsWith("https://")) {
    val = `https://formspree.io/f/${val}`;
    epInput.value = val;
  }
  chrome.storage.local.set({ ndns_endpoint: val, ndns_oneclic: oneClicToggle.checked }, () => {
    saveConfirm.style.color = "#22c55e";
    saveConfirm.textContent = "Enregistré ✓";
    updateStatus(val);
    setTimeout(() => saveConfirm.textContent = "", 2500);
  });
});

epInput.addEventListener("keydown", e => { if (e.key === "Enter") saveBtn.click(); });
optionsLink.addEventListener("click", e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

if (/Android/i.test(navigator.userAgent)) {
  document.getElementById("android-banner").style.display = "block";
}
document.getElementById("open-options-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
