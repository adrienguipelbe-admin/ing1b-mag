const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db       = require('../database');
const auth     = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, avatar: user.avatar },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, bio: u.bio };
}

// ── INSCRIPTION ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'reader';

    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
      [name.trim(), email.toLowerCase(), hash, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        db.get('SELECT * FROM users WHERE id=?', [this.lastID], (_, user) => {
          res.status(201).json({ token: makeToken(user), user: safeUser(user) });
        });
      }
    );
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── CONNEXION EMAIL ───────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  db.get('SELECT * FROM users WHERE email=?', [email.toLowerCase()], async (_, user) => {
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    res.json({ token: makeToken(user), user: safeUser(user) });
  });
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Token Google manquant' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const { sub, email, name, picture } = ticket.getPayload();
    const role = email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'reader';

    db.get('SELECT * FROM users WHERE google_id=? OR email=?', [sub, email.toLowerCase()], (_, existing) => {
      if (existing) {
        // Mise à jour google_id si connexion email existante
        if (!existing.google_id) {
          db.run('UPDATE users SET google_id=?, avatar=? WHERE id=?', [sub, picture, existing.id]);
        }
        return res.json({ token: makeToken(existing), user: safeUser(existing) });
      }

      db.run(
        'INSERT INTO users (name, email, google_id, role, avatar) VALUES (?,?,?,?,?)',
        [name, email.toLowerCase(), sub, role, picture],
        function(err) {
          if (err) return res.status(500).json({ error: 'Erreur lors de la création du compte' });
          db.get('SELECT * FROM users WHERE id=?', [this.lastID], (_, user) => {
            res.status(201).json({ token: makeToken(user), user: safeUser(user) });
          });
        }
      );
    });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: 'Token Google invalide' });
  }
});

// ── PROFIL COURANT ────────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  db.get('SELECT * FROM users WHERE id=?', [req.user.id], (_, user) => {
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(safeUser(user));
  });
});

// ── MODIFIER SON PROFIL ───────────────────────────────────────
router.put('/me', auth, (req, res) => {
  const { name, bio } = req.body;
  db.run('UPDATE users SET name=?, bio=? WHERE id=?', [name, bio, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    db.get('SELECT * FROM users WHERE id=?', [req.user.id], (_, user) => res.json(safeUser(user)));
  });
});

// ── LISTE USERS (admin) ───────────────────────────────────────
router.get('/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  db.all('SELECT id,name,email,role,avatar,created_at FROM users ORDER BY created_at DESC', [], (_, rows) => {
    res.json(rows);
  });
});

// ── CHANGER RÔLE (admin) ──────────────────────────────────────
router.put('/users/:id/role', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { role } = req.body;
  if (!['admin','reader'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  db.run('UPDATE users SET role=? WHERE id=?', [role, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json({ success: true });
  });
});

// Route temporaire - supprimer après utilisation
router.get('/reset-admin-pwd', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('admin123', 12);
  db.run('UPDATE users SET password=? WHERE email=?',
    [hash, 'adrienguipelbe@gmail.com'],
    function(err) {
      if (err) return res.json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
});

module.exports = router;
