import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
  randomUUID,
} from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CARE_DEFAULTS, BOOKLET_DEFAULTS } from '../src/contentDefaults.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
const retentionDays = Math.max(30, Number(process.env.CHAT_RETENTION_DAYS || 90));
const adminPassword = process.env.ADMIN_PASSWORD || '';
const encryptionKeyText = process.env.CHAT_ENCRYPTION_KEY || '';
const encryptionKey = /^[a-f\d]{64}$/i.test(encryptionKeyText)
  ? Buffer.from(encryptionKeyText, 'hex')
  : null;
const chatReady = Boolean(encryptionKey && adminPassword.length >= 24 && !adminPassword.toLowerCase().includes('replace-with'));

mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'mother-care-chat.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    name_enc TEXT NOT NULL,
    contact_enc TEXT NOT NULL,
    topic_enc TEXT NOT NULL,
    access_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
    body_enc TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_by_conversation ON messages(conversation_id, id);
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('visitor', 'admin')),
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS care_content (
    content_key TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS booklet_content (
    slug TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
app.use(express.json({ limit: '12kb', type: 'application/json' }));

const cookieName = 'mother_care_session';
const cookieSecure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const cookieHeader = (token, maxAge) => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${cookieSecure}`;
const clearCookieHeader = `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${cookieSecure}`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function encrypt(value) {
  if (!encryptionKey) throw new Error('چت هنوز تنظیم نشده است.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

function decrypt(value) {
  if (!encryptionKey) throw new Error('کلید رمزگذاری چت تنظیم نشده است.');
  const [ivText, tagText, bodyText] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString('utf8');
}

function getCookie(req) {
  const cookieHeaderValue = req.headers.cookie || '';
  const item = cookieHeaderValue.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return item ? decodeURIComponent(item.slice(cookieName.length + 1)) : '';
}

function issueSession(res, role, conversationId = null, durationSeconds = 60 * 60 * 24 * 7) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(token_hash, role, conversation_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(sha256(token), role, conversationId, now + durationSeconds * 1000, now);
  res.setHeader('Set-Cookie', cookieHeader(token, durationSeconds));
}

function getSession(req, requiredRole) {
  const token = getCookie(req);
  if (!token) return null;
  const session = db.prepare('SELECT token_hash, role, conversation_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(sha256(token));
  if (!session || session.expires_at <= Date.now() || (requiredRole && session.role !== requiredRole)) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
    return null;
  }
  return session;
}

function requireChat(req, res, next) {
  if (!chatReady) return res.status(503).json({ error: 'گفت‌وگوی سایت هنوز راه‌اندازی نشده است.' });
  next();
}

function requireVisitor(req, res, next) {
  const session = getSession(req, 'visitor');
  if (!session || !session.conversation_id) return res.status(401).json({ error: 'برای دیدن گفت‌وگو، کد پیگیری را وارد کن.' });
  req.chatSession = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = getSession(req, 'admin');
  if (!session) return res.status(401).json({ error: 'برای ادامه وارد بخش مدیریت شو.' });
  req.chatSession = session;
  next();
}

const rates = new Map();
function rateLimit(req, res, key, limit, intervalMs) {
  const now = Date.now();
  const id = `${key}:${req.ip}`;
  const recent = (rates.get(id) || []).filter((timestamp) => now - timestamp < intervalMs);
  if (recent.length >= limit) {
    res.status(429).json({ error: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن.' });
    return false;
  }
  recent.push(now);
  rates.set(id, recent);
  return true;
}
setInterval(() => {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM conversations WHERE updated_at < ?').run(cutoff);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  for (const [key, values] of rates) if (values.every((time) => Date.now() - time > 60 * 60 * 1000)) rates.delete(key);
}, 60 * 60 * 1000).unref();

function publicConversation(row) {
  return {
    id: row.id,
    name: decrypt(row.name_enc),
    contact: decrypt(row.contact_enc),
    topic: decrypt(row.topic_enc),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicMessage(row) {
  return { id: row.id, sender: row.sender, body: decrypt(row.body_enc), createdAt: row.created_at };
}

function listMessages(conversationId) {
  return db.prepare('SELECT id, sender, body_enc, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 200')
    .all(conversationId).reverse().map(publicMessage);
}

function safeAdminPasswordEqual(candidate) {
  const expectedHash = createHash('sha256').update(adminPassword).digest();
  const candidateHash = createHash('sha256').update(candidate).digest();
  return timingSafeEqual(expectedHash, candidateHash);
}

function getCareContent() {
  const overrides = new Map(db.prepare('SELECT content_key, content_json FROM care_content').all().map((row) => [row.content_key, JSON.parse(row.content_json)]));
  return CARE_DEFAULTS.map((item) => ({ ...item, ...(overrides.get(item.key) || {}) }));
}

function getBooklets(includeUnpublished = false) {
  const overrides = new Map(db.prepare('SELECT slug, content_json, published, updated_at FROM booklet_content').all().map((row) => [row.slug, row]));
  const combined = new Map();
  for (const base of BOOKLET_DEFAULTS) {
    const row = overrides.get(base.slug);
    combined.set(base.slug, row ? { ...base, ...JSON.parse(row.content_json), published: Boolean(row.published), updatedAt: row.updated_at } : base);
  }
  for (const [slug, row] of overrides) {
    if (!combined.has(slug)) combined.set(slug, { ...JSON.parse(row.content_json), slug, published: Boolean(row.published), updatedAt: row.updated_at });
  }
  return [...combined.values()].filter((booklet) => includeUnpublished || booklet.published);
}

function sanitizeLines(value, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string' || item.trim().length > maxLength)) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function validateCareItem(body) {
  if (!body || typeof body !== 'object' || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160) return null;
  const tasks = sanitizeLines(body.tasks, 20, 1000);
  const tests = sanitizeLines(body.tests, 20, 1200);
  if (!tasks || !tests || typeof body.alerts !== 'string' || body.alerts.length > 2200 || typeof body.source !== 'string' || body.source.length > 600 || (body.reviewedAt !== undefined && (typeof body.reviewedAt !== 'string' || body.reviewedAt.length > 40))) return null;
  return { title: body.title.trim(), tasks, tests, alerts: body.alerts.trim(), source: body.source.trim(), reviewedAt: typeof body.reviewedAt === 'string' ? body.reviewedAt.trim() : '' };
}

function validateBooklet(body, slug) {
  if (!body || typeof body !== 'object' || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160 || typeof body.subtitle !== 'string' || body.subtitle.length > 180 || typeof body.description !== 'string' || body.description.length > 500 || typeof body.source !== 'string' || body.source.length > 1000 || (body.reviewedAt !== undefined && (typeof body.reviewedAt !== 'string' || body.reviewedAt.length > 40)) || typeof body.published !== 'boolean' || !Array.isArray(body.sections) || body.sections.length > 30) return null;
  const sections = [];
  let totalLength = 0;
  for (const section of body.sections) {
    if (!section || typeof section.heading !== 'string' || !section.heading.trim() || section.heading.length > 160 || typeof section.body !== 'string' || section.body.length > 6000) return null;
    const bullets = sanitizeLines(section.bullets, 30, 1000);
    if (!bullets) return null;
    totalLength += section.heading.length + section.body.length + bullets.join('').length;
    sections.push({ heading: section.heading.trim(), body: section.body.trim(), bullets });
  }
  if (totalLength > 50000) return null;
  return { slug, title: body.title.trim(), subtitle: body.subtitle.trim(), description: body.description.trim(), source: body.source.trim(), reviewedAt: typeof body.reviewedAt === 'string' ? body.reviewedAt.trim() : '', published: body.published, sections };
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', chatConfigured: chatReady }));
app.get('/api/content/care', (_req, res) => res.json({ care: getCareContent() }));
app.get('/api/content/booklets', (_req, res) => res.json({ booklets: getBooklets(false) }));
app.get('/api/content/booklets/:slug', (req, res) => {
  const booklet = getBooklets(false).find((item) => item.slug === req.params.slug);
  if (!booklet) return res.status(404).json({ error: 'این کتابچه پیدا نشد.' });
  res.json({ booklet });
});

app.post('/api/admin/login', requireChat, (req, res) => {
  if (!rateLimit(req, res, 'admin-login', 8, 15 * 60 * 1000)) return;
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!adminPassword || !safeAdminPasswordEqual(password)) return res.status(401).json({ error: 'رمز ورود درست نیست.' });
  issueSession(res, 'admin', null, 60 * 60 * 8);
  res.json({ ok: true });
});

app.get('/api/admin/session', requireChat, requireAdmin, (_req, res) => res.json({ ok: true }));
app.post('/api/admin/logout', requireChat, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.chatSession.token_hash);
  res.setHeader('Set-Cookie', clearCookieHeader);
  res.json({ ok: true });
});

app.get('/api/admin/content/care', requireChat, requireAdmin, (_req, res) => res.json({ care: getCareContent() }));
app.put('/api/admin/content/care/:key', requireChat, requireAdmin, (req, res) => {
  const base = CARE_DEFAULTS.find((item) => item.key === req.params.key);
  if (!base) return res.status(404).json({ error: 'این بخش مراقبت پیدا نشد.' });
  const content = validateCareItem(req.body);
  if (!content) return res.status(400).json({ error: 'محتوای مراقبت معتبر نیست؛ عنوان و فهرست‌ها را بررسی کن.' });
  db.prepare('INSERT INTO care_content(content_key, content_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(content_key) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at')
    .run(base.key, JSON.stringify(content), Date.now());
  res.json({ ok: true, content: { ...base, ...content } });
});
app.delete('/api/admin/content/care/:key', requireChat, requireAdmin, (req, res) => {
  const base = CARE_DEFAULTS.find((item) => item.key === req.params.key);
  if (!base) return res.status(404).json({ error: 'این بخش مراقبت پیدا نشد.' });
  db.prepare('DELETE FROM care_content WHERE content_key = ?').run(base.key);
  res.json({ ok: true, content: base });
});

app.get('/api/admin/content/booklets', requireChat, requireAdmin, (_req, res) => res.json({ booklets: getBooklets(true) }));
app.put('/api/admin/content/booklets/:slug', requireChat, requireAdmin, (req, res) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.slug) || req.params.slug.length > 48) return res.status(400).json({ error: 'نشانی کتابچه باید با حروف انگلیسی کوچک، عدد و خط تیره باشد.' });
  const content = validateBooklet(req.body, req.params.slug);
  if (!content) return res.status(400).json({ error: 'محتوای کتابچه معتبر نیست؛ عنوان، بخش‌ها و متن‌ها را بررسی کن.' });
  const now = Date.now();
  db.prepare('INSERT INTO booklet_content(slug, content_json, published, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET content_json = excluded.content_json, published = excluded.published, updated_at = excluded.updated_at')
    .run(content.slug, JSON.stringify(content), Number(content.published), now);
  res.json({ ok: true, booklet: { ...content, updatedAt: now } });
});
app.delete('/api/admin/content/booklets/:slug', requireChat, requireAdmin, (req, res) => {
  const slug = req.params.slug;
  const booklet = getBooklets(true).find((item) => item.slug === slug);
  if (!booklet) return res.status(404).json({ error: 'این کتابچه پیدا نشد.' });
  const hidden = { ...booklet, published: false };
  const now = Date.now();
  db.prepare('INSERT INTO booklet_content(slug, content_json, published, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(slug) DO UPDATE SET content_json = excluded.content_json, published = 0, updated_at = excluded.updated_at')
    .run(slug, JSON.stringify(hidden), now);
  res.json({ ok: true });
});

app.get('/api/admin/conversations', requireChat, requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT id, name_enc, contact_enc, topic_enc, status, created_at, updated_at FROM conversations ORDER BY CASE status WHEN \'open\' THEN 0 ELSE 1 END, updated_at DESC LIMIT 300').all();
  res.json({ conversations: rows.map(publicConversation) });
});

app.get('/api/admin/conversations/:id/messages', requireChat, requireAdmin, (req, res) => {
  const found = db.prepare('SELECT id FROM conversations WHERE id = ?').get(req.params.id);
  if (!found) return res.status(404).json({ error: 'این گفت‌وگو پیدا نشد.' });
  res.json({ messages: listMessages(found.id) });
});

app.post('/api/admin/conversations/:id/messages', requireChat, requireAdmin, (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (body.length < 1 || body.length > 2000) return res.status(400).json({ error: 'پیام باید بین ۱ تا ۲۰۰۰ نویسه باشد.' });
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'این گفت‌وگو پیدا نشد.' });
  const now = Date.now();
  db.prepare('INSERT INTO messages(conversation_id, sender, body_enc, created_at) VALUES (?, \'admin\', ?, ?)')
    .run(conversation.id, encrypt(body), now);
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversation.id);
  res.status(201).json({ ok: true });
});

app.patch('/api/admin/conversations/:id', requireChat, requireAdmin, (req, res) => {
  const status = req.body?.status;
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'وضعیت گفت‌وگو معتبر نیست.' });
  const result = db.prepare('UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'این گفت‌وگو پیدا نشد.' });
  res.json({ ok: true });
});

app.post('/api/chat/conversations', requireChat, (req, res) => {
  if (!rateLimit(req, res, 'chat-create', 5, 60 * 60 * 1000)) return;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const contact = typeof req.body?.contact === 'string' ? req.body.contact.trim() : '';
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
  const body = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const allowedTopics = ['شیردهی', 'بارداری', 'مراقبت نوزاد', 'پس از زایمان', 'موضوع دیگر'];
  if (name.length < 2 || name.length > 80 || contact.length > 120 || !allowedTopics.includes(topic) || body.length < 8 || body.length > 2000) {
    return res.status(400).json({ error: 'نام، موضوع یا متن پیام معتبر نیست. متن پیام باید حداقل ۸ نویسه باشد.' });
  }
  const id = randomUUID();
  const accessCode = randomBytes(9).toString('base64url').toUpperCase();
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO conversations(id, name_enc, contact_enc, topic_enc, access_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, \'open\', ?, ?)')
      .run(id, encrypt(name), encrypt(contact), encrypt(topic), sha256(accessCode), now, now);
    db.prepare('INSERT INTO messages(conversation_id, sender, body_enc, created_at) VALUES (?, \'visitor\', ?, ?)')
      .run(id, encrypt(body), now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  issueSession(res, 'visitor', id);
  res.status(201).json({ conversation: { id, name, topic, status: 'open', createdAt: now, updatedAt: now }, accessCode, messages: listMessages(id) });
});

app.post('/api/chat/access', requireChat, (req, res) => {
  if (!rateLimit(req, res, 'chat-access', 10, 15 * 60 * 1000)) return;
  const accessCode = typeof req.body?.accessCode === 'string' ? req.body.accessCode.replace(/[\s-]/g, '').toUpperCase() : '';
  if (!/^[A-Z\d_-]{10,32}$/.test(accessCode)) return res.status(400).json({ error: 'کد پیگیری را بررسی کن.' });
  const conversation = db.prepare('SELECT id FROM conversations WHERE access_hash = ?').get(sha256(accessCode));
  if (!conversation) return res.status(401).json({ error: 'گفت‌وگویی با این کد پیدا نشد.' });
  issueSession(res, 'visitor', conversation.id);
  res.json({ ok: true });
});

app.get('/api/chat/session', requireChat, (req, res) => {
  const session = getSession(req, 'visitor');
  if (!session || !session.conversation_id) return res.status(401).json({ error: 'گفت‌وگویی در این مرورگر باز نیست.' });
  const row = db.prepare('SELECT id, name_enc, contact_enc, topic_enc, status, created_at, updated_at FROM conversations WHERE id = ?').get(session.conversation_id);
  if (!row) return res.status(404).json({ error: 'این گفت‌وگو پیدا نشد.' });
  res.json({ conversation: publicConversation(row), messages: listMessages(row.id) });
});

app.get('/api/chat/messages', requireChat, requireVisitor, (req, res) => {
  res.json({ messages: listMessages(req.chatSession.conversation_id) });
});

app.post('/api/chat/messages', requireChat, requireVisitor, (req, res) => {
  if (!rateLimit(req, res, 'chat-message', 30, 60 * 60 * 1000)) return;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (body.length < 1 || body.length > 2000) return res.status(400).json({ error: 'پیام باید بین ۱ تا ۲۰۰۰ نویسه باشد.' });
  const conversation = db.prepare('SELECT status FROM conversations WHERE id = ?').get(req.chatSession.conversation_id);
  if (!conversation || conversation.status !== 'open') return res.status(409).json({ error: 'این گفت‌وگو بسته شده است.' });
  const now = Date.now();
  db.prepare('INSERT INTO messages(conversation_id, sender, body_enc, created_at) VALUES (?, \'visitor\', ?, ?)')
    .run(req.chatSession.conversation_id, encrypt(body), now);
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, req.chatSession.conversation_id);
  res.status(201).json({ ok: true });
});

app.post('/api/chat/logout', requireChat, (req, res) => {
  const session = getSession(req, 'visitor');
  if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
  res.setHeader('Set-Cookie', clearCookieHeader);
  res.json({ ok: true });
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'انجام درخواست ممکن نشد؛ کمی بعد دوباره تلاش کن.' });
});

app.listen(port, () => console.info(`API listening on http://localhost:${port}; chat ${chatReady ? 'configured' : 'needs local .env setup'}`));
