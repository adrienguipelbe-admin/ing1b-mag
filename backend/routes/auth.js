const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, avatar: user.avatar },
    process.env.JWT_SECRET, { expiresIn: '30d' }
  );
}
function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, bio: u.bio };
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 min.)' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'reader';
    const result = await query(
      'INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING *',
      [name.trim(), email.toLowerCase(), hash, role]
    );
    const user = result.rows[0];
    res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  try {
    const result = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !user.password) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Token Google manquant' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub, email, name, picture } = ticket.getPayload();
    const role = email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'reader';
    const existing = await query('SELECT * FROM users WHERE google_id=$1 OR email=$2', [sub, email.toLowerCase()]);
    if (existing.rows[0]) {
      const user = existing.rows[0];
      if (!user.google_id) await query('UPDATE users SET google_id=$1, avatar=$2 WHERE id=$3', [sub, picture, user.id]);
      return res.json({ token: makeToken(user), user: safeUser(user) });
    }
    const result = await query(
      'INSERT INTO users (name,email,google_id,role,avatar) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, email.toLowerCase(), sub, role, picture]
    );
    const user = result.rows[0];
    res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch(e) { res.status(401).json({ error: 'Token Google invalide' }); }
});

router.get('/me', auth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(safeUser(result.rows[0]));
  } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.put('/me', auth, async (req, res) => {
  const { name, bio } = req.body;
  try {
    const result = await query('UPDATE users SET name=$1, bio=$2 WHERE id=$3 RETURNING *', [name, bio, req.user.id]);
    res.json(safeUser(result.rows[0]));
  } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.get('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    const result = await query('SELECT id,name,email,role,avatar,created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.put('/users/:id/role', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { role } = req.body;
  if (!['admin','reader'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  try {
    await query('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
