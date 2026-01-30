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
  }
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = fastify.config;

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

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('authenticateOptional', authenticateOptional);
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['config'],
});