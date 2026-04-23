/* NextDNS Reporter — content.js — v1.3.0
 * © 2026 Jean-Thomas Runser. MIT License.
 * https://github.com/jeantoroot/NextDNS-Reporter
 *
 * Ce script s'injecte sur toutes les pages mais s'arrête immédiatement
 * si la page n'est pas une page de blocage NextDNS.
 * Il ne lit, ne stocke et ne transmet aucune donnée des pages normales.
 */

(() => {
  "use strict";

  // ─── 1. DÉTECTION ──────────────────────────────────────────────────────────
  if (
    !document.getElementById("main") ||
    !document.getElementById("titleText") ||
    !document.querySelector("#nextdnsLogoGradient")
  ) return;

  // ─── 2. CONSTANTES ─────────────────────────────────────────────────────────
  const BLOCK_EXPIRY_MS  = 48 * 60 * 60 * 1000;
  const SEND_TIMEOUT_MS  = 10_000;
  const COMMENT_MAX_LEN  = 300;
  const NAME_MAX_LEN     = 60;
  const EMAIL_MAX_LEN    = 100;

  // Regex email RFC 5321 simplifié — valide le format, pas l'existence
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Caractères/patterns dangereux à rejeter dans les champs texte libres
  const DANGEROUS_RE = /<[^>]*>|javascript:|data:|vbscript:|on\w+\s*=/i;

  const CHIPS = [
    { id: "email",      label: "Lien reçu par email" },
    { id: "newsletter", label: "Newsletter / abonnement" },
    { id: "supplier",   label: "Site fournisseur / pro" },
    { id: "search",     label: "Résultat de recherche" },
    { id: "saas",       label: "Application web / SaaS" },
    { id: "other",      label: "Autre" }
  ];

  // ─── 3. DONNÉES TECHNIQUES ─────────────────────────────────────────────────
  const domain    = document.title || location.hostname;
  const pageUrl   = location.href;
  const referrer  = document.referrer || null;
  const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  const ua        = navigator.userAgent;

  function parseBrowser(s) {
    if (s.includes("Edg/"))     return "Edge "    + (s.match(/Edg\/([\d.]+)/)    ||["","?"])[1];
    if (s.includes("Firefox/")) return "Firefox " + (s.match(/Firefox\/([\d.]+)/)||["","?"])[1];
    if (s.includes("Chrome/"))  return "Chrome "  + (s.match(/Chrome\/([\d.]+)/) ||["","?"])[1];
    return "Inconnu";
  }
  function parseOS(s) {
    if (s.includes("Windows NT 10")||s.includes("Windows NT 11")) return "Windows 10/11";
    if (s.includes("Windows"))  return "Windows";
    if (s.includes("Mac OS X")) return "macOS";
    if (s.includes("Android"))  return "Android";
    if (s.includes("iPhone")||s.includes("iPad")) return "iOS";
    if (s.includes("Linux"))    return "Linux";
    return "Inconnu";
  }
  const browser = parseBrowser(ua);
  const os      = parseOS(ua);

  // ─── 4. STORAGE ────────────────────────────────────────────────────────────
  function storageGet(keys) {
    return new Promise(resolve => {
      try { chrome.storage.local.get(keys, resolve); }
      catch { resolve({}); }
    });
  }
  function storageSet(obj) {
    try { chrome.storage.local.set(obj); }
    catch { Object.entries(obj).forEach(([k,v]) => localStorage.setItem(k, JSON.stringify(v))); }
  }

  // ─── 5. MOTIF DE BLOCAGE ────────────────────────────────────────────────────
  let blockReason = "";
  function watchBlockReason() {
    const el = document.getElementById("lists");
    if (!el) return;
    const update = () => { if (el.textContent.trim()) blockReason = el.textContent.trim(); };
    update();
    new MutationObserver(update).observe(el, { childList: true, subtree: true, characterData: true });
  }
  watchBlockReason();

  // ─── 6. ANTI-DOUBLON ────────────────────────────────────────────────────────
  async function getReportedMap() {
    const d = await storageGet(["ndns_reported"]);
    return d.ndns_reported || {};
  }
  async function wasRecentlyReported(dom) {
    const map = await getReportedMap();
    const e = map[dom];
    return e && (Date.now() - e.ts) < BLOCK_EXPIRY_MS;
  }
  async function markAsReported(dom) {
    const map = await getReportedMap();
    map[dom] = { ts: Date.now() };
    const entries = Object.entries(map).sort((a,b) => b[1].ts - a[1].ts).slice(0, 30);
    storageSet({ ndns_reported: Object.fromEntries(entries) });
  }

  // ─── 7. VALIDATION ─────────────────────────────────────────────────────────
  function sanitize(str) {
    return str.replace(/[<>"'`]/g, "").trim();
  }
  function isValidEmail(v) {
    return EMAIL_RE.test(v) && v.length <= EMAIL_MAX_LEN;
  }
  function isSafe(v) {
    return !DANGEROUS_RE.test(v);
  }

  // ─── 8. STYLES ─────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #ndns-fab {
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      z-index: 2147483640;
      background: #1a56db; color: #fff; border: none; border-radius: 30px;
      padding: 13px 26px; font-size: 15px; font-weight: 500; cursor: pointer;
      box-shadow: 0 4px 20px rgba(26,86,219,0.45);
      display: flex; align-items: center; gap: 10px;
      font-family: system-ui,-apple-system,sans-serif;
      white-space: nowrap; transition: background 0.15s, opacity 0.15s;
      min-height: 48px; min-width: 0;
    }
    #ndns-fab:hover:not(:disabled) { background: #1e40af; }
    #ndns-fab:disabled { opacity: 0.7; cursor: default; }
    #ndns-fab.ndns-already {
      background: #92400e; box-shadow: 0 4px 20px rgba(146,64,14,0.4);
      cursor: default;
    }
    #ndns-fab.ndns-sent {
      background: #0e9f6e; box-shadow: 0 4px 20px rgba(14,159,110,0.4);
      cursor: default;
    }

    #ndns-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      z-index: 2147483641;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui,-apple-system,sans-serif;
      opacity: 0; transition: opacity 0.18s; pointer-events: none;
    }
    #ndns-overlay.ndns-visible { opacity: 1; pointer-events: all; }

    #ndns-card {
      background: #0f2537; border: 1px solid rgba(255,255,255,0.13);
      border-radius: 16px; padding: 24px 26px 22px;
      width: min(480px, 94vw); color: #fff; position: relative;
      max-height: 85vh; max-height: 85dvh;
      overflow-y: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
    }

    #ndns-close {
      position: absolute; top: 12px; right: 14px;
      background: none; border: none; color: rgba(255,255,255,0.35);
      font-size: 18px; cursor: pointer; line-height: 1;
      border-radius: 6px; transition: color 0.12s, background 0.12s;
      min-width: 44px; min-height: 44px;
      display: flex; align-items: center; justify-content: center; padding: 0;
    }
    #ndns-close:hover { color: #fff; background: rgba(255,255,255,0.08); }

    .ndns-title   { font-size: 17px; font-weight: 600; margin: 0 0 2px; }
    .ndns-subtitle { font-size: 12px; color: rgba(255,255,255,0.45); margin: 0 0 16px; line-height: 1.5; }

    /* Domaine */
    .ndns-domain-block {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
      border-radius: 8px; padding: 10px 12px; margin-bottom: 16px;
    }
    .ndns-domain-main {
      font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.92);
      display: flex; align-items: center; gap: 7px; margin-bottom: 4px;
    }
    .ndns-details-toggle {
      font-size: 11px; color: #4f87e8; cursor: pointer; background: none; border: none;
      padding: 0; font-family: inherit; text-decoration: underline; text-underline-offset: 2px;
    }
    .ndns-details { display: none; margin-top: 8px; padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.07); }
    .ndns-details.ndns-open { display: block; }
    .ndns-detail-row {
      font-size: 11px; color: rgba(255,255,255,0.45); margin-bottom: 4px;
      word-break: break-all; line-height: 1.5;
    }
    .ndns-detail-row b { color: rgba(255,255,255,0.6); font-weight: 500; }

    /* Champs */
    .ndns-field { margin-bottom: 14px; }
    .ndns-label-row {
      display: flex; align-items: center; gap: 6px; margin-bottom: 5px;
    }
    .ndns-label {
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5);
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .ndns-required { color: #f87171; font-size: 11px; }
    .ndns-optional-tag {
      font-size: 10px; color: rgba(255,255,255,0.25);
      font-style: italic; font-weight: 400; text-transform: none; letter-spacing: 0;
    }

    /* Tooltip */
    .ndns-tip-wrap { position: relative; display: inline-flex; align-items: center; }
    .ndns-tip-icon {
      width: 15px; height: 15px; border-radius: 50%;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.5); font-size: 9px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: help; user-select: none; flex: none;
      font-style: normal; line-height: 1;
    }
    .ndns-tip-icon:focus { outline: 2px solid #4f87e8; outline-offset: 2px; }
    .ndns-tip-bubble {
      display: none; position: absolute; bottom: calc(100% + 8px); left: 50%;
      transform: translateX(-50%);
      background: #1e3a5f; border: 1px solid rgba(79,135,232,0.4);
      border-radius: 8px; padding: 8px 11px;
      font-size: 11px; color: rgba(255,255,255,0.75); line-height: 1.5;
      width: 220px; z-index: 10; pointer-events: none;
      white-space: normal; text-align: left;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .ndns-tip-bubble::after {
      content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
      border: 5px solid transparent; border-top-color: rgba(79,135,232,0.4);
    }
    .ndns-tip-wrap:hover .ndns-tip-bubble,
    .ndns-tip-wrap:focus-within .ndns-tip-bubble { display: block; }

    /* Inputs */
    .ndns-input {
      width: 100%; box-sizing: border-box;
      padding: 9px 12px; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
      color: #fff; font-size: 13px; font-family: inherit; outline: none;
      transition: border-color 0.12s;
    }
    .ndns-input:focus { border-color: rgba(255,255,255,0.35); }
    .ndns-input::placeholder { color: rgba(255,255,255,0.25); }
    .ndns-input.ndns-error { border-color: #f87171; }
    .ndns-input.ndns-valid { border-color: #34d399; }
    .ndns-field-error {
      font-size: 11px; color: #f87171; margin-top: 4px; min-height: 14px;
      display: none;
    }
    .ndns-field-error.ndns-show { display: block; }
    textarea.ndns-input { resize: none; height: 72px; }
    .ndns-char-count {
      font-size: 10px; color: rgba(255,255,255,0.25);
      text-align: right; margin-top: 3px;
    }
    .ndns-char-count.ndns-near { color: #fcd34d; }
    .ndns-char-count.ndns-over { color: #f87171; }

    /* Mémoriser */
    .ndns-remember-row {
      display: flex; align-items: center; gap: 8px; margin-top: 8px;
    }
    .ndns-remember-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: rgba(255,255,255,0.55); cursor: pointer;
      user-select: none;
    }
    .ndns-remember-label input[type=checkbox] {
      appearance: none; width: 16px; height: 16px;
      border: 1px solid rgba(255,255,255,0.3); border-radius: 4px;
      background: transparent; cursor: pointer; position: relative; flex: none;
      transition: background 0.12s, border-color 0.12s;
    }
    .ndns-remember-label input[type=checkbox]:checked {
      background: #1a56db; border-color: #1a56db;
    }
    .ndns-remember-label input[type=checkbox]:checked::after {
      content: ""; position: absolute;
      left: 4px; top: 1px; width: 5px; height: 9px;
      border: 2px solid #fff; border-top: none; border-left: none;
      transform: rotate(45deg);
    }
    #ndns-toast {
      font-size: 11px; color: #6ee7b7; margin-top: 5px;
      min-height: 13px; transition: opacity 0.3s;
    }

    /* Chips */
    .ndns-section-label {
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.38);
      letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 7px;
      display: flex; align-items: center; gap: 6px;
    }
    .ndns-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .ndns-chip {
      padding: 5px 12px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.2); background: transparent;
      font-size: 12px; color: rgba(255,255,255,0.65); cursor: pointer;
      font-family: inherit; transition: border-color 0.12s, background 0.12s, color 0.12s;
    }
    .ndns-chip:hover { border-color: rgba(255,255,255,0.4); color: rgba(255,255,255,0.9); }
    .ndns-chip.ndns-chip-active {
      border-color: #4f87e8; background: rgba(79,135,232,0.18); color: #93b8f8;
    }

    /* Bouton envoi */
    #ndns-send-btn {
      width: 100%; padding: 12px; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background 0.15s, opacity 0.15s;
      background: #1a56db; color: #fff;
    }
    #ndns-send-btn:hover:not(:disabled) { background: #1e40af; }
    #ndns-send-btn:disabled { opacity: 0.6; cursor: default; }
    #ndns-send-btn.ndns-already-state {
      background: #92400e; cursor: default;
    }
    #ndns-send-btn.ndns-success { background: #0e9f6e; }
    #ndns-send-btn.ndns-error   { background: #c81e1e; }

    #ndns-status {
      margin-top: 9px; font-size: 12px; text-align: center;
      color: rgba(255,255,255,0.45); min-height: 14px;
    }

    /* Bannière déjà signalé */
    #ndns-already-banner {
      display: none; margin-bottom: 14px;
      background: rgba(146,64,14,0.2); border: 1px solid rgba(251,191,36,0.25);
      border-radius: 8px; padding: 10px 14px;
      font-size: 13px; color: #fcd34d; line-height: 1.5;
    }
    #ndns-already-banner.ndns-open { display: block; }

    /* Bloc succès post-envoi */
    #ndns-refresh-block {
      display: none; margin-top: 12px;
      background: rgba(14,159,110,0.1); border: 1px solid rgba(52,211,153,0.25);
      border-radius: 8px; padding: 12px 14px; text-align: center;
    }
    #ndns-refresh-block.ndns-open { display: block; }
    #ndns-refresh-block p {
      font-size: 12px; color: rgba(255,255,255,0.55); margin-bottom: 10px; line-height: 1.5;
    }
    #ndns-refresh-btn {
      padding: 8px 20px; background: rgba(52,211,153,0.15);
      border: 1px solid rgba(52,211,153,0.35); border-radius: 8px;
      color: #6ee7b7; font-size: 13px; font-weight: 500;
      cursor: pointer; font-family: inherit;
      transition: background 0.12s;
    }
    #ndns-refresh-btn:hover { background: rgba(52,211,153,0.25); }
    #ndns-refresh-hint {
      font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 7px;
    }

    @media (pointer: coarse), (max-width: 600px) {
      #ndns-fab {
        font-size: 16px; padding: 13px 24px; gap: 12px;
      }
      .ndns-input {
        padding: 12px 14px;
      }
      textarea.ndns-input {
        padding: 12px 14px;
      }
      .ndns-chip {
        padding: 8px 14px;
      }
      #ndns-send-btn {
        padding: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // ─── 9. DOM ─────────────────────────────────────────────────────────────────
  function tipWrap(id, tipText) {
    return `<span class="ndns-tip-wrap">
      <span class="ndns-tip-icon" tabindex="0" role="tooltip" aria-label="${tipText}">?</span>
      <span class="ndns-tip-bubble">${tipText}</span>
    </span>`;
  }

  const fab = document.createElement("button");
  fab.id = "ndns-fab";
  fab.setAttribute("aria-label", "Demander le déblocage de ce site");
  // Construit le contenu du FAB via DOM (évite innerHTML — exigence AMO)
  function buildFabContent(btn) {
    btn.textContent = "";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width","16"); svg.setAttribute("height","16");
    svg.setAttribute("viewBox","0 0 24 24"); svg.setAttribute("fill","none");
    svg.setAttribute("stroke","currentColor"); svg.setAttribute("stroke-width","2.2");
    svg.setAttribute("stroke-linecap","round"); svg.setAttribute("stroke-linejoin","round");
    svg.setAttribute("aria-hidden","true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg","path");
    p1.setAttribute("d","M22 2L11 13");
    const p2 = document.createElementNS("http://www.w3.org/2000/svg","path");
    p2.setAttribute("d","M22 2L15 22l-4-9-9-4 20-7z");
    svg.appendChild(p1); svg.appendChild(p2);
    btn.appendChild(svg);
    btn.appendChild(document.createTextNode(" Demander le déblocage"));
  }
  buildFabContent(fab);

  const detailRows = [
    `<div class="ndns-detail-row"><b>URL :</b> ${pageUrl}</div>`,
    referrer ? `<div class="ndns-detail-row"><b>Source :</b> ${referrer}</div>` : "",
    `<div class="ndns-detail-row" id="ndns-reason-row" style="display:none"><b>Motif :</b> <span id="ndns-reason-val"></span></div>`
  ].join("");

  const overlay = document.createElement("div");
  overlay.id = "ndns-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "ndns-modal-title");

  overlay.innerHTML = `
  <div id="ndns-card">
    <button id="ndns-close" aria-label="Fermer">✕</button>

    <p class="ndns-title" id="ndns-modal-title">Demander le déblocage</p>
    <p class="ndns-subtitle">
      L'administrateur réseau recevra un email et traitera votre demande.
    </p>

    <div id="ndns-already-banner"></div>

    <div class="ndns-domain-block">
      <div class="ndns-domain-main">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="rgba(255,255,255,0.45)" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>
        </svg>
        ${domain}
      </div>
      <button class="ndns-details-toggle" id="ndns-details-toggle" type="button">
        + Détails techniques
      </button>
      <div class="ndns-details" id="ndns-details">${detailRows}</div>
    </div>

    <div class="ndns-field">
      <div class="ndns-label-row">
        <span class="ndns-label">Email</span>
        <span class="ndns-required">*</span>
        ${tipWrap("tip-email", "Votre adresse email permet à l'administrateur de vous répondre et de savoir qui fait la demande.")}
      </div>
      <input class="ndns-input" id="ndns-email" type="email"
             placeholder="votre@email.com"
             maxlength="${EMAIL_MAX_LEN}" autocomplete="email"
             aria-required="true" aria-describedby="ndns-email-err"/>
      <div class="ndns-field-error" id="ndns-email-err">
        Merci de saisir une adresse email valide.
      </div>
    </div>

    <div class="ndns-field">
      <div class="ndns-label-row">
        <span class="ndns-label">Prénom</span>
        <span class="ndns-optional-tag">(facultatif)</span>
        ${tipWrap("tip-name", "Votre prénom aide l'administrateur à personnaliser sa réponse.")}
      </div>
      <input class="ndns-input" id="ndns-name" type="text"
             placeholder="Votre prénom"
             maxlength="${NAME_MAX_LEN}" autocomplete="given-name"
             aria-describedby="ndns-name-err"/>
      <div class="ndns-field-error" id="ndns-name-err"></div>
    </div>

    <div class="ndns-remember-row">
      <label class="ndns-remember-label">
        <input type="checkbox" id="ndns-remember" checked/>
        Mémoriser mes coordonnées
      </label>
      ${tipWrap("tip-remember", "Vos coordonnées sont enregistrées uniquement sur cet appareil. Elles seront pré-remplies lors de votre prochain signalement.")}
    </div>
    <div id="ndns-toast"></div>

    <div style="margin-top:14px">
      <div class="ndns-section-label">
        Contexte
        <span class="ndns-optional-tag" style="font-size:10px">(facultatif)</span>
        ${tipWrap("tip-context", "Indiquer d'où vient le lien aide l'administrateur à prioriser et contextualiser sa décision.")}
      </div>
      <div class="ndns-chips" id="ndns-chips">
        ${CHIPS.map(c => `<button class="ndns-chip" data-id="${c.id}" type="button">${c.label}</button>`).join("")}
      </div>
    </div>

    <div class="ndns-field">
      <div class="ndns-label-row">
        <span class="ndns-label">Commentaire</span>
        <span class="ndns-optional-tag">(facultatif)</span>
        ${tipWrap("tip-comment", "Décrivez brièvement pourquoi vous avez besoin d'accéder à ce site (max ${COMMENT_MAX_LEN} caractères).")}
      </div>
      <textarea class="ndns-input" id="ndns-comment"
                placeholder="Ex : besoin pour un devis fournisseur, lien reçu dans une newsletter…"
                maxlength="${COMMENT_MAX_LEN}"
                rows="3"
                aria-describedby="ndns-comment-err"></textarea>
      <div class="ndns-char-count" id="ndns-char-count">0 / ${COMMENT_MAX_LEN}</div>
      <div class="ndns-field-error" id="ndns-comment-err"></div>
    </div>

    <button id="ndns-send-btn" type="button">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
      </svg>
      Envoyer la demande
    </button>
    <div id="ndns-status" role="status" aria-live="polite"></div>

    <div id="ndns-refresh-block">
      <p>Si l'administrateur a déjà traité votre demande,<br>rafraîchissez la page pour vérifier.</p>
      <button id="ndns-refresh-btn" type="button">
        ↺ Rafraîchir la page
      </button>
      <div id="ndns-refresh-hint">
        Si la page est toujours bloquée après rafraîchissement :<br>
        appuyez sur <kbd style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-size:10px">Ctrl+Shift+R</kbd> pour vider le cache.
      </div>
    </div>

  </div>`;

  document.body.appendChild(fab);
  document.body.appendChild(overlay);

  // ─── 10. REFS ───────────────────────────────────────────────────────────────
  const emailInput     = document.getElementById("ndns-email");
  const nameInput      = document.getElementById("ndns-name");
  const rememberChk    = document.getElementById("ndns-remember");
  const toastEl        = document.getElementById("ndns-toast");
  const commentArea    = document.getElementById("ndns-comment");
  const charCount      = document.getElementById("ndns-char-count");
  const sendBtn        = document.getElementById("ndns-send-btn");
  const statusEl       = document.getElementById("ndns-status");
  const closeBtn       = document.getElementById("ndns-close");
  const detailsToggle  = document.getElementById("ndns-details-toggle");
  const detailsPanel   = document.getElementById("ndns-details");
  const alreadyBanner  = document.getElementById("ndns-already-banner");
  const refreshBlock   = document.getElementById("ndns-refresh-block");
  const refreshBtn     = document.getElementById("ndns-refresh-btn");
  const reasonRow      = document.getElementById("ndns-reason-row");
  const reasonVal      = document.getElementById("ndns-reason-val");
  const emailErr       = document.getElementById("ndns-email-err");
  const nameErr        = document.getElementById("ndns-name-err");
  const commentErr     = document.getElementById("ndns-comment-err");

  // ─── 11. CLAVIER VIRTUEL (visualViewport) ───────────────────────────────────
  function onViewportResize() {
    if (!overlay.classList.contains("ndns-visible")) return;
    const card = document.getElementById("ndns-card");
    if (!card) return;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    card.style.maxHeight = Math.floor(vh * 0.85) + "px";
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportResize);
  } else {
    window.addEventListener("resize", onViewportResize);
  }

  // ─── 12. FOCUS TRAP ─────────────────────────────────────────────────────────
  const FOCUSABLE = 'button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])';
  function trapFocus(e) {
    if (!overlay.classList.contains("ndns-visible")) return;
    const card = document.getElementById("ndns-card");
    const els = Array.from(card.querySelectorAll(FOCUSABLE));
    if (!els.length) return;
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length-1].focus(); }
      else if (!e.shiftKey && document.activeElement === els[els.length-1]) { e.preventDefault(); els[0].focus(); }
    }
    if (e.key === "Escape") closeModal();
  }

  // ─── 12. CHAR COUNTER ───────────────────────────────────────────────────────
  commentArea.addEventListener("input", () => {
    const n = commentArea.value.length;
    charCount.textContent = `${n} / ${COMMENT_MAX_LEN}`;
    charCount.className = "ndns-char-count" +
      (n >= COMMENT_MAX_LEN ? " ndns-over" : n >= COMMENT_MAX_LEN * 0.85 ? " ndns-near" : "");
  });

  // ─── 13. VALIDATION EN TEMPS RÉEL ───────────────────────────────────────────
  emailInput.addEventListener("blur", () => validateEmail(true));
  emailInput.addEventListener("input", () => {
    if (emailInput.classList.contains("ndns-error")) validateEmail(false);
  });
  function validateEmail(showError) {
    const v = emailInput.value.trim();
    const valid = v !== "" && isValidEmail(v) && isSafe(v);
    emailInput.classList.toggle("ndns-error", !valid && v !== "");
    emailInput.classList.toggle("ndns-valid", valid);
    if (showError && !valid && v !== "") emailErr.classList.add("ndns-show");
    else if (valid) emailErr.classList.remove("ndns-show");
    return valid;
  }
  function validateComment() {
    const v = commentArea.value;
    if (!isSafe(v)) {
      commentErr.textContent = "Ce champ ne peut pas contenir de balises ou de code.";
      commentErr.classList.add("ndns-show");
      return false;
    }
    commentErr.classList.remove("ndns-show");
    return true;
  }
  function validateName() {
    const v = nameInput.value.trim();
    if (v && !isSafe(v)) {
      nameErr.textContent = "Caractères non autorisés.";
      nameErr.classList.add("ndns-show");
      return false;
    }
    nameErr.classList.remove("ndns-show");
    return true;
  }

  // ─── 14. MÉMORISATION ───────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, 3000);
  }

  function persistIfChecked() {
    if (rememberChk.checked) {
      storageSet({
        ndns_email: emailInput.value.trim(),
        ndns_username: nameInput.value.trim()
      });
    }
  }

  // ─── 15. DÉTAILS TOGGLE ─────────────────────────────────────────────────────
  detailsToggle.addEventListener("click", () => {
    const open = detailsPanel.classList.toggle("ndns-open");
    detailsToggle.textContent = open ? "− Masquer les détails" : "+ Détails techniques";
    if (blockReason) { reasonVal.textContent = blockReason; reasonRow.style.display = "block"; }
  });
  setTimeout(() => {
    if (blockReason) { reasonVal.textContent = blockReason; reasonRow.style.display = "block"; }
  }, 1500);

  // ─── 16. CHIPS ──────────────────────────────────────────────────────────────
  const selectedChips = new Set();
  document.getElementById("ndns-chips").querySelectorAll(".ndns-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.id;
      selectedChips.has(id) ? selectedChips.delete(id) : selectedChips.add(id);
      chip.classList.toggle("ndns-chip-active");
    });
  });

  // ─── 17. OUVRIR / FERMER ────────────────────────────────────────────────────
  async function openModal() {
    const already = await wasRecentlyReported(domain);
    if (already) {
      alreadyBanner.textContent = "⚠ Déjà signalé. Votre demande est en cours de traitement — merci de patienter ou de contacter directement l'administrateur.";
      alreadyBanner.classList.add("ndns-open");
      sendBtn.disabled = true;
      sendBtn.classList.add("ndns-already-state");
      sendBtn.textContent = "⏳ Demande déjà envoyée";
    } else {
      alreadyBanner.classList.remove("ndns-open");
      sendBtn.disabled = false;
      sendBtn.classList.remove("ndns-already-state");
    }
    overlay.classList.add("ndns-visible");
    document.addEventListener("keydown", trapFocus);
    setTimeout(() => { const f = document.getElementById("ndns-card").querySelector(FOCUSABLE); if (f) f.focus(); }, 50);
  }

  function closeModal() {
    overlay.classList.remove("ndns-visible");
    document.removeEventListener("keydown", trapFocus);
    const card = document.getElementById("ndns-card");
    if (card) card.style.maxHeight = "";
  }

  fab.addEventListener("click", async () => {
    const data = await storageGet(["ndns_email", "ndns_username", "ndns_endpoint", "ndns_oneclic"]);

    // Pré-remplir si mémorisé
    if (data.ndns_email)    emailInput.value = data.ndns_email;
    if (data.ndns_username) nameInput.value  = data.ndns_username;
    if (data.ndns_email || data.ndns_username) rememberChk.checked = true;

    // Mode one-click
    if (data.ndns_oneclic) {
      const already = await wasRecentlyReported(domain);
      if (already) {
        fab.textContent = "⏳ Déjà signalé";
        fab.classList.add("ndns-already");
        fab.disabled = true;
        setTimeout(() => {
          buildFabContent(fab);
          fab.classList.remove("ndns-already");
          fab.disabled = false;
        }, 3000);
        return;
      }
      if (!data.ndns_email || !isValidEmail(data.ndns_email)) {
        // Pas d'email mémorisé → ouvrir la modale quand même
        await openModal();
        return;
      }
      sendReport({ email: data.ndns_email, name: data.ndns_username || "", context: "", comment: "", endpoint: data.ndns_endpoint });
      return;
    }

    await openModal();
  });

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  refreshBtn.addEventListener("click", () => {
    // Force reload + cache clear
    location.reload(true);
  });

  // ─── 18. ENVOI ──────────────────────────────────────────────────────────────
  let sending = false;

  async function sendReport({ email, name, context, comment, endpoint }) {
    if (sending) return;
    sending = true;

    const data = await storageGet(["ndns_endpoint"]);
    const ep = endpoint || data.ndns_endpoint || "";
    if (!ep) {
      statusEl.textContent = "Endpoint non configuré — ouvrez les paramètres de l'extension.";
      sending = false;
      return;
    }
    const url = ep.startsWith("https://") ? ep : `https://formspree.io/f/${ep}`;

    const fabOrigText = fab.textContent;
    fab.textContent = "Envoi…";
    fab.disabled = true;
    sendBtn.disabled = true;
    sendBtn.classList.remove("ndns-success", "ndns-error");
    sendBtn.textContent = "Envoi en cours…";
    statusEl.textContent = "";

    const payload = {
      "Email":           email,
      "Prénom":          name || "—",
      "Domaine bloqué":  domain,
      "URL complète":    pageUrl,
      "Source":          referrer || "Accès direct",
      "Motif NextDNS":   blockReason || "Non détecté",
      "Contexte":        context || "Non précisé",
      "Commentaire":     comment || "—",
      "Système":         os,
      "Navigateur":      browser,
      "Date heure":      timestamp,
      "User-Agent":      ua
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);

      await markAsReported(domain);

      // Si mémoriser cochée → persister
      persistIfChecked();
      if (rememberChk.checked && (emailInput.value || nameInput.value)) {
        showToast("✓ Coordonnées mémorisées sur cet appareil");
      }

      // FAB
      fab.textContent = "✓ Demande envoyée";
      fab.classList.add("ndns-sent");
      fab.disabled = true;

      // Modale
      sendBtn.textContent = "✓ Demande envoyée !";
      sendBtn.classList.add("ndns-success");
      statusEl.textContent = "L'administrateur va examiner votre demande.";
      refreshBlock.classList.add("ndns-open");

    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === "AbortError";

      buildFabContent(fab);
      fab.disabled = false;
      sendBtn.textContent = "⚠ Erreur — réessayer";
      sendBtn.classList.add("ndns-error");
      sendBtn.disabled = false;
      statusEl.textContent = isTimeout
        ? "Le serveur ne répond pas (timeout). Vérifiez votre connexion."
        : "Erreur d'envoi. Vérifiez votre connexion et réessayez.";
      console.error("[NextDNS Reporter]", err);
    } finally {
      sending = false;
    }
  }

  sendBtn.addEventListener("click", async () => {
    const emailOk   = validateEmail(true);
    const nameOk    = validateName();
    const commentOk = validateComment();
    if (!emailOk || !nameOk || !commentOk) return;

    const data = await storageGet(["ndns_endpoint"]);
    const context = CHIPS.filter(c => selectedChips.has(c.id)).map(c => c.label).join(", ");
    sendReport({
      email:    emailInput.value.trim(),
      name:     sanitize(nameInput.value.trim()),
      context,
      comment:  sanitize(commentArea.value.trim()),
      endpoint: data.ndns_endpoint
    });
  });

})();
