# Calculateur de sous-réseaux IPv4 (PWA)

Application web installable (Android, ordinateur) qui calcule, à partir d'une adresse IP
et d'un masque (CIDR `24`, `/24` ou décimal `255.255.255.0`) :

- l'adresse réseau et le broadcast
- la première et la dernière adresse utilisable
- le nombre d'hôtes, le masque et le wildcard

On peut aussi taper `192.168.1.10/24` directement dans le champ IP. Les cas /31 (RFC 3021)
et /32 sont gérés. L'appli fonctionne hors ligne une fois chargée.

### Onglet « Plan d'adressage » (VLSM)

On saisit un bloc en CIDR (`10.0.0.0/22`) et une liste de VLAN (nom + nombre d'hôtes).
L'appli découpe le bloc du plus gros besoin au plus petit et affiche pour chaque VLAN :
réseau, masque, passerelle (1ʳᵉ adresse), plage utilisable et broadcast.

- Case « La passerelle s'ajoute au nombre d'hôtes » (cochée par défaut) : 60 hôtes + passerelle
  = 61 adresses. Décochée, la passerelle est comptée parmi les hôtes saisis.
- Taille minimale d'un VLAN : /30.
- Si le bloc est trop petit, un avertissement indique le besoin total et les VLAN non placés.
- Si l'adresse saisie n'est pas une adresse de réseau (`10.0.0.5/22`), elle est ajustée et signalée.
- La saisie est mémorisée localement dans le navigateur.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page : champs de saisie, boutons de masques courants, tableau des résultats |
| `style.css` | Mise en forme adaptée au tactile, thème clair/sombre automatique |
| `app.js` | Analyse des saisies et calculs binaires du sous-réseau (onglet Calcul) |
| `vlsm.js` | Onglet Plan d'adressage : découpage VLSM (réutilise les fonctions d'`app.js`) et gestion des onglets |
| `manifest.webmanifest` | Nom, icônes, couleurs : rend l'appli installable |
| `sw.js` | Service worker : met les fichiers en cache pour le mode hors ligne |
| `icons/` | Icône SVG et PNG 192/512 px (dont une version « maskable » pour Android) |
| `.nojekyll` | Demande à GitHub Pages de servir les fichiers tels quels |

## Publication

GitHub Pages : *Settings → Pages → Deploy from a branch*, choisir la branche et le dossier `/ (root)`.
