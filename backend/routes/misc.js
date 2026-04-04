const express = require('express');
const db      = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── AGENDA ────────────────────────────────────────────────────

router.get('/agenda', (_, res) => {
  db.all('SELECT * FROM agenda ORDER BY date ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/agenda', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { title, description, date, tag, tag_color } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Titre et date requis' });
  db.run(
    'INSERT INTO agenda (title,description,date,tag,tag_color) VALUES (?,?,?,?,?)',
    [title, description||'', date, tag||'', tag_color||'#1A2E6E'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM agenda WHERE id=?', [this.lastID], (_, row) => res.status(201).json(row));
    }
  );
});

router.delete('/agenda/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  db.run('DELETE FROM agenda WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ── SONDAGE ───────────────────────────────────────────────────

router.get('/poll', (_, res) => {
  db.all('SELECT * FROM poll_options ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = rows.reduce((s, r) => s + r.votes, 0);
    res.json({ options: rows, total });
  });
});

router.post('/poll/:optionId/vote', auth, (req, res) => {
  const userId = req.user.id;
  const optionId = parseInt(req.params.optionId);

  db.get('SELECT * FROM poll_voters WHERE user_id=?', [userId], (_, existing) => {
    if (existing) return res.status(409).json({ error: 'Tu as déjà voté' });

    db.run('UPDATE poll_options SET votes=votes+1 WHERE id=?', [optionId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('INSERT INTO poll_voters (user_id,option_id) VALUES (?,?)', [userId, optionId], () => {
        db.all('SELECT * FROM poll_options ORDER BY id', [], (_, rows) => {
          const total = rows.reduce((s, r) => s + r.votes, 0);
          res.json({ options: rows, total, voted: optionId });
        });
      });
    });
  });
});

module.exports = router;
