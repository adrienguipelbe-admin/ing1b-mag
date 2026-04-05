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
  db.get('SELECT * FROM polls WHERE active=1 ORDER BY id DESC', [], (err, poll) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!poll) return res.json({ question: null, options: [], total: 0 });
    db.all('SELECT * FROM poll_options WHERE poll_id=? ORDER BY id', [poll.id], (_, opts) => {
      const total = opts.reduce((s, r) => s + r.votes, 0);
      res.json({ id: poll.id, question: poll.question, options: opts, total });
    });
  });
});

router.post('/poll', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { question, options } = req.body;
  if (!question || !options || options.length < 2)
    return res.status(400).json({ error: 'Question et au moins 2 options requises' });
  // Désactiver l'ancien sondage
  db.run('UPDATE polls SET active=0', [], () => {
    db.run('INSERT INTO polls (question, active) VALUES (?,1)', [question], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const pollId = this.lastID;
      // Vider les votes
      db.run('DELETE FROM poll_voters WHERE 1=1');
      let done = 0;
      options.forEach(label => {
        db.run('INSERT INTO poll_options (poll_id, label, votes) VALUES (?,?,0)', [pollId, label], () => {
          done++;
          if (done === options.length) {
            res.json({ success: true, pollId });
          }
        });
      });
    });
  });
});

router.post('/poll/:optionId/vote', auth, (req, res) => {
  const userId = req.user.id;
  const optionId = parseInt(req.params.optionId);
  const previousId = req.body && req.body.previous ? parseInt(req.body.previous) : null;

  const doVote = () => {
    db.run('UPDATE poll_options SET votes=votes+1 WHERE id=?', [optionId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('INSERT OR REPLACE INTO poll_voters (user_id,option_id) VALUES (?,?)', [userId, optionId], () => {
        db.get('SELECT poll_id FROM poll_options WHERE id=?', [optionId], (_, opt) => {
          db.all('SELECT * FROM poll_options WHERE poll_id=? ORDER BY id', [opt.poll_id], (_, rows) => {
            const total = rows.reduce((s, r) => s + r.votes, 0);
            res.json({ options: rows, total, voted: optionId });
          });
        });
      });
    });
  };

  if (previousId) {
    // Annuler le vote précédent
    db.run('UPDATE poll_options SET votes=MAX(0,votes-1) WHERE id=?', [previousId], () => {
      doVote();
    });
  } else {
    doVote();
  }
});

// ── FLASH INFO ────────────────────────────────────────────────

router.get('/flash', (_, res) => {
  db.all('SELECT * FROM flash_info ORDER BY position ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/flash', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { text, emoji } = req.body;
  if (!text) return res.status(400).json({ error: 'Texte requis' });
  db.run('INSERT INTO flash_info (text, emoji) VALUES (?,?)', [text, emoji||'📌'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM flash_info WHERE id=?', [this.lastID], (_, row) => res.status(201).json(row));
  });
});

router.delete('/flash/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  db.run('DELETE FROM flash_info WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
