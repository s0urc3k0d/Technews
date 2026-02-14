// ===========================================
// Plugin Auth pour Fastify (Auth0 JWT)
// ===========================================

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface JWTPayload {
  sub: string;
  email?: string;
  permissions?: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: JWTPayload;
    authToken?: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const { 
    AUTH0_DOMAIN, 
    AUTH0_AUDIENCE, 
    AUTH0_ADMIN_ROLE,
    AUTH0_ADMIN_PERMISSION,
    AUTH0_ROLES_CLAIM,
    ADMIN_EMAILS,
    ADMIN_SUBS,
  } = fastify.config;

  // Create JWKS client for Auth0
  const JWKS = AUTH0_DOMAIN 
    ? createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`))
    : null;

  const verifyToken = async (token: string): Promise<JWTPayload> => {
    if (!AUTH0_DOMAIN || !JWKS) {
      // Development mode: just decode (in production, always use Auth0)
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      const part1 = parts[1];
      if (!part1) throw new Error('Invalid token');
      const payload = JSON.parse(Buffer.from(part1, 'base64').toString());
      return payload as JWTPayload;
    }

    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
      audience: AUTH0_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
    });

    return payload as unknown as JWTPayload;
  };

  // Strict authentication (returns 401 if not authenticated)
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verifyToken(token);
      request.user = payload;
      request.authToken = token;
    } catch (err) {
      console.error('Token verification failed:', err);
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' });
    }
  };

  // Optional authentication (continues even if not authenticated)
  const authenticateOptional = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verifyToken(token);
      request.user = payload;
    } catch {
      // Ignore errors for optional auth
    }
  };

  const parseList = (value?: string): string[] => {
    if (!value) return [];
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  };

  const getClaimArray = (payload: JWTPayload, key: string): string[] => {
    const raw = (payload as unknown as Record<string, unknown>)[key];
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item));
    }
    if (typeof raw === 'string') {
      return raw.split(/\s+/).filter(Boolean);
    }
    return [];
  };

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const user = request.user;
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Missing user context' });
      return;
    }

    const allowedEmails = parseList(ADMIN_EMAILS);
    const allowedSubs = parseList(ADMIN_SUBS);
    let email = (user.email || '').toLowerCase();

    if (!email && allowedEmails.length > 0 && AUTH0_DOMAIN && request.authToken) {
      try {
        const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${request.authToken}`,
          },
        });

        if (userInfoResponse.ok) {
          const userInfo = (await userInfoResponse.json()) as { email?: string };
          email = (userInfo.email || '').toLowerCase();
        }
      } catch {
        // Ignore and keep default email from token
      }
    }

    if (allowedSubs.length > 0 && !allowedSubs.includes(user.sub.toLowerCase())) {
      reply.code(403).send({ error: 'Forbidden', message: 'Admin access denied' });
      return;
    }

    if (allowedEmails.length > 0 && (!email || !allowedEmails.includes(email))) {
      reply.code(403).send({ error: 'Forbidden', message: 'Admin access denied' });
      return;
    }

    const rolesClaim = AUTH0_ROLES_CLAIM || 'roles';
    const roles = getClaimArray(user, rolesClaim);
    const permissions = getClaimArray(user, 'permissions');

    if (AUTH0_ADMIN_ROLE && !roles.includes(AUTH0_ADMIN_ROLE)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Admin role required' });
      return;
    }

    if (AUTH0_ADMIN_PERMISSION && !permissions.includes(AUTH0_ADMIN_PERMISSION)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Admin permission required' });
      return;
    }

    if (
      allowedEmails.length === 0 &&
      allowedSubs.length === 0 &&
      !AUTH0_ADMIN_ROLE &&
      !AUTH0_ADMIN_PERMISSION
    ) {
      reply.code(403).send({ error: 'Forbidden', message: 'Admin policy not configured' });
      return;
    }
  };

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('authenticateOptional', authenticateOptional);
  fastify.decorate('requireAdmin', requireAdmin);
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['config'],
});