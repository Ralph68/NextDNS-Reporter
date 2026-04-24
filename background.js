/* NextDNS Reporter — background.js — v1.4.0
 * Service worker MV3 minimal.
 * Ouvre la page d'onboarding uniquement à la première installation.
 */
"use strict";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;

  // Ne pas ouvrir l'onboarding si un endpoint est déjà configuré
  // (cas réinstallation / migration depuis une version antérieure)
  const data = await chrome.storage.local.get(["ndns_endpoint"]);
  if (data.ndns_endpoint) return;

  chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});
