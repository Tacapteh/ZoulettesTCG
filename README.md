# 🃏 SQUAD TCG — Card Forge

Application de création de cartes TCG pour jouer avec tes potes.  
Mot de passe admin : **`tcb`**

---

## 📁 Structure du projet

```
squad-tcg/
├── public/
│   └── Carte_de_base.svg   ← TON SVG (fond de carte)
├── src/
│   ├── App.jsx              ← L'application complète
│   └── main.jsx             ← Point d'entrée Vite
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 Installation locale (Vite)

```bash
# 1. Créer le projet Vite
npm create vite@latest squad-tcg -- --template react
cd squad-tcg

# 2. Remplacer src/App.jsx par le fichier fourni

# 3. Copier Carte_de_base.svg dans /public/
cp Carte_de_base.svg public/

# 4. Installer les dépendances
npm install

# 5. Lancer en local
npm run dev
```

---

## 🌐 Déploiement Vercel (recommandé pour partager)

```bash
# 1. Build
npm run build

# 2. Deploy via Vercel CLI
npm i -g vercel
vercel

# Ou connecte ton repo GitHub à https://vercel.com
# → Vercel détecte Vite automatiquement
# → Build command: npm run build
# → Output dir: dist
```

---

## 🚂 Déploiement Render

1. Crée un repo GitHub avec la structure ci-dessus
2. Sur https://render.com → "New Static Site"
3. Settings :
   - **Build command** : `npm install && npm run build`
   - **Publish directory** : `dist`
4. Deploy !

---

## 🔧 Personnalisation

### Ajouter des profils de potes par défaut

Dans `App.jsx`, cherche `INIT_PROFILES` et ajoute :

```js
const INIT_PROFILES = [
  { id: "lechich", name: "Le Chich", bio: "Dev boss.", photos: [] },
  { id: "kevin",   name: "Kévin",    bio: "Le roi de la pizza.", photos: [] },
  { id: "max",     name: "Max",      bio: "...", photos: [] },
];
```

### Changer le mot de passe admin

```js
const ADMIN_PASSWORD = "ton_nouveau_mdp";
```

### Persistance des données (base de données)

Par défaut l'app est **sans backend** (données en mémoire, perdues au refresh).  
Pour persister les cartes, plusieurs options :

**Option A — localStorage** (simple, 1 utilisateur) :
```js
// Dans App, charger au démarrage :
const [cards, setCards] = useState(() => {
  try { return JSON.parse(localStorage.getItem("tcg_cards") || "[]"); } catch { return []; }
});
// Sauvegarder à chaque modification :
useEffect(() => {
  localStorage.setItem("tcg_cards", JSON.stringify(cards));
}, [cards]);
```

**Option B — Supabase** (plusieurs utilisateurs, gratuit) :
- Crée un projet sur https://supabase.com
- Ajoute `npm install @supabase/supabase-js`
- Remplace `useState([])` par des appels `supabase.from("cards").select()`

**Option C — Firebase Firestore** (real-time, gratuit tier) :
- https://firebase.google.com → Firestore Database

---

## 📐 Zones SVG superposées

Le SVG `Carte_de_base.svg` est utilisé comme fond (viewBox `0 0 616.5 841.5`).  
Les textes dynamiques sont superposés en SVG overlay :

| Zone     | Position (SVG units) |
|----------|----------------------|
| Photo    | x:13 y:88 w:565 h:450 |
| Textbox  | x:41 y:516 w:534 h:295 |
| Nom      | x:52 y:55 |
| PV       | x:590 y:55 (anchor end) |
| ATK      | x:30 y:821 |
| DEF      | x:600 y:821 (anchor end) |
| Famille  | cx:600 cy:300 (rotation 90°) |

---

## 🎮 Utilisation

### Admin (mot de passe `tcb`)
- Créer / modifier / supprimer des cartes
- Exporter en PNG haute résolution
- Gérer les profils des potes

### Pote (choisir son profil)
- Voir la collection complète
- Télécharger les cartes en PNG

---

*Fait avec ❤️ pour jouer entre amis.*
