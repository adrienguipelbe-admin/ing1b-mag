const express = require('express');
const db      = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── LISTER LES ARTICLES ───────────────────────────────────────
router.get('/', (req, res) => {
  const { rubrique, status, limit } = req.query;
  let q = `SELECT a.*, u.name as author_name, u.avatar as author_avatar
           FROM articles a
           LEFT JOIN users u ON a.author_id = u.id
           WHERE 1=1`;
  const params = [];

  // Les non-admins ne voient que les publiés
  const wantsAll = status === 'all' && req.headers.authorization;
  if (!wantsAll) {
    q += ' AND a.status = "published"';
  } else if (status && status !== 'all') {
    q += ' AND a.status = ?'; params.push(status);
  }

  if (rubrique) { q += ' AND a.rubrique = ?'; params.push(rubrique); }
  q += ' ORDER BY a.created_at DESC';
  if (limit) { q += ' LIMIT ?'; params.push(parseInt(limit)); }

  db.all(q, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── UN ARTICLE PAR ID ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  db.get(
    `SELECT a.*, u.name as author_name, u.avatar as author_avatar
     FROM articles a LEFT JOIN users u ON a.author_id=u.id
     WHERE a.id=?`,
    [req.params.id],
    (_, row) => {
      if (!row) return res.status(404).json({ error: 'Article introuvable' });
      // Incrémenter les vues
      db.run('UPDATE articles SET views=views+1 WHERE id=?', [row.id]);
      res.json(row);
    }
  );
});

// ── CRÉER UN ARTICLE (admin) ──────────────────────────────────
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Réservé à l\'administrateur' });

  const { title, kicker, excerpt, body, rubrique, cover_emoji, cover_color, status } = req.body;
  if (!title || !body || !rubrique)
    return res.status(400).json({ error: 'Titre, corps et rubrique sont requis' });

  db.run(
    `INSERT INTO articles (title,kicker,excerpt,body,rubrique,author_id,cover_emoji,cover_color,status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [title, kicker||'', excerpt||'', body, rubrique, req.user.id,
     cover_emoji||'📰', cover_color||'#1A2E6E', status||'draft'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT a.*, u.name as author_name FROM articles a LEFT JOIN users u ON a.author_id=u.id WHERE a.id=?',
        [this.lastID], (_, row) => res.status(201).json(row));
    }
  );
});

// ── MODIFIER UN ARTICLE (admin) ───────────────────────────────
router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Réservé à l\'administrateur' });

  const { title, kicker, excerpt, body, rubrique, cover_emoji, cover_color, status } = req.body;
  db.run(
    `UPDATE articles SET title=?,kicker=?,excerpt=?,body=?,rubrique=?,
     cover_emoji=?,cover_color=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [title, kicker, excerpt, body, rubrique, cover_emoji, cover_color, status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Article introuvable' });
      db.get('SELECT * FROM articles WHERE id=?', [req.params.id], (_, row) => res.json(row));
    }
  );
});

// ── PUBLIER / DÉPUBLIER (admin) ───────────────────────────────
router.patch('/:id/status', auth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Réservé à l\'administrateur' });

  const { status } = req.body;
  if (!['draft','published'].includes(status))
    return res.status(400).json({ error: 'Statut invalide' });

  db.run('UPDATE articles SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, status });
    }
  );
});

// ── SUPPRIMER UN ARTICLE (admin) ──────────────────────────────
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Réservé à l\'administrateur' });

  db.run('DELETE FROM articles WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Article introuvable' });
    res.json({ success: true });
  });
});

module.exports = router;
