# Calculateur de sous-réseaux IPv4 (PWA)

Application web installable (Android, ordinateur) qui calcule, à partir d'une adresse IP
et d'un masque (CIDR `24`, `/24` ou décimal `255.255.255.0`) :

- l'adresse réseau et le broadcast
- la première et la dernière adresse utilisable
- le nombre d'hôtes, le masque et le wildcard

On peut aussi taper `192.168.1.10/24` directement dans le champ IP. Les cas /31 (RFC 3021)
et /32 sont gérés. L'appli fonctionne hors ligne une fois chargée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page : champs de saisie, boutons de masques courants, tableau des résultats |
| `style.css` | Mise en forme adaptée au tactile, thème clair/sombre automatique |
| `app.js` | Analyse des saisies et calculs binaires du sous-réseau |
| `manifest.webmanifest` | Nom, icônes, couleurs : rend l'appli installable |
| `sw.js` | Service worker : met les fichiers en cache pour le mode hors ligne |
| `icons/` | Icône SVG et PNG 192/512 px (dont une version « maskable » pour Android) |
| `.nojekyll` | Demande à GitHub Pages de servir les fichiers tels quels |

## Publication

GitHub Pages : *Settings → Pages → Deploy from a branch*, choisir la branche et le dossier `/ (root)`.
