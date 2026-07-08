import cors from 'cors';
import express from 'express';

const EVENT_TYPES = new Set([
  'recommendation_shown',
  'recommendation_opened',
  'recommendation_dismissed',
  'payment_prompt_opened',
  'payment_wallet_opened',
  'payment_prompt_confirmed',
  'payment_prompt_feedback',
  'companion_pass_updated',
  'brand_muted',
  'wallet_updated',
]);

const EVENT_SOURCES = new Set(['lab', 'nearby', 'wallet', 'profile']);

const CARD_PRODUCT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

function createRateLimiter({ windowMs, max }, logger) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      if (entry.count === max + 1) {
        logger.error(`Rate limit exceeded for ${key}`);
      }
      return res.status(429).json({ error: 'Too many requests' });
    }

    return next();
  };
}

export function createTapTagApp({
  getDb,
  requireFirebaseUser,
  allowedOrigins = ['*'],
  logger = console,
  rateLimit = { windowMs: 60_000, max: 300 },
  trustProxy = false,
}) {
  const app = express();
  app.disable('x-powered-by');

  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/users/')) {
      res.set('Cache-Control', 'no-store');
    }
    next();
  });

  if (rateLimit) {
    app.use(createRateLimiter(rateLimit, logger));
  }

  if (typeof logger.info === 'function') {
    app.use((req, res, next) => {
      const startedAt = process.hrtime.bigint();
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
      });
      next();
    });
  }

  app.use(cors({ origin: allowedOrigins.includes('*') ? true : allowedOrigins }));
  app.use(express.json({ limit: '256kb' }));

  function publicDoc(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function cleanString(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
  }

  function cleanNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function cleanLast4(value) {
    if (typeof value !== 'string') return null;
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length === 4 ? digits : null;
  }

  function cleanCardColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : null;
  }

  function cleanCardProductId(value) {
    if (typeof value !== 'string') return null;
    return CARD_PRODUCT_ID_PATTERN.test(value) ? value : null;
  }

  // Events are stored with an explicit field whitelist so clients can never
  // persist arbitrary document shapes into MongoDB.
  function cleanEvent(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

    const eventType = EVENT_TYPES.has(body.eventType) ? body.eventType : null;
    const source = EVENT_SOURCES.has(body.source) ? body.source : null;
    if (!eventType || !source) return null;

    const event = { eventType, source };

    const brandId = cleanString(body.brandId, 80);
    if (brandId) event.brandId = brandId;

    const brandName = cleanString(body.brandName, 80);
    if (brandName) event.brandName = brandName;

    const cardProductId = cleanCardProductId(body.cardProductId);
    if (cardProductId) event.cardProductId = cardProductId;

    if (Array.isArray(body.cardProductIds)) {
      const ids = body.cardProductIds
        .slice(0, 20)
        .map(cleanCardProductId)
        .filter(Boolean);
      if (ids.length) event.cardProductIds = ids;
    }

    const recommendedCardProductId = cleanCardProductId(body.recommendedCardProductId);
    if (recommendedCardProductId) event.recommendedCardProductId = recommendedCardProductId;

    const recommendedCardName = cleanString(body.recommendedCardName, 80);
    if (recommendedCardName) event.recommendedCardName = recommendedCardName;

    const normalizedCategory = cleanString(body.normalizedCategory, 48);
    if (normalizedCategory) event.normalizedCategory = normalizedCategory;

    const merchantMcc = cleanNumber(body.merchantMcc);
    if (merchantMcc !== null) event.merchantMcc = merchantMcc;

    const distanceMeters = cleanNumber(body.distanceMeters);
    if (distanceMeters !== null) event.distanceMeters = distanceMeters;

    const action = cleanString(body.action, 48);
    if (action) event.action = action;

    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      const metadata = {};
      for (const [key, value] of Object.entries(body.metadata).slice(0, 20)) {
        if (key.length > 48 || key.startsWith('$') || key.includes('.')) continue;
        if (typeof value === 'string') metadata[key] = value.slice(0, 240);
        else if (typeof value === 'number' && Number.isFinite(value)) metadata[key] = value;
        else if (typeof value === 'boolean' || value === null) metadata[key] = value;
      }
      if (Object.keys(metadata).length) event.metadata = metadata;
    }

    return event;
  }

  function walletRefFromDoc(doc) {
    return {
      id: doc.cardProductId,
      enabled: doc.enabled !== false,
      nickname: typeof doc.nickname === 'string' ? doc.nickname : undefined,
      last4: typeof doc.last4 === 'string' ? doc.last4 : undefined,
      color: typeof doc.color === 'string' ? doc.color : undefined,
      addedAt: typeof doc.addedAt === 'string' ? doc.addedAt : nowIso(),
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : nowIso(),
    };
  }

  function companionPassPreviewFromDoc(doc) {
    if (!doc) return null;

    return {
      merchantName: doc.merchantName,
      normalizedCategory: doc.normalizedCategory,
      recommendedCardName: doc.recommendedCardName,
      rewardRate: doc.rewardRate,
      updatedAt: doc.updatedAt,
    };
  }

  function profileFromDoc(doc) {
    const now = nowIso();
    return {
      displayName:
        typeof doc?.displayName === 'string' && doc.displayName.trim()
          ? doc.displayName.trim()
          : undefined,
      privacyMode: 'strict',
      notificationsEnabled:
        typeof doc?.notificationsEnabled === 'boolean' ? doc.notificationsEnabled : false,
      createdAt: typeof doc?.createdAt === 'string' ? doc.createdAt : now,
      updatedAt: typeof doc?.updatedAt === 'string' ? doc.updatedAt : now,
    };
  }

  // Liveness: process is up. Never touches the database, safe for container
  // orchestrator liveness probes.
  app.get('/livez', (_req, res) => {
    res.json({ ok: true });
  });

  // Readiness: verifies MongoDB connectivity. Returns 503 (not 500) so load
  // balancers treat a database outage as "not ready" rather than an app crash.
  app.get('/health', async (_req, res) => {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      res.json({ ok: true });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({ ok: false });
    }
  });

  app.get('/api/cards', async (_req, res) => {
    const db = await getDb();
    const docs = await db.collection('cards').find({}).sort({ name: 1 }).toArray();
    res.json(docs.map(publicDoc));
  });

  app.get('/api/brands', async (_req, res) => {
    const db = await getDb();
    const docs = await db.collection('brands').find({}).sort({ name: 1 }).toArray();
    res.json(docs.map(publicDoc));
  });

  app.get('/api/mcc-map', async (_req, res) => {
    const db = await getDb();
    const docs = await db.collection('mcc_map').find({}).sort({ mcc: 1 }).toArray();
    res.json(docs.map(publicDoc));
  });

  app.use('/api/users/me', requireFirebaseUser);

  app.get('/api/users/me/profile', async (req, res) => {
    const db = await getDb();
    const doc = await db.collection('users').findOne({ uid: req.user.uid });
    res.json(doc ? profileFromDoc(doc) : null);
  });

  app.put('/api/users/me/profile', async (req, res) => {
    const db = await getDb();
    const existing = await db.collection('users').findOne({ uid: req.user.uid });
    const now = nowIso();
    const body = req.body ?? {};
    const profileUpdate = {
      privacyMode: 'strict',
      notificationsEnabled:
        typeof body.notificationsEnabled === 'boolean'
          ? body.notificationsEnabled
          : typeof existing?.notificationsEnabled === 'boolean'
            ? existing.notificationsEnabled
            : false,
      updatedAt: now,
    };

    if (Object.prototype.hasOwnProperty.call(body, 'displayName')) {
      profileUpdate.displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 80)
          : null;
    }

    await db.collection('users').updateOne(
      { uid: req.user.uid },
      {
        $set: profileUpdate,
        $setOnInsert: {
          uid: req.user.uid,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    const saved = await db.collection('users').findOne({ uid: req.user.uid });
    res.json(profileFromDoc(saved));
  });

  app.delete('/api/users/me', async (req, res) => {
    const db = await getDb();
    await Promise.all(
      ['users', 'wallet', 'events', 'companion_passes'].map((collectionName) =>
        db.collection(collectionName).deleteMany({ uid: req.user.uid })
      )
    );
    res.status(204).end();
  });

  app.get('/api/users/me/wallet', async (req, res) => {
    const db = await getDb();
    const docs = await db
      .collection('wallet')
      .find({ uid: req.user.uid })
      .sort({ addedAt: 1 })
      .toArray();

    res.json(docs.map(walletRefFromDoc));
  });

  app.put('/api/users/me/wallet/:cardProductId', async (req, res) => {
    const cardProductId = cleanCardProductId(req.params.cardProductId);
    if (!cardProductId) {
      return res.status(400).json({ error: 'Invalid card product id' });
    }

    const db = await getDb();
    const now = nowIso();
    const existing = await db.collection('wallet').findOne({ uid: req.user.uid, cardProductId });

    await db.collection('wallet').updateOne(
      { uid: req.user.uid, cardProductId },
      {
        $set: {
          enabled: true,
          nickname: cleanString(req.body?.nickname, 48),
          last4: cleanLast4(req.body?.last4),
          color: cleanCardColor(req.body?.color),
          updatedAt: now,
        },
        $setOnInsert: {
          uid: req.user.uid,
          cardProductId,
          addedAt: typeof existing?.addedAt === 'string' ? existing.addedAt : now,
        },
      },
      { upsert: true }
    );

    res.status(204).end();
  });

  app.delete('/api/users/me/wallet/:cardProductId', async (req, res) => {
    const cardProductId = cleanCardProductId(req.params.cardProductId);
    if (!cardProductId) {
      return res.status(400).json({ error: 'Invalid card product id' });
    }

    const db = await getDb();
    await db.collection('wallet').deleteOne({
      uid: req.user.uid,
      cardProductId,
    });
    res.status(204).end();
  });

  app.get('/api/users/me/companion-pass', async (req, res) => {
    const db = await getDb();
    const doc = await db.collection('companion_passes').findOne({ uid: req.user.uid });

    if (!doc) {
      res.json(null);
      return;
    }

    const { _id, uid, ...pass } = doc;
    void _id;
    void uid;
    res.json(pass);
  });

  app.put('/api/users/me/companion-pass', async (req, res) => {
    const db = await getDb();
    const now = nowIso();
    const companionPass = {
      merchantName: cleanString(req.body?.merchantName, 80) ?? 'this merchant',
      merchantMcc: cleanNumber(req.body?.merchantMcc),
      normalizedCategory: cleanString(req.body?.normalizedCategory, 48) ?? 'Other',
      recommendedCardProductId: cleanCardProductId(req.body?.recommendedCardProductId),
      recommendedCardName: cleanString(req.body?.recommendedCardName, 80) ?? 'recommended card',
      rewardRate: cleanNumber(req.body?.rewardRate),
      reason: cleanString(req.body?.reason, 240),
      source: cleanString(req.body?.source, 32) ?? 'payment_prompt',
      updatedAt: now,
    };

    await db.collection('companion_passes').updateOne(
      { uid: req.user.uid },
      {
        $set: companionPass,
        $setOnInsert: {
          uid: req.user.uid,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    const saved = await db.collection('companion_passes').findOne({ uid: req.user.uid });
    const { _id, uid, ...publicPass } = saved;
    void _id;
    void uid;
    res.json(publicPass);
  });

  app.get('/api/users/me/companion-pass/install-link', async (req, res) => {
    const db = await getDb();
    const pass = await db.collection('companion_passes').findOne({ uid: req.user.uid });
    const platform = req.query.platform === 'android' ? 'android' : 'ios';

    res.status(501).json({
      configured: false,
      platform,
      reason:
        platform === 'ios'
          ? 'Apple Wallet pass signing is not configured. Add Pass Type ID, Team ID, signing certificate, and pass web-service credentials.'
          : 'Google Wallet issuer credentials are not configured. Add issuer ID and service-account signing credentials.',
      preview: companionPassPreviewFromDoc(pass),
    });
  });

  app.post('/api/users/me/events', async (req, res) => {
    const event = cleanEvent(req.body);
    if (!event) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    const db = await getDb();
    await db.collection('events').insertOne({
      ...event,
      uid: req.user.uid,
      occurredAt: nowIso(),
    });
    res.status(201).json({ ok: true });
  });

  app.get('/api/users/me/events', async (req, res) => {
    const db = await getDb();
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
    const docs = await db
      .collection('events')
      .find({ uid: req.user.uid })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .toArray();

    res.json(
      docs.map((doc) => {
        const { _id, uid, ...rest } = doc;
        return { id: _id.toString(), ...rest };
      })
    );
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    // Body-parser and similar middleware attach a 4xx status to client errors
    // (malformed JSON, oversized payloads); everything else is a real 500.
    const status =
      Number.isInteger(error?.status) && error.status >= 400 && error.status < 500
        ? error.status
        : 500;

    if (status >= 500) {
      logger.error(error);
    }

    res.status(status).json({
      error: status >= 500 ? 'Internal server error' : 'Invalid request',
    });
  });

  return app;
}
