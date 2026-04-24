# Changelog — NextDNS Reporter

## [1.4.0] — 2026-04-24

### Sécurité & conformité AMO/CWS
- Suppression de la permission `chrome.identity` et de toute lecture automatique
  du compte Google — l'identité est désormais uniquement saisie manuellement
- Suppression de tous les `innerHTML` dynamiques dans `content.js` — construction
  DOM complète via `createElement` / `textContent` / `appendChild` (exigence AMO)
- Remplacement de `location.reload(true)` (déprécié) par `caches.keys()` + `location.reload()`

### Onboarding
- Nouveau guide de démarrage guidé en 4 étapes (`onboarding.html` + `onboarding.js`) :
  fonctionnement de l'extension, prérequis certificat NextDNS, configuration endpoint
  Formspree, résumé de configuration
- Ouverture automatique à la première installation uniquement (via `background.js`)
- Lien "Revoir le guide de démarrage" dans la page Aide des paramètres

### Bouton accès direct
- Détection automatique de la cible légitime derrière un traceur/redirecteur email
  (`detectLegitimateTarget()`) : analyse du `document.referrer` et des paramètres
  d'URL (`url`, `redirect`, `target`…)
- Bouton `#ndns-fab-direct` "→ Accéder directement à [domaine]" affiché au-dessus
  du FAB de signalement si une cible fiable est détectée
- Filtre ESP/CDN (SendGrid, Klaviyo, Mailchimp…) et filtre mots-clés tracker

### Tooltips tactiles
- Remplacement des tooltips CSS `:hover` / `:focus-within` par un système
  expand/collapse au clic — compatible écran tactile et clavier
- Icône `?` convertie en `<button type="button">` avec `aria-expanded` / `aria-controls`
- Fermeture automatique au clic à l'extérieur

### Payload enrichi
- Ajout de `"Version extension"` (`chrome.runtime.getManifest().version`) dans chaque signalement
- Ajout de `"Type appareil"` (`Desktop` ou `Mobile` détecté via user-agent)

### Historique enrichi
- Format `ndns_reported` enrichi : `{ ts, url, reason, status, hadDirectLink }`
- Rétrocompatibilité avec les anciens formats (nombre brut v1.0–1.2, objet `{ ts }` v1.3)
- Badge "↗ Accès direct proposé" dans l'historique si `hadDirectLink: true`
- Badge statut envoi (Envoyé / Erreur) dans l'historique

### Interface
- FAB et modale entièrement adaptés aux écrans tactiles (touch targets 48px minimum,
  `dvh`, `visualViewport` API pour le clavier virtuel Android/iOS)
- Popup : bannière d'information sur Firefox Android (popup non accessible nativement)
- Options : layout responsive en dessous de 640px (nav horizontale scrollable, 1 colonne)
- Options : bouton "Tester l'envoi" avec `AbortController` et timeout 10s
- Options : carte "Certificat NextDNS requis" en première position dans l'Aide

---

## [1.3.1] — 2026-04-18

### Changed
- GitHub URL mise à jour : `jeantoroot/NextDNS-Reporter` dans tous les fichiers
- Section installation Firefox dans README : remplacée par le lien AMO direct
- Crédits : suppression de la mention du poste professionnel de l'auteur

### Fixed
- Liens GitHub corrects dans options.html (Aide, Confidentialité, Crédits)

---

## [1.3.0] — 2026-04-18

### Corrections
- Champ email visible dans la modale (bug CSS v1.2 corrigé)
- Tooltips : texte maintenant construit en JS — plus de variable `${COMMENT_MAX_LEN}` non résolue
- Labels en sentence case (suppression des majuscules inutiles)
- Limite commentaire explicite dans le label : "(facultatif, max 300 car.)"

### Icône
- Nouvelle icône : N bleu sur fond bleu arrondi + badge rouge (flèche envoi)
- Identifiable à 16px dans la barre d'extensions

### Interface
- Confidentialité séparée de l'Aide dans la page Options (onglet dédié)
- Tableau récapitulatif des données envoyées et stockées
- Aide enrichie et plus bavarde — 8 cards avec exemples concrets
- GitHub mis à jour : `jeantoroot/NextDNS-Reporter` dans tous les liens

### Documentation
- README.md complet pour GitHub (présentation, installation, structure, fonctionnalités, dépannage, roadmap)
- Code documenté avec commentaires de section dans content.js

---

## [1.2.0] — 2026-04-17
- Deux champs séparés Email + Prénom, validation email temps réel
- Tooltips CSS purs sur chaque champ
- Anti-injection (DANGEROUS_RE), sanitisation avant envoi
- Compteur de caractères commentaire (max 300)
- Endpoint vide par défaut (aucune donnée sensible dans le code public)
- Bloc rafraîchissement post-envoi

## [1.1.0] — 2026-04-17
- URL complète, referrer, motif de blocage, mode one-click
- Anti-doublon 48h, page Options, popup amélioré, focus trap, timeout 10s

## [1.0.0] — 2026-04-17
- Version initiale
