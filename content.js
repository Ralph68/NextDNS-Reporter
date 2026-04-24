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

  // ─── 8. DIRECT ACCESS DETECTION ────────────────────────────────────────────

  // Sous-domaines de redirection email/tracking courants
  const REDIRECT_PARAMS = ["url", "u", "redirect", "target", "dest", "r", "link",
                           "to", "href", "forward", "ref", "source", "returnUrl", "returnurl"];

  // Domaines purement techniques (ESP, CDN) — jamais de contenu utilisateur
  const TECHNICAL_DOMAINS = [
    "sendgrid.net", "mailchimp.com", "bloomreach.com", "klaviyo.com",
    "brevo.com", "sendinblue.com", "mailgun.org", "sparkpost.com",
    "mandrillapp.com", "amazonaws.com", "cloudfront.net", "fastly.net"
  ];

  // Mots-clés indiquant qu'un domaine est un redirecteur/tracker
  const SKIP_KEYWORDS_RE = /track|click|analytics|pixel|beacon/i;

  // Patterns de sous-domaines typiques des redirecteurs email/marketing
  const TRACKER_DOMAIN_RE = /^(?:click|track|link|go|r|redirect|em|links|t|url|lnk)\./i;

  function normalizeHostname(hostname) {
    return hostname.replace(/^www\./, "").toLowerCase();
  }

  function isTechnicalDomain(hostname) {
    const h = normalizeHostname(hostname);
    if (SKIP_KEYWORDS_RE.test(h)) return true;
    return TECHNICAL_DOMAINS.some(td => h === td || h.endsWith("." + td));
  }

  function isRedirectLikeDomain(hostname) {
    return TRACKER_DOMAIN_RE.test(hostname);
  }

  function extractCandidateUrlFromParams(rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl); }
    catch { return null; }

    for (const param of REDIRECT_PARAMS) {
      const val = parsed.searchParams.get(param);
      if (!val) continue;
      let candidate;
      try { candidate = new URL(val); }
      catch {
        // valeur peut être une URL relative ou encodée une fois de plus
        try { candidate = new URL(decodeURIComponent(val)); }
        catch { continue; }
      }
      if (candidate.protocol !== "https:" && candidate.protocol !== "http:") continue;
      if (isTechnicalDomain(candidate.hostname)) continue;
      return { url: candidate.href, hostname: normalizeHostname(candidate.hostname), source: "url-param" };
    }
    return null;
  }

  function getCandidateFromReferrer(referrer) {
    if (!referrer) return null;
    let parsed;
    try { parsed = new URL(referrer); }
    catch { return null; }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const h = normalizeHostname(parsed.hostname);
    if (isTechnicalDomain(h)) return null;
    return { url: referrer, hostname: h, source: "referrer" };
  }

  function detectLegitimateTarget() {
    const currentHostname = normalizeHostname(location.hostname);

    // 1. Tester le referrer en premier — signal le plus fiable
    const fromRef = getCandidateFromReferrer(document.referrer);
    if (fromRef && fromRef.hostname !== currentHostname) return fromRef;

    // 2. Si le domaine bloqué ressemble à un redirecteur, fouiller ses propres paramètres
    if (isRedirectLikeDomain(location.hostname) || isTechnicalDomain(location.hostname)) {
      const fromParam = extractCandidateUrlFromParams(location.href);
      if (fromParam && fromParam.hostname !== currentHostname) return fromParam;
    }

    return null;
  }

  // ─── 9. STYLES ─────────────────────────────────────────────────────────────
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

    /* Tooltip — expand/collapse au clic/clavier (compatible tactile, sans :hover) */
    .ndns-tip-wrap { position: relative; display: inline-flex; align-items: center; }
    .ndns-tip-icon {
      width: 15px; height: 15px; border-radius: 50%;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.5); font-size: 9px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; user-select: none; flex: none;
      font-style: normal; line-height: 1; padding: 0; font-family: inherit;
    }
    .ndns-tip-icon:focus { outline: 2px solid #4f87e8; outline-offset: 2px; }
    .ndns-tip-bubble {
      display: none; position: absolute; top: calc(100% + 6px); left: 50%;
      transform: translateX(-50%);
      background: #1e3a5f; border: 1px solid rgba(79,135,232,0.4);
      border-radius: 8px; padding: 8px 11px;
      font-size: 11px; color: rgba(255,255,255,0.75); line-height: 1.5;
      width: 220px; z-index: 10; pointer-events: none;
      white-space: normal; text-align: left;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .ndns-tip-bubble::after {
      content: ""; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
      border: 5px solid transparent; border-bottom-color: rgba(79,135,232,0.4);
    }
    /* Affiché par classe JS — aucune dépendance au :hover ou :focus-within */
    .ndns-tip-open .ndns-tip-bubble { display: block; }

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

  // ─── 10. DOM ────────────────────────────────────────────────────────────────
  // Crée un tooltip expand/collapse au clic/clavier — compatible tactile, zéro :hover.
  let _tipCounter = 0;
  function makeTipWrap(tipText) {
    const id   = "ndns-tip-" + (++_tipCounter);
    const wrap = document.createElement("span");
    wrap.className = "ndns-tip-wrap";

    const icon = document.createElement("button");
    icon.type = "button";
    icon.className = "ndns-tip-icon";
    icon.setAttribute("aria-expanded", "false");
    icon.setAttribute("aria-controls", id);
    icon.setAttribute("aria-label", "Aide : " + tipText);
    icon.textContent = "?";

    const bubble = document.createElement("span");
    bubble.id = id;
    bubble.className = "ndns-tip-bubble";
    bubble.setAttribute("role", "tooltip");
    bubble.textContent = tipText;

    icon.addEventListener("click", e => {
      e.stopPropagation();
      const open = wrap.classList.toggle("ndns-tip-open");
      icon.setAttribute("aria-expanded", open ? "true" : "false");
    });

    wrap.appendChild(icon);
    wrap.appendChild(bubble);
    return wrap;
  }

  // Ferme tous les tips ouverts quand on clique ailleurs
  document.addEventListener("click", () => {
    document.querySelectorAll(".ndns-tip-open").forEach(w => {
      w.classList.remove("ndns-tip-open");
      const btn = w.querySelector(".ndns-tip-icon");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  });

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

  // Construit la modale et tous ses enfants via DOM (zéro innerHTML — exigence AMO).
  // Tous les IDs existants sont préservés pour rester compatibles avec les sections REFS+.
  const overlay = document.createElement("div");
  overlay.id = "ndns-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "ndns-modal-title");

  const card = document.createElement("div");
  card.id = "ndns-card";

  // ── Bouton fermer ──
  const cBtn = document.createElement("button");
  cBtn.id = "ndns-close"; cBtn.setAttribute("aria-label", "Fermer"); cBtn.textContent = "✕";
  card.appendChild(cBtn);

  // ── Titre et sous-titre ──
  const mTitle = document.createElement("p");
  mTitle.className = "ndns-title"; mTitle.id = "ndns-modal-title";
  mTitle.textContent = "Demander le déblocage";
  card.appendChild(mTitle);
  const mSub = document.createElement("p");
  mSub.className = "ndns-subtitle";
  mSub.textContent = "L'administrateur réseau recevra un email et traitera votre demande.";
  card.appendChild(mSub);

  // ── Bannière déjà signalé ──
  const abBanner = document.createElement("div");
  abBanner.id = "ndns-already-banner";
  card.appendChild(abBanner);

  // ── Bloc domaine ──
  const domBlock = document.createElement("div");
  domBlock.className = "ndns-domain-block";

  const domMain = document.createElement("div");
  domMain.className = "ndns-domain-main";
  // SVG globe — construit via createElementNS (pas de innerHTML)
  const gSvg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  gSvg.setAttribute("width","13"); gSvg.setAttribute("height","13");
  gSvg.setAttribute("viewBox","0 0 24 24"); gSvg.setAttribute("fill","none");
  gSvg.setAttribute("stroke","rgba(255,255,255,0.45)"); gSvg.setAttribute("stroke-width","2");
  gSvg.setAttribute("aria-hidden","true");
  const gC = document.createElementNS("http://www.w3.org/2000/svg","circle");
  gC.setAttribute("cx","12"); gC.setAttribute("cy","12"); gC.setAttribute("r","10");
  const gL = document.createElementNS("http://www.w3.org/2000/svg","line");
  gL.setAttribute("x1","2"); gL.setAttribute("y1","12"); gL.setAttribute("x2","22"); gL.setAttribute("y2","12");
  const gP = document.createElementNS("http://www.w3.org/2000/svg","path");
  gP.setAttribute("d","M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20");
  gSvg.appendChild(gC); gSvg.appendChild(gL); gSvg.appendChild(gP);
  domMain.appendChild(gSvg);
  domMain.appendChild(document.createTextNode(domain));
  domBlock.appendChild(domMain);

  const dToggle = document.createElement("button");
  dToggle.className = "ndns-details-toggle"; dToggle.id = "ndns-details-toggle";
  dToggle.type = "button"; dToggle.textContent = "+ Détails techniques";
  domBlock.appendChild(dToggle);

  const dPanel = document.createElement("div");
  dPanel.className = "ndns-details"; dPanel.id = "ndns-details";
  // Ligne URL (textContent — pageUrl jamais injecté comme HTML)
  const urlRow = document.createElement("div"); urlRow.className = "ndns-detail-row";
  const urlB = document.createElement("b"); urlB.textContent = "URL :";
  urlRow.appendChild(urlB); urlRow.appendChild(document.createTextNode(" " + pageUrl));
  dPanel.appendChild(urlRow);
  // Ligne Source — conditionnelle
  if (referrer) {
    const refRow = document.createElement("div"); refRow.className = "ndns-detail-row";
    const refB = document.createElement("b"); refB.textContent = "Source :";
    refRow.appendChild(refB); refRow.appendChild(document.createTextNode(" " + referrer));
    dPanel.appendChild(refRow);
  }
  // Ligne Motif — masquée par défaut, remplie dynamiquement par watchBlockReason
  const reasonRowEl = document.createElement("div");
  reasonRowEl.className = "ndns-detail-row"; reasonRowEl.id = "ndns-reason-row";
  reasonRowEl.style.display = "none";
  const reasonB = document.createElement("b"); reasonB.textContent = "Motif :";
  const reasonValEl = document.createElement("span"); reasonValEl.id = "ndns-reason-val";
  reasonRowEl.appendChild(reasonB);
  reasonRowEl.appendChild(document.createTextNode(" "));
  reasonRowEl.appendChild(reasonValEl);
  dPanel.appendChild(reasonRowEl);
  domBlock.appendChild(dPanel);
  card.appendChild(domBlock);

  // ── Champ Email ──
  const eField = document.createElement("div"); eField.className = "ndns-field";
  const eLR = document.createElement("div"); eLR.className = "ndns-label-row";
  const eLbl = document.createElement("span"); eLbl.className = "ndns-label"; eLbl.textContent = "Email";
  const eReq = document.createElement("span"); eReq.className = "ndns-required"; eReq.textContent = "*";
  eLR.appendChild(eLbl); eLR.appendChild(eReq);
  eLR.appendChild(makeTipWrap("Votre adresse email permet à l'administrateur de vous répondre et de savoir qui fait la demande."));
  eField.appendChild(eLR);
  const eInput = document.createElement("input");
  eInput.className = "ndns-input"; eInput.id = "ndns-email"; eInput.type = "email";
  eInput.placeholder = "votre@email.com";
  eInput.setAttribute("maxlength", String(EMAIL_MAX_LEN));
  eInput.setAttribute("autocomplete", "email");
  eInput.setAttribute("aria-required", "true");
  eInput.setAttribute("aria-describedby", "ndns-email-err");
  eField.appendChild(eInput);
  const eErr = document.createElement("div");
  eErr.className = "ndns-field-error"; eErr.id = "ndns-email-err";
  eErr.textContent = "Merci de saisir une adresse email valide.";
  eField.appendChild(eErr);
  card.appendChild(eField);

  // ── Champ Prénom ──
  const nField = document.createElement("div"); nField.className = "ndns-field";
  const nLR = document.createElement("div"); nLR.className = "ndns-label-row";
  const nLbl = document.createElement("span"); nLbl.className = "ndns-label"; nLbl.textContent = "Prénom";
  const nOpt = document.createElement("span"); nOpt.className = "ndns-optional-tag"; nOpt.textContent = "(facultatif)";
  nLR.appendChild(nLbl); nLR.appendChild(nOpt);
  nLR.appendChild(makeTipWrap("Votre prénom aide l'administrateur à personnaliser sa réponse."));
  nField.appendChild(nLR);
  const nInput = document.createElement("input");
  nInput.className = "ndns-input"; nInput.id = "ndns-name"; nInput.type = "text";
  nInput.placeholder = "Votre prénom";
  nInput.setAttribute("maxlength", String(NAME_MAX_LEN));
  nInput.setAttribute("autocomplete", "given-name");
  nInput.setAttribute("aria-describedby", "ndns-name-err");
  nField.appendChild(nInput);
  const nErr = document.createElement("div");
  nErr.className = "ndns-field-error"; nErr.id = "ndns-name-err";
  nField.appendChild(nErr);
  card.appendChild(nField);

  // ── Ligne Mémoriser ──
  const remRow = document.createElement("div"); remRow.className = "ndns-remember-row";
  const remLbl = document.createElement("label"); remLbl.className = "ndns-remember-label";
  const remChk = document.createElement("input");
  remChk.type = "checkbox"; remChk.id = "ndns-remember"; remChk.checked = true;
  remLbl.appendChild(remChk);
  remLbl.appendChild(document.createTextNode("Mémoriser mes coordonnées"));
  remRow.appendChild(remLbl);
  remRow.appendChild(makeTipWrap("Vos coordonnées sont enregistrées uniquement sur cet appareil. Elles seront pré-remplies lors de votre prochain signalement."));
  card.appendChild(remRow);
  const toastDiv = document.createElement("div"); toastDiv.id = "ndns-toast";
  card.appendChild(toastDiv);

  // ── Section Contexte (chips) ──
  const ctxDiv = document.createElement("div"); ctxDiv.style.marginTop = "14px";
  const ctxLbl = document.createElement("div"); ctxLbl.className = "ndns-section-label";
  ctxLbl.appendChild(document.createTextNode("Contexte"));
  const ctxOpt = document.createElement("span"); ctxOpt.className = "ndns-optional-tag";
  ctxOpt.style.fontSize = "10px"; ctxOpt.textContent = "(facultatif)";
  ctxLbl.appendChild(ctxOpt);
  ctxLbl.appendChild(makeTipWrap("Indiquer d'où vient le lien aide l'administrateur à prioriser et contextualiser sa décision."));
  ctxDiv.appendChild(ctxLbl);
  const chipsDiv = document.createElement("div");
  chipsDiv.className = "ndns-chips"; chipsDiv.id = "ndns-chips";
  CHIPS.forEach(c => {
    const b = document.createElement("button");
    b.className = "ndns-chip"; b.dataset.id = c.id; b.type = "button"; b.textContent = c.label;
    chipsDiv.appendChild(b);
  });
  ctxDiv.appendChild(chipsDiv);
  card.appendChild(ctxDiv);

  // ── Champ Commentaire ──
  const cField = document.createElement("div"); cField.className = "ndns-field";
  const cLR = document.createElement("div"); cLR.className = "ndns-label-row";
  const cLbl = document.createElement("span"); cLbl.className = "ndns-label"; cLbl.textContent = "Commentaire";
  const cOpt = document.createElement("span"); cOpt.className = "ndns-optional-tag"; cOpt.textContent = "(facultatif)";
  cLR.appendChild(cLbl); cLR.appendChild(cOpt);
  // Correction bug : COMMENT_MAX_LEN était affiché littéralement (chaîne ordinaire dans template)
  cLR.appendChild(makeTipWrap("Décrivez brièvement pourquoi vous avez besoin d'accéder à ce site (max " + COMMENT_MAX_LEN + " caractères)."));
  cField.appendChild(cLR);
  const cArea = document.createElement("textarea");
  cArea.className = "ndns-input"; cArea.id = "ndns-comment"; cArea.rows = 3;
  cArea.placeholder = "Ex : besoin pour un devis fournisseur, lien reçu dans une newsletter…";
  cArea.setAttribute("maxlength", String(COMMENT_MAX_LEN));
  cArea.setAttribute("aria-describedby", "ndns-comment-err");
  cField.appendChild(cArea);
  const cCount = document.createElement("div");
  cCount.className = "ndns-char-count"; cCount.id = "ndns-char-count";
  cCount.textContent = "0 / " + COMMENT_MAX_LEN;
  cField.appendChild(cCount);
  const cErr = document.createElement("div");
  cErr.className = "ndns-field-error"; cErr.id = "ndns-comment-err";
  cField.appendChild(cErr);
  card.appendChild(cField);

  // ── Bouton Envoyer ──
  const sBtnEl = document.createElement("button"); sBtnEl.id = "ndns-send-btn"; sBtnEl.type = "button";
  const sSvg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  sSvg.setAttribute("width","15"); sSvg.setAttribute("height","15");
  sSvg.setAttribute("viewBox","0 0 24 24"); sSvg.setAttribute("fill","none");
  sSvg.setAttribute("stroke","currentColor"); sSvg.setAttribute("stroke-width","2.2");
  sSvg.setAttribute("stroke-linecap","round"); sSvg.setAttribute("stroke-linejoin","round");
  sSvg.setAttribute("aria-hidden","true");
  const sP1 = document.createElementNS("http://www.w3.org/2000/svg","path"); sP1.setAttribute("d","M22 2L11 13");
  const sP2 = document.createElementNS("http://www.w3.org/2000/svg","path"); sP2.setAttribute("d","M22 2L15 22l-4-9-9-4 20-7z");
  sSvg.appendChild(sP1); sSvg.appendChild(sP2);
  sBtnEl.appendChild(sSvg); sBtnEl.appendChild(document.createTextNode(" Envoyer la demande"));
  card.appendChild(sBtnEl);

  // Statut d'envoi
  const stsEl = document.createElement("div"); stsEl.id = "ndns-status";
  stsEl.setAttribute("role","status"); stsEl.setAttribute("aria-live","polite");
  card.appendChild(stsEl);

  // ── Bloc rafraîchissement post-envoi ──
  const rfBlock = document.createElement("div"); rfBlock.id = "ndns-refresh-block";
  const rfP = document.createElement("p");
  rfP.appendChild(document.createTextNode("Si l'administrateur a déjà traité votre demande,"));
  rfP.appendChild(document.createElement("br"));
  rfP.appendChild(document.createTextNode("rafraîchissez la page pour vérifier."));
  rfBlock.appendChild(rfP);
  const rfBtn = document.createElement("button"); rfBtn.id = "ndns-refresh-btn"; rfBtn.type = "button";
  rfBtn.textContent = "↺ Rafraîchir la page";
  rfBlock.appendChild(rfBtn);
  const rfHint = document.createElement("div"); rfHint.id = "ndns-refresh-hint";
  rfHint.appendChild(document.createTextNode("Si la page est toujours bloquée après rafraîchissement :"));
  rfHint.appendChild(document.createElement("br"));
  rfHint.appendChild(document.createTextNode("appuyez sur "));
  const rfKbd = document.createElement("kbd");
  rfKbd.style.cssText = "background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-size:10px";
  rfKbd.textContent = "Ctrl+Shift+R";
  rfHint.appendChild(rfKbd); rfHint.appendChild(document.createTextNode(" pour vider le cache."));
  rfBlock.appendChild(rfHint);
  card.appendChild(rfBlock);

  overlay.appendChild(card);

  document.body.appendChild(fab);
  document.body.appendChild(overlay);

  // ─── 11. REFS ───────────────────────────────────────────────────────────────
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

  // ─── 12. CLAVIER VIRTUEL (visualViewport) ───────────────────────────────────
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

  // ─── 13. FOCUS TRAP ─────────────────────────────────────────────────────────
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

  // ─── 14. CHAR COUNTER ───────────────────────────────────────────────────────
  commentArea.addEventListener("input", () => {
    const n = commentArea.value.length;
    charCount.textContent = `${n} / ${COMMENT_MAX_LEN}`;
    charCount.className = "ndns-char-count" +
      (n >= COMMENT_MAX_LEN ? " ndns-over" : n >= COMMENT_MAX_LEN * 0.85 ? " ndns-near" : "");
  });

  // ─── 15. VALIDATION EN TEMPS RÉEL ───────────────────────────────────────────
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

  // ─── 16. MÉMORISATION ───────────────────────────────────────────────────────
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

  // ─── 17. DÉTAILS TOGGLE ─────────────────────────────────────────────────────
  detailsToggle.addEventListener("click", () => {
    const open = detailsPanel.classList.toggle("ndns-open");
    detailsToggle.textContent = open ? "− Masquer les détails" : "+ Détails techniques";
    if (blockReason) { reasonVal.textContent = blockReason; reasonRow.style.display = "block"; }
  });
  setTimeout(() => {
    if (blockReason) { reasonVal.textContent = blockReason; reasonRow.style.display = "block"; }
  }, 1500);

  // ─── 18. CHIPS ──────────────────────────────────────────────────────────────
  const selectedChips = new Set();
  document.getElementById("ndns-chips").querySelectorAll(".ndns-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.id;
      selectedChips.has(id) ? selectedChips.delete(id) : selectedChips.add(id);
      chip.classList.toggle("ndns-chip-active");
    });
  });

  // ─── 19. OUVRIR / FERMER ────────────────────────────────────────────────────
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

  // ─── 20. ENVOI ──────────────────────────────────────────────────────────────
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
