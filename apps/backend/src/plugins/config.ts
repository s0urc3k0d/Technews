// ===========================================
// Plugin Config pour Fastify
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { config, Config } from '../config/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

const configPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('config', config);
};

export default fp(configPlugin, {
  name: 'config',
});
