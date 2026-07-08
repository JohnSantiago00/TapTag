import cors from 'cors';
import express from 'express';

export function createTapTagApp({
  getDb,
  requireFirebaseUser,
  allowedOrigins = ['*'],
  logger = console,
}) {
  const app = express();

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

  app.get('/health', async (_req, res) => {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true });
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
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim()
        : null;

    await db.collection('users').updateOne(
      { uid: req.user.uid },
      {
        $set: {
          displayName,
          privacyMode: 'strict',
          notificationsEnabled:
            typeof existing?.notificationsEnabled === 'boolean'
              ? existing.notificationsEnabled
              : false,
          updatedAt: now,
        },
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
    const db = await getDb();
    const now = nowIso();
    const cardProductId = req.params.cardProductId;
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
      merchantMcc: Number.isFinite(Number(req.body?.merchantMcc))
        ? Number(req.body.merchantMcc)
        : null,
      normalizedCategory: cleanString(req.body?.normalizedCategory, 48) ?? 'Other',
      recommendedCardProductId: cleanString(req.body?.recommendedCardProductId, 80),
      recommendedCardName: cleanString(req.body?.recommendedCardName, 80) ?? 'recommended card',
      rewardRate: Number.isFinite(Number(req.body?.rewardRate)) ? Number(req.body.rewardRate) : null,
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

  app.delete('/api/users/me/wallet/:cardProductId', async (req, res) => {
    const db = await getDb();
    await db.collection('wallet').deleteOne({
      uid: req.user.uid,
      cardProductId: req.params.cardProductId,
    });
    res.status(204).end();
  });

  app.post('/api/users/me/events', async (req, res) => {
    const db = await getDb();
    const event = {
      ...req.body,
      uid: req.user.uid,
      occurredAt: nowIso(),
    };

    delete event.id;
    await db.collection('events').insertOne(event);
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

  app.use((error, _req, res, _next) => {
    logger.error(error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
