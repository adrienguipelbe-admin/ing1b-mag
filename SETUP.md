# 🚀 Guide de déploiement — ING1B Mag
## Du code au lien en ligne, étape par étape

---

## ÉTAPE 1 — Installer les outils (une seule fois)

### Node.js
1. Va sur https://nodejs.org
2. Clique "Download LTS" (version stable)
3. Installe normalement (suivre l'assistant)
4. Vérification : ouvre un terminal (cmd ou PowerShell) et tape :
   ```
   node -v
   npm -v
   ```
   Tu dois voir des numéros de version.

### Git
1. Va sur https://git-scm.com/downloads
2. Télécharge pour Windows / Mac selon ton système
3. Installe (laisse les options par défaut)
4. Vérification :
   ```
   git --version
   ```

---

## ÉTAPE 2 — Configurer le backend sur ton PC

1. Place le dossier `ing1b-mag` sur ton bureau

2. Ouvre un terminal dans `ing1b-mag/backend/`
   - **Windows** : clic droit dans le dossier → "Ouvrir dans le terminal"
   - **Mac** : clic droit → "Nouveau terminal au dossier"

3. Installe les dépendances :
   ```
   npm install
   ```

4. Crée le fichier de configuration :
   - Copie `.env.example` → renomme-le `.env`
   - Ouvre `.env` avec Notepad ou VS Code
   - Remplace les valeurs :
     ```
     ADMIN_EMAIL=TON_EMAIL@gmail.com        ← ton email Google
     JWT_SECRET=mets_une_longue_phrase_ici_abc123xyz
     GOOGLE_CLIENT_ID=                      ← tu le mettras à l'étape 3
     FRONTEND_URL=http://localhost:5500
     ```

5. Lance le backend :
   ```
   node server.js
   ```
   Tu dois voir :
   ```
   ✅ Backend démarré sur http://localhost:3001
   📁 Base de données : ing1bmag.db
   ```

6. Ouvre le frontend :
   - Installe l'extension **Live Server** dans VS Code
   - Clic droit sur `frontend/index.html` → "Open with Live Server"
   - Le site s'ouvre sur http://localhost:5500

---

## ÉTAPE 3 — Configurer Google OAuth (connexion avec Google)

1. Va sur https://console.cloud.google.com
2. Connecte-toi avec ton compte Google
3. Clique "Créer un projet" → donne un nom (ex: ing1b-mag) → Créer

4. Dans le menu : APIs & Services → Identifiants

5. "+ Créer des identifiants" → "ID client OAuth 2.0"
   - Type : **Application Web**
   - Nom : ING1B Mag

6. Origines JavaScript autorisées — ajoute :
   ```
   http://localhost:5500
   http://localhost:3000
   ```
   (tu ajouteras l'URL Netlify plus tard)

7. URI de redirection autorisés — laisse vide pour l'instant

8. Clique "Créer" → copie ton **Client ID** (format : xxxxx.apps.googleusercontent.com)

9. Dans `backend/.env` :
   ```
   GOOGLE_CLIENT_ID=le_client_id_que_tu_viens_de_copier
   ```

10. Dans `frontend/index.html`, ligne ~580 :
    ```javascript
    const GOOGLE_CLIENT_ID = 'le_client_id_que_tu_viens_de_copier';
    ```

11. Relance le backend (`node server.js`)

---

## ÉTAPE 4 — Mettre le code sur GitHub

1. Crée un compte sur https://github.com (si tu n'en as pas)

2. Crée un nouveau dépôt :
   - Clique "+" → "New repository"
   - Nom : `ing1b-mag`
   - Public
   - Clique "Create repository"

3. Dans ton terminal (dossier `ing1b-mag/`) :
   ```bash
   git init
   git add .
   git commit -m "ING1B Mag - premier commit"
   git branch -M main
   git remote add origin https://github.com/TON_USERNAME/ing1b-mag.git
   git push -u origin main
   ```
   Remplace `TON_USERNAME` par ton nom d'utilisateur GitHub.

---

## ÉTAPE 5 — Déployer le backend sur Render (gratuit)

1. Va sur https://render.com → crée un compte (avec GitHub c'est plus simple)

2. "New +" → "Web Service"

3. Connecte ton GitHub → sélectionne le dépôt `ing1b-mag`

4. Configure :
   - **Name** : ing1b-mag-backend
   - **Root Directory** : backend
   - **Environment** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Instance Type** : Free

5. Section "Environment Variables" — ajoute :
   ```
   PORT            = 3001
   JWT_SECRET      = (ta valeur du .env)
   ADMIN_EMAIL     = (ton email)
   GOOGLE_CLIENT_ID = (ton client id)
   FRONTEND_URL    = https://ing1bmag.netlify.app  (tu mettras l'URL Netlify après)
   ```

6. Clique "Create Web Service"
   → Render build et déploie (2-3 minutes)
   → Tu obtiens une URL : `https://ing1b-mag-backend.onrender.com`

7. Teste : ouvre `https://ing1b-mag-backend.onrender.com/api/health`
   Tu dois voir : `{"status":"ok",...}`

---

## ÉTAPE 6 — Déployer le frontend sur Netlify (gratuit)

1. Va sur https://netlify.com → crée un compte

2. "Add new site" → "Import an existing project" → GitHub

3. Sélectionne `ing1b-mag` → Configure :
   - **Base directory** : frontend
   - **Publish directory** : frontend
   - Laisse Build command vide

4. Clique "Deploy site"
   → Tu obtiens une URL : `https://random-name.netlify.app`

5. Dans le fichier `frontend/index.html`, ligne ~580, mets à jour :
   ```javascript
   const API = 'https://ing1b-mag-backend.onrender.com/api';
   ```

6. Dans `backend/.env` (et sur Render) :
   ```
   FRONTEND_URL = https://random-name.netlify.app
   ```

7. Dans Google Cloud Console, ajoute :
   - Origines JS autorisées : `https://random-name.netlify.app`

8. Re-commit et push :
   ```bash
   git add .
   git commit -m "Config production"
   git push
   ```
   → Render et Netlify se mettent à jour automatiquement !

---

## ÉTAPE 7 — Personnaliser ton URL (optionnel)

Sur Netlify : Site settings → Domain management → "Add custom domain"
Tu peux avoir `ing1bmag.netlify.app` ou même un vrai domaine si tu en achètes un.

---

## ✅ Résultat final

- **Site** : https://ton-site.netlify.app
- **Backend** : https://ing1b-mag-backend.onrender.com
- **Base de données** : sur le serveur Render (SQLite)
- **Connexion** : Email/Mot de passe + Google OAuth
- **Admin** : Connecte-toi avec ADMIN_EMAIL → bouton ⚙️ apparaît → panneau admin complet

---

## 🔧 Commandes utiles

```bash
# Lancer le backend en local
cd backend && node server.js

# Lancer avec rechargement automatique (dev)
cd backend && npx nodemon server.js

# Push des modifications
git add . && git commit -m "Mise à jour" && git push
```

---

## ⚠️ Notes importantes

- Sur Render (plan gratuit), le serveur "s'endort" après 15min d'inactivité.
  Le premier chargement peut prendre 30-60 secondes. C'est normal.
  Pour éviter ça : https://uptimerobot.com (ping toutes les 5min, gratuit)

- Ne partage JAMAIS ton fichier `.env` (il contient tes clés secrètes)
  Le `.gitignore` l'exclut déjà automatiquement.

- Pour créer ton compte admin : inscris-toi avec l'email défini dans ADMIN_EMAIL.
  Le rôle admin est attribué automatiquement à la création du compte.
