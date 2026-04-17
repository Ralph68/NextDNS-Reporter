# NextDNS Reporter

> Extension Chrome & Firefox — Demandez le déblocage d'un site bloqué par NextDNS en un clic.

![Version](https://img.shields.io/badge/version-1.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Firefox-orange)
![Vanilla JS](https://img.shields.io/badge/code-Vanilla%20JS-yellow)

---

## Présentation

Quand NextDNS bloque un site, l'extension détecte automatiquement la page et affiche
un bouton **Demander le déblocage**. Un clic ouvre un formulaire simple qui envoie
un email à l'administrateur réseau avec toutes les informations utiles.

**Cas d'usage typiques :**
- Réseau familial : les proches signalent les blocages sans avoir à contacter l'admin autrement
- Réseau d'entreprise : les collaborateurs font des demandes de déblocage structurées
- Usage personnel multi-postes : uniformiser la procédure de signalement

---

## Fonctionnement

```
Page bloquée NextDNS
       │
       ▼
Extension détecte (3 sélecteurs DOM exclusifs à NextDNS)
       │
       ▼
Bouton "Demander le déblocage" affiché en bas de page
       │
       ▼
Formulaire : email + prénom + contexte + commentaire
       │
       ▼
Envoi JSON → Formspree → Email administrateur
```

### Données envoyées dans chaque signalement

| Champ | Source |
|---|---|
| Email | Saisi par l'utilisateur |
| Prénom | Saisi par l'utilisateur (facultatif) |
| Domaine bloqué | Titre de la page |
| URL complète | `location.href` |
| Source / referrer | `document.referrer` |
| Motif de blocage | DOM NextDNS (`#lists`) |
| Contexte | Chips sélectionnés par l'utilisateur |
| Commentaire | Texte libre (facultatif, max 300 car.) |
| Système & navigateur | User-agent |
| Date et heure | Horloge navigateur |

---

## Installation

### Prérequis : créer un endpoint Formspree

1. Créer un compte gratuit sur [formspree.io](https://formspree.io)
2. Créer un nouveau formulaire avec votre adresse email
3. Copier l'URL (`https://formspree.io/f/xxxxxxxx`)
4. La renseigner dans le popup de l'extension après installation

Le plan gratuit Formspree permet 50 soumissions/mois — largement suffisant pour un usage familial ou une petite équipe.

---

### Chrome (mode développeur)

> L'extension n'est pas encore publiée sur le Chrome Web Store. En attendant, installez-la manuellement.

1. **Téléchargez** ce dépôt (bouton Code → Download ZIP) et décompressez-le
2. **Placez le dossier** dans un emplacement définitif — par exemple `C:\Extensions\NextDNS-Reporter`
   > ⚠️ Ne déplacez plus ce dossier après installation. Chrome pointe directement vers lui.
3. Ouvrez `chrome://extensions` dans Chrome
4. Activez le **Mode développeur** (interrupteur en haut à droite)
5. Cliquez sur **Charger l'extension non empaquetée**
6. Sélectionnez le dossier (celui qui contient `manifest.json`)
7. Cliquez sur l'icône **N** dans la barre d'outils → renseignez l'endpoint Formspree

---

### Firefox — Mode temporaire (simple)

> L'extension disparaît au redémarrage. Idéal pour tester.

1. Ouvrez `about:debugging` → **Ce Firefox**
2. Cliquez sur **Charger un module temporaire**
3. Sélectionnez le fichier `manifest.json` dans le dossier de l'extension

---

### Firefox — Mode permanent (Firefox Developer Edition)

1. Téléchargez [Firefox Developer Edition](https://www.mozilla.org/fr/firefox/developer/)
   (coexiste avec Firefox normal, aucun remplacement)
2. Dans `about:config` → passer `xpinstall.signatures.required` à `false`
3. Créez un ZIP du contenu du dossier (**les fichiers directement**, pas le dossier parent)
4. Dans Firefox Dev Edition → `about:addons` → ⚙ → **Installer un module depuis un fichier**
5. Sélectionnez le ZIP

---

## Mise à jour

1. Remplacez les fichiers dans le dossier source (ne pas le déplacer)
2. Ouvrez `chrome://extensions`
3. Cliquez sur **↺ Recharger** sur la carte NextDNS Reporter

Les paramètres (email, endpoint) sont conservés — ils sont stockés dans `chrome.storage.local`,
indépendamment des fichiers de l'extension.

---

## Structure du projet

```
NextDNS-Reporter/
├── manifest.json          — Déclaration MV3 (Chrome + Firefox)
├── content.js             — Script injecté sur les pages de blocage
├── popup.html             — Interface popup (barre d'outils)
├── popup.js               — Logique popup
├── options.html           — Page paramètres complète (4 sections)
├── options.js             — Logique page options
├── icons/
│   ├── icon.svg           — Source vectorielle (N + badge rouge)
│   ├── icon16.png         — Barre d'extensions
│   ├── icon32.png
│   ├── icon48.png         — Gestionnaire d'extensions
│   └── icon128.png        — Stores (Chrome Web Store, AMO)
├── _locales/
│   ├── fr/messages.json   — Chaînes françaises
│   └── en/messages.json   — Chaînes anglaises
├── LICENSE                — MIT
├── PRIVACY.md             — Politique de confidentialité complète
├── CREDITS.md             — Auteurs et composants tiers
└── CHANGELOG.md           — Historique des versions
```

---

## Fonctionnalités

- ✅ Détection automatique des pages de blocage NextDNS (0 faux positif)
- ✅ Formulaire structuré : email, prénom, contexte (chips), commentaire
- ✅ Mémorisation des coordonnées (email + prénom) sur l'appareil
- ✅ Mode one-click : envoi immédiat sans formulaire
- ✅ Anti-doublon 48h par domaine (avec bannière explicite)
- ✅ URL complète + referrer + motif de blocage NextDNS dans le signalement
- ✅ Validation email en temps réel
- ✅ Protection contre les injections (balises, code, event handlers)
- ✅ Compteur de caractères sur le commentaire
- ✅ Tooltips d'aide sur chaque champ
- ✅ Timeout 10s avec message d'erreur clair
- ✅ Focus trap clavier dans la modale (accessibilité)
- ✅ Bloc post-envoi avec bouton "Rafraîchir la page" (vide le cache)
- ✅ Page Options : paramètres, historique, aide, confidentialité, crédits
- ✅ Internationalisation FR / EN
- ✅ Compatible Chrome MV3 et Firefox (manifest `browser_specific_settings`)
- ✅ Zéro dépendance externe — Vanilla JS pur

---

## Confidentialité en résumé

- **Aucune collecte sur les pages normales** — le script s'arrête immédiatement si la page n'est pas une page de blocage NextDNS
- **Aucun envoi automatique** — les données ne partent que sur action explicite de l'utilisateur
- **Aucun tracker, aucune télémétrie**
- **Stockage local uniquement** — email, prénom et historique restent sur votre appareil
- Les signalements transitent par [Formspree](https://formspree.io) (service tiers)

Voir [PRIVACY.md](PRIVACY.md) pour la politique complète.

---

## Dépannage

**Le bouton n'apparaît pas**
→ Vérifiez que l'extension est activée dans `chrome://extensions` et rechargez-la (↺).

**La détection ne fonctionne plus**
→ NextDNS a peut-être mis à jour sa page de blocage. Ouvrez F12 → Elements sur la page
et vérifiez que `#titleText` et `#nextdnsLogoGradient` existent toujours.
[Ouvrez une issue](https://github.com/Ralph68/NextDNS-Reporter/issues) si c'est le cas.

**L'envoi échoue**
→ Vérifiez l'endpoint dans le popup. Vérifiez la limite mensuelle sur
[formspree.io/dashboard](https://formspree.io/dashboard) (50/mois en gratuit).

**Les emails arrivent dans les spams**
→ Ouvrez le premier email reçu et marquez-le "non-spam". Ajoutez l'expéditeur Formspree
à vos contacts. Évitez les textes de test génériques (lorem ipsum) qui déclenchent les filtres.

---

## Roadmap

- **v1.4** — Page admin légère permettant à l'administrateur de répondre aux demandes
- **v2.0** — Publication Chrome Web Store + Firefox AMO (installation sans mode développeur)
- **v2.1** — Détection automatique du compte Google pour identification (si permission accordée)

---

## Contribuer

Les contributions sont bienvenues. Ouvrez une issue avant de soumettre une PR.

```bash
# Cloner le dépôt
git clone https://github.com/Ralph68/NextDNS-Reporter.git

# Charger dans Chrome pour tester
# chrome://extensions → Mode développeur → Charger l'extension non empaquetée → dossier cloné
```

---

## Licence

MIT — voir [LICENSE](LICENSE)

## Auteurs

- **Jean-Thomas Runser** — Conception, product ownership
- **Claude (Anthropic)** — Développement du code source
