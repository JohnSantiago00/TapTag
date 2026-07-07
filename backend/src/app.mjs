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

    res.json(
      docs.map((doc) => ({
        id: doc.cardProductId,
        enabled: doc.enabled !== false,
        nickname: typeof doc.nickname === 'string' ? doc.nickname : undefined,
        addedAt: typeof doc.addedAt === 'string' ? doc.addedAt : nowIso(),
        updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : nowIso(),
      }))
    );
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
          nickname:
            typeof req.body?.nickname === 'string' && req.body.nickname.trim()
              ? req.body.nickname.trim()
              : null,
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
