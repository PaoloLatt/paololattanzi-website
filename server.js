require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

// ── Bootstrap: ensure required dirs and files exist ──────────────────────────
function ensureSetup() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  if (!fs.existsSync(CONFIG_FILE)) {
    const hash = bcrypt.hashSync('admin123', 10);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ username: 'admin', passwordHash: hash }, null, 2));
    console.log('\n⚠️  Default admin created  →  username: admin  /  password: admin123');
    console.log('   Change this immediately via Admin › Settings › Change Password\n');
  }

  if (!fs.existsSync(CONTENT_FILE)) {
    // content.json should already be committed; this is a safety fallback
    fs.writeFileSync(CONTENT_FILE, JSON.stringify({ _note: 'content.json missing – run git checkout' }, null, 2));
    console.log('⚠️  data/content.json was missing – placeholder created');
  }
}

ensureSetup();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password required' });
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const valid = await bcrypt.compare(password, config.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ username: config.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, username: config.username });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const valid = await bcrypt.compare(currentPassword, config.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    config.passwordHash = await bcrypt.hash(newPassword, 10);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Content routes ────────────────────────────────────────────────────────────
app.get('/api/content', (_req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to read content' });
  }
});

app.put('/api/content', requireAuth, (req, res) => {
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Content must be a JSON object' });
  }
  try {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save content' });
  }
});

// ── Image upload ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 6) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  }
});

app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ── Static files (last) ───────────────────────────────────────────────────────
app.use(express.static(ROOT));

// /admin → serve admin SPA
app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'admin', 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌐  Website:  http://localhost:${PORT}`);
  console.log(`🔧  Admin:    http://localhost:${PORT}/admin\n`);
});
