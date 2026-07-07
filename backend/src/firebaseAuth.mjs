import { createRemoteJWKSet, jwtVerify } from 'jose';

const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function getFirebaseProjectId() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required for auth token verification');
  }

  return projectId;
}

export async function requireFirebaseUser(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const projectId = getFirebaseProjectId();
    const { payload } = await jwtVerify(match[1], firebaseJwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (typeof payload.user_id !== 'string') {
      return res.status(401).json({ error: 'Invalid bearer token' });
    }

    req.user = {
      uid: payload.user_id,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };

    return next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Invalid bearer token' });
  }
}
