import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_ASSETS,
  DEFAULT_CAMERA_STOPS,
  DEFAULT_ELEMENTS,
  DEFAULT_RSVPS,
  DEFAULT_SETTINGS,
  DEFAULT_WISHES,
} from './src/data/defaultSeed.ts';
import type {
  AdminUser,
  AssetCategory,
  CameraStop,
  CanvasElement,
  MediaAsset,
  RsvpEntry,
  WeddingSettings,
  WishEntry,
} from './src/types/wedding.ts';

dotenv.config();

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin';
  createdAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  settings: WeddingSettings;
  assets: MediaAsset[];
  elements: CanvasElement[];
  cameraStops: CameraStop[];
  rsvps: RsvpEntry[];
  wishes: WishEntry[];
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'atelier-fleur-dev-session-secret-2027';
const SESSION_COOKIE_NAME = 'atelier_session';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function signSessionToken(payload: { userId: string; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): { userId: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      userId: string;
      exp: number;
    };
    if (!parsed.userId || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function createInitialDb(): DatabaseSchema {
  return {
    users: [
      {
        id: 'admin-seed-1',
        name: 'Pengelola Undangan',
        email: 'admin@atelierfleur.id',
        passwordHash: hashPassword('floral2026'),
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
    ],
    settings: DEFAULT_SETTINGS,
    assets: DEFAULT_ASSETS,
    elements: DEFAULT_ELEMENTS,
    cameraStops: DEFAULT_CAMERA_STOPS,
    rsvps: DEFAULT_RSVPS,
    wishes: DEFAULT_WISHES,
  };
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    let dirty = false;
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = createInitialDb().users;
      dirty = true;
    }
    parsed.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
    if (
      !parsed.cameraStops ||
      (parsed.cameraStops.length === 6 &&
        Math.abs(parsed.cameraStops[1]?.camX ?? 0) < 0.25 &&
        Math.abs(parsed.cameraStops[2]?.camX ?? 0) < 0.25)
    ) {
      parsed.cameraStops = DEFAULT_CAMERA_STOPS;
      parsed.elements = DEFAULT_ELEMENTS;
      dirty = true;
    }
    if (dirty) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    }
    return parsed;
  } catch {
    const fallback = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

function saveDb(db: DatabaseSchema): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = loadDb();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${base}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format gambar harus PNG, JPG, WebP, atau SVG.'));
    }
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      'audio/m4a',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/webm',
    ];
    if (allowed.includes(file.mimetype) || /\.(mp3|m4a|aac|wav|ogg|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Format musik harus MP3, M4A, WAV, atau OGG (maks 15 MB).'));
    }
  },
});

interface AuthenticatedRequest extends Request {
  adminUser?: AdminUser;
}

function normalizeSupabaseOrigin(raw: string | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).origin;
  } catch {
    return trimmed.replace(/\/+(rest|auth|storage)\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

async function verifySupabaseBearer(req: Request): Promise<AdminUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supaOrigin = normalizeSupabaseOrigin(process.env.VITE_SUPABASE_URL);
  const supaAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supaOrigin || !supaAnonKey) return null;

  try {
    const res = await fetch(`${supaOrigin}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supaAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: string;
      email?: string;
      user_metadata?: { name?: string };
    };
    if (!data?.id) return null;
    return {
      id: data.id,
      name: data.user_metadata?.name || data.email?.split('@')[0] || 'Admin',
      email: data.email || '',
      role: 'admin',
    };
  } catch {
    return null;
  }
}

function getAuthenticatedUser(req: Request): AdminUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const found = db.users.find((u) => u.id === payload.userId);
  if (!found) return null;
  return { id: found.id, name: found.name, email: found.email, role: 'admin' };
}

async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookieUser = getAuthenticatedUser(req);
  if (cookieUser) {
    req.adminUser = cookieUser;
    next();
    return;
  }

  const supaUser = await verifySupabaseBearer(req);
  if (supaUser) {
    req.adminUser = supaUser;
    next();
    return;
  }

  res.status(401).json({ error: 'Sesi admin diperlukan. Silakan login terlebih dahulu.' });
}

function setSessionCookie(res: Response, userId: string): void {
  const token = signSessionToken({
    userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Serve uploaded media assets
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode: 'express-local' });
  });

  // =========================================================================
  // AUTH ROUTES
  // =========================================================================
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    if (!cleanName || !cleanEmail || !password || password.length < 6) {
      res
        .status(400)
        .json({ error: 'Nama, email valid, dan kata sandi minimal 6 karakter wajib diisi.' });
      return;
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
      return;
    }
    const newUser: StoredUser = {
      id: `admin-${crypto.randomUUID()}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveDb(db);
    setSessionCookie(res, newUser.id);
    res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: 'admin',
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = db.users.find((u) => u.email === cleanEmail);
    if (!user || !password || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
      return;
    }
    setSessionCookie(res, user.id);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'admin',
      },
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // =========================================================================
  // PUBLIC GUEST INVITATION ROUTES
  // =========================================================================
  app.get('/api/invitation', (_req, res) => {
    res.json({
      settings: db.settings,
      elements: db.elements,
      cameraStops: db.cameraStops,
      wishes: db.wishes,
    });
  });

  app.post('/api/rsvp', (req, res) => {
    const { guestName, attendance, guestCount, sessionChoice, message } = req.body as {
      guestName?: string;
      attendance?: RsvpEntry['attendance'];
      guestCount?: number;
      sessionChoice?: RsvpEntry['sessionChoice'];
      message?: string;
    };

    const cleanName = (guestName || '').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Nama tamu wajib diisi.' });
      return;
    }

    const rsvp: RsvpEntry = {
      id: `rsvp-${crypto.randomUUID()}`,
      guestName: cleanName,
      attendance: attendance || 'hadir',
      guestCount: Math.max(1, Math.min(10, Number(guestCount) || 1)),
      sessionChoice: sessionChoice || 'akad_resepsi',
      message: (message || '').trim(),
      createdAt: new Date().toISOString(),
    };

    db.rsvps.unshift(rsvp);

    let createdWish: WishEntry | null = null;
    if (rsvp.message.length > 0) {
      createdWish = {
        id: `wish-${crypto.randomUUID()}`,
        guestName: cleanName,
        message: rsvp.message,
        createdAt: rsvp.createdAt,
      };
      db.wishes.unshift(createdWish);
    }

    saveDb(db);
    res.status(201).json({ rsvp, wish: createdWish });
  });

  app.post('/api/wishes', (req, res) => {
    const { guestName, message } = req.body as { guestName?: string; message?: string };
    const cleanName = (guestName || '').trim();
    const cleanMsg = (message || '').trim();
    if (!cleanName || !cleanMsg) {
      res.status(400).json({ error: 'Nama dan ucapan wajib diisi.' });
      return;
    }
    const wish: WishEntry = {
      id: `wish-${crypto.randomUUID()}`,
      guestName: cleanName,
      message: cleanMsg,
      createdAt: new Date().toISOString(),
    };
    db.wishes.unshift(wish);
    saveDb(db);
    res.status(201).json({ wish });
  });

  // =========================================================================
  // ADMIN PROTECTED ROUTES
  // =========================================================================
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const nextSettings = req.body as WeddingSettings;
    db.settings = { ...db.settings, ...nextSettings };
    saveDb(db);
    res.json({ settings: db.settings });
  });

  app.get('/api/admin/assets', requireAdmin, (_req, res) => {
    res.json({ assets: db.assets });
  });

  app.post(
    '/api/admin/assets/upload',
    requireAdmin,
    upload.single('file'),
    (req, res) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'File gambar belum dipilih.' });
        return;
      }
      const category = ((req.body?.category as AssetCategory) || 'floral') as AssetCategory;
      const customName = (req.body?.name as string | undefined)?.trim();
      const ext = path.extname(file.originalname).toLowerCase();
      const hasAlpha = ext === '.png' || ext === '.webp' || ext === '.svg';

      const newAsset: MediaAsset = {
        id: `asset-${crypto.randomUUID()}`,
        name: customName || path.basename(file.originalname, ext),
        category,
        url: `/uploads/${file.filename}`,
        storagePath: file.filename,
        hasAlpha,
        isSystem: false,
        createdAt: new Date().toISOString(),
      };

      db.assets.unshift(newAsset);
      saveDb(db);
      res.status(201).json({ asset: newAsset });
    },
  );

  app.post(
    '/api/admin/music/upload',
    requireAdmin,
    audioUpload.single('file'),
    (req, res) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'File audio belum dipilih.' });
        return;
      }
      const ext = path.extname(file.originalname);
      const customTitle = (req.body?.title as string | undefined)?.trim();
      const title = customTitle || path.basename(file.originalname, ext);
      const url = `/uploads/${file.filename}`;
      res.status(201).json({ url, title });
    },
  );

  app.delete('/api/admin/assets/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const asset = db.assets.find((a) => a.id === id);
    if (!asset) {
      res.status(404).json({ error: 'Aset tidak ditemukan.' });
      return;
    }
    if (asset.storagePath) {
      const filePath = path.join(UPLOADS_DIR, asset.storagePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    db.assets = db.assets.filter((a) => a.id !== id);
    saveDb(db);
    res.json({ ok: true });
  });

  app.put('/api/admin/canvas', requireAdmin, (req, res) => {
    const { elements, cameraStops } = req.body as {
      elements?: CanvasElement[];
      cameraStops?: CameraStop[];
    };
    if (Array.isArray(elements)) {
      db.elements = elements;
    }
    if (Array.isArray(cameraStops)) {
      db.cameraStops = cameraStops;
    }
    saveDb(db);
    res.json({ elements: db.elements, cameraStops: db.cameraStops });
  });

  app.get('/api/admin/rsvps', requireAdmin, (_req, res) => {
    res.json({ rsvps: db.rsvps, wishes: db.wishes });
  });

  app.put('/api/admin/rsvps/:id', requireAdmin, (req, res) => {
    const idx = db.rsvps.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data RSVP tidak ditemukan.' });
      return;
    }
    const patch = req.body as Partial<RsvpEntry>;
    const current = db.rsvps[idx];
    const updated: RsvpEntry = {
      ...current,
      guestName:
        typeof patch.guestName === 'string' && patch.guestName.trim()
          ? patch.guestName.trim()
          : current.guestName,
      attendance: patch.attendance || current.attendance,
      guestCount:
        typeof patch.guestCount === 'number'
          ? Math.max(1, Math.min(10, patch.guestCount))
          : current.guestCount,
      sessionChoice: patch.sessionChoice || current.sessionChoice,
      message:
        typeof patch.message === 'string' ? patch.message.trim() : current.message,
    };
    db.rsvps[idx] = updated;
    saveDb(db);
    res.json({ rsvp: updated });
  });

  app.delete('/api/admin/rsvps/:id', requireAdmin, (req, res) => {
    db.rsvps = db.rsvps.filter((r) => r.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  app.put('/api/admin/wishes/:id', requireAdmin, (req, res) => {
    const idx = db.wishes.findIndex((w) => w.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Ucapan tamu tidak ditemukan.' });
      return;
    }
    const patch = req.body as Partial<WishEntry>;
    const current = db.wishes[idx];
    const updated: WishEntry = {
      ...current,
      guestName:
        typeof patch.guestName === 'string' && patch.guestName.trim()
          ? patch.guestName.trim()
          : current.guestName,
      message:
        typeof patch.message === 'string' && patch.message.trim()
          ? patch.message.trim()
          : current.message,
    };
    db.wishes[idx] = updated;
    saveDb(db);
    res.json({ wish: updated });
  });

  app.delete('/api/admin/wishes/:id', requireAdmin, (req, res) => {
    db.wishes = db.wishes.filter((w) => w.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  // =========================================================================
  // VITE MIDDLEWARE (DEV) / STATIC DIST (PROD)
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Fleur server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
