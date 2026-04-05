const express = require('express');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const auth = require('../middleware/auth');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function getResourceType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'video';
  return 'raw';
}

function getFolder(mimetype) {
  if (mimetype.startsWith('image/')) return 'ing1bmag/images';
  if (mimetype.startsWith('video/')) return 'ing1bmag/videos';
  if (mimetype.startsWith('audio/')) return 'ing1bmag/audios';
  return 'ing1bmag/documents';
}

router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const resourceType = getResourceType(req.file.mimetype);
  const folder = getFolder(req.file.mimetype);
  try {
    const uploadOpts = {
      resource_type: resourceType,
      folder,
      use_filename: true,
      unique_filename: true,
    };

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOpts,
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: resourceType,
      format: result.format,
      size: result.bytes,
      original_name: req.file.originalname,
      mimetype: req.file.mimetype,
    });
  } catch(e) { res.status(500).json({ error: 'Erreur upload : ' + e.message }); }
});

router.post('/upload/avatar', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Image uniquement' });
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', folder: 'ing1bmag/avatars',
          transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
          public_id: 'avatar_' + req.user.id + '_' + Date.now() },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    const db = require('../database');
    db.run('UPDATE users SET avatar=? WHERE id=?', [result.secure_url, req.user.id]);
    res.json({ url: result.secure_url });
  } catch(e) { res.status(500).json({ error: 'Erreur avatar : ' + e.message }); }
});

module.exports = router;
