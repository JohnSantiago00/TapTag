import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createTapTagApp } from './app.mjs';

class FakeCursor {
  constructor(docs) {
    this.docs = [...docs];
  }

  sort(sortSpec) {
    const [[field, direction]] = Object.entries(sortSpec);
    this.docs.sort((left, right) => {
      if (left[field] === right[field]) return 0;
      return left[field] > right[field] ? direction : -direction;
    });
    return this;
  }

  limit(count) {
    this.docs = this.docs.slice(0, count);
    return this;
  }

  async toArray() {
    return this.docs.map((doc) => ({ ...doc }));
  }
}

class FakeCollection {
  constructor(docs = []) {
    this.docs = docs.map((doc) => ({ ...doc }));
  }

  find(query = {}) {
    return new FakeCursor(this.docs.filter((doc) => matches(doc, query)));
  }

  async findOne(query = {}) {
    const doc = this.docs.find((item) => matches(item, query));
    return doc ? { ...doc } : null;
  }

  async updateOne(filter, update, options = {}) {
    let doc = this.docs.find((item) => matches(item, filter));

    if (!doc && options.upsert) {
      doc = { ...filter, ...(update.$setOnInsert ?? {}) };
      this.docs.push(doc);
    }

    if (!doc) {
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }

    Object.assign(doc, update.$set ?? {});
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }

  async deleteOne(filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => !matches(doc, filter));
    return { deletedCount: before - this.docs.length };
  }

  async insertOne(doc) {
    const id = `event_${this.docs.length + 1}`;
    const saved = {
      _id: { toString: () => id },
      ...doc,
    };
    this.docs.push(saved);
    return { insertedId: saved._id };
  }
}

class FakeDb {
  constructor(seed = {}) {
    this.collections = new Map(
      Object.entries(seed).map(([name, docs]) => [name, new FakeCollection(docs)])
    );
  }

  async command(command) {
    assert.deepEqual(command, { ping: 1 });
    return { ok: 1 };
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new FakeCollection());
    }
    return this.collections.get(name);
  }
}

function matches(doc, query) {
  return Object.entries(query).every(([field, value]) => doc[field] === value);
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  return { response, body };
}

describe('TapTag API app', () => {
  let db;
  let server;
  let baseUrl;

  beforeEach(async () => {
    db = new FakeDb({
      cards: [
        { _id: 'internal_card_id', id: 'csp', name: 'Chase Sapphire Preferred' },
        { _id: 'internal_card_id_2', id: 'amex_gold', name: 'American Express Gold' },
      ],
      brands: [{ _id: 'brand_id', id: 'starbucks', name: 'Starbucks', mcc: 5814 }],
      mcc_map: [{ _id: 'mcc_id', mcc: 5814, normalizedCategory: 'Dining' }],
      users: [],
      wallet: [],
      companion_passes: [],
      events: [],
    });

    const app = createTapTagApp({
      getDb: async () => db,
      allowedOrigins: ['*'],
      requireFirebaseUser: (req, res, next) => {
        if (req.get('authorization') !== 'Bearer test-token') {
          return res.status(401).json({ error: 'Missing bearer token' });
        }

        req.user = { uid: 'user_123', email: 'user@example.com' };
        return next();
      },
      logger: { error() {} },
    });

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('serves health and public knowledge docs without Mongo internal ids', async () => {
    const health = await request(baseUrl, '/health');
    assert.equal(health.response.status, 200);
    assert.deepEqual(health.body, { ok: true });

    const cards = await request(baseUrl, '/api/cards');
    assert.equal(cards.response.status, 200);
    assert.equal(cards.body[0].id, 'amex_gold');
    assert.equal(cards.body[0]._id, undefined);
  });

  it('requires auth for user routes', async () => {
    const profile = await request(baseUrl, '/api/users/me/profile');
    assert.equal(profile.response.status, 401);
  });

  it('creates sanitized profiles with privacy defaults', async () => {
    const saved = await request(baseUrl, '/api/users/me/profile', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ displayName: '  John  ' }),
    });

    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.displayName, 'John');
    assert.equal(saved.body.privacyMode, 'strict');
    assert.equal(saved.body.notificationsEnabled, false);
  });

  it('adds, lists, and removes wallet card refs only', async () => {
    const put = await request(baseUrl, '/api/users/me/wallet/amex_gold', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ nickname: 'Food card', last4: '1234', color: '#00AAFF' }),
    });
    assert.equal(put.response.status, 204);

    const wallet = await request(baseUrl, '/api/users/me/wallet', {
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(wallet.response.status, 200);
    assert.deepEqual(Object.keys(wallet.body[0]).sort(), [
      'addedAt',
      'color',
      'enabled',
      'id',
      'last4',
      'nickname',
      'updatedAt',
    ]);
    assert.equal(wallet.body[0].id, 'amex_gold');
    assert.equal(wallet.body[0].last4, '1234');
    assert.equal(wallet.body[0].color, '#00AAFF');

    const removed = await request(baseUrl, '/api/users/me/wallet/amex_gold', {
      method: 'DELETE',
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(removed.response.status, 204);
  });

  it('stores companion pass recommendation state and reports missing issuer setup', async () => {
    const saved = await request(baseUrl, '/api/users/me/companion-pass', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        merchantName: 'Starbucks',
        merchantMcc: 5814,
        normalizedCategory: 'Dining',
        recommendedCardProductId: 'amex_gold',
        recommendedCardName: 'American Express Gold',
        rewardRate: 4,
        reason: 'Best direct match',
        source: 'lab',
      }),
    });

    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.merchantName, 'Starbucks');
    assert.equal(saved.body.recommendedCardName, 'American Express Gold');

    const loaded = await request(baseUrl, '/api/users/me/companion-pass', {
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(loaded.response.status, 200);
    assert.equal(loaded.body.normalizedCategory, 'Dining');

    const installLink = await request(baseUrl, '/api/users/me/companion-pass/install-link?platform=ios', {
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(installLink.response.status, 501);
    assert.equal(installLink.body.configured, false);
    assert.equal(installLink.body.preview.recommendedCardName, 'American Express Gold');
  });

  it('records events server-side and clamps event query limits', async () => {
    const created = await request(baseUrl, '/api/users/me/events', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: 'client_supplied', eventType: 'wallet_updated', source: 'wallet' }),
    });
    assert.equal(created.response.status, 201);

    const events = await request(baseUrl, '/api/users/me/events?limit=999', {
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(events.response.status, 200);
    assert.equal(events.body.length, 1);
    assert.equal(events.body[0].id, 'event_1');
    assert.equal(events.body[0].uid, undefined);
    assert.equal(events.body[0].eventType, 'wallet_updated');
  });

  it('rejects unknown event types and strips non-whitelisted event fields', async () => {
    const invalid = await request(baseUrl, '/api/users/me/events', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ eventType: 'made_up_event', source: 'wallet' }),
    });
    assert.equal(invalid.response.status, 400);

    const withJunk = await request(baseUrl, '/api/users/me/events', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        eventType: 'wallet_updated',
        source: 'wallet',
        cardProductId: 'amex_gold',
        injected: { $gt: '' },
        metadata: { note: 'kept', '$where': 'dropped', nested: { obj: true } },
      }),
    });
    assert.equal(withJunk.response.status, 201);

    const events = await request(baseUrl, '/api/users/me/events', {
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(events.body[0].injected, undefined);
    assert.equal(events.body[0].cardProductId, 'amex_gold');
    assert.deepEqual(events.body[0].metadata, { note: 'kept' });
  });

  it('rejects malformed wallet card product ids', async () => {
    const put = await request(baseUrl, '/api/users/me/wallet/not%20a%20valid%20id!', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(put.response.status, 400);
  });

  it('returns JSON 404 for unknown routes and 400 for malformed JSON bodies', async () => {
    const missing = await request(baseUrl, '/api/does-not-exist');
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, { error: 'Not found' });

    const malformed = await request(baseUrl, '/api/users/me/profile', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: '{not json',
    });
    assert.equal(malformed.response.status, 400);
    assert.deepEqual(malformed.body, { error: 'Invalid request' });
  });

  it('sets security headers and serves liveness without the database', async () => {
    const livez = await request(baseUrl, '/livez');
    assert.equal(livez.response.status, 200);
    assert.deepEqual(livez.body, { ok: true });
    assert.equal(livez.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(livez.response.headers.get('x-frame-options'), 'DENY');
    assert.equal(livez.response.headers.get('x-powered-by'), null);

    const profile = await request(baseUrl, '/api/users/me/profile', {
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(profile.response.headers.get('cache-control'), 'no-store');
  });
});

describe('TapTag API resilience', () => {
  async function withApp(options, run) {
    const app = createTapTagApp({
      getDb: async () => new FakeDb(),
      requireFirebaseUser: (req, res, next) => next(),
      logger: { error() {} },
      ...options,
    });
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      await run(baseUrl);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }

  it('reports 503 from /health when the database is unreachable', async () => {
    await withApp(
      {
        getDb: async () => {
          throw new Error('connection refused');
        },
      },
      async (baseUrl) => {
        const health = await request(baseUrl, '/health');
        assert.equal(health.response.status, 503);
        assert.deepEqual(health.body, { ok: false });

        const livez = await request(baseUrl, '/livez');
        assert.equal(livez.response.status, 200);
      }
    );
  });

  it('rate limits clients that exceed the request budget', async () => {
    await withApp({ rateLimit: { windowMs: 60_000, max: 2 } }, async (baseUrl) => {
      const first = await request(baseUrl, '/livez');
      assert.equal(first.response.status, 200);
      assert.equal(first.response.headers.get('ratelimit-limit'), '2');

      const second = await request(baseUrl, '/livez');
      assert.equal(second.response.status, 200);
      assert.equal(second.response.headers.get('ratelimit-remaining'), '0');

      const third = await request(baseUrl, '/livez');
      assert.equal(third.response.status, 429);
      assert.deepEqual(third.body, { error: 'Too many requests' });
      assert.ok(Number(third.response.headers.get('retry-after')) >= 1);
    });
  });
});
