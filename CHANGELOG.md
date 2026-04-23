# Changelog — NextDNS Reporter

## [1.4.0] — 2026-04-23

### Fixed
- Suppression de la permission `identity` inutilisée (rejet Chrome Web Store,
  référence Purple Potassium)

### Changed
- FAB et modale entièrement adaptés aux écrans tactiles (touch targets 48px,
  dvh, visualViewport API pour le clavier virtuel)
- Popup : banner d'information sur Firefox Android (popup non accessible)
- Options : layout responsive en dessous de 640px (nav horizontale, 1 colonne)

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
