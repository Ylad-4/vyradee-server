import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient }
}

export default fp(async (app) => {
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  await prisma.$connect();
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => prisma.$disconnect());
});
