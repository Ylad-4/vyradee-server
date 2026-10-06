import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseOrThrow } from '../../lib/schemas.js';
import { getWorkspaceForUser } from '../../lib/workspace.js';
const schema = z.object({
  identity: z.string().max(2000).nullable().optional(), positioning: z.string().max(2000).nullable().optional(), audience: z.string().max(2000).nullable().optional(), voice: z.string().max(2000).nullable().optional(), preferredLanguage: z.string().max(1000).nullable().optional(), prohibitedLanguage: z.string().max(1000).nullable().optional(), contentThemes: z.array(z.string().max(100)).max(30).optional(), publishingRules: z.array(z.string().max(300)).max(30).optional(),
});
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.get('/', async (request) => { const workspace = await getWorkspaceForUser(app, request.user.id); return app.prisma.brandProfile.findUnique({ where: { workspaceId: workspace.id } }); });
  app.put('/', async (request) => {
    const workspace = await getWorkspaceForUser(app, request.user.id); const data = parseOrThrow(schema, request.body);
    const values = Object.values(data); const completion = Math.round((values.filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length / 8) * 100);
    return app.prisma.brandProfile.upsert({ where: { workspaceId: workspace.id }, create: { workspaceId: workspace.id, ...data, completion }, update: { ...data, completion } });
  });
};
export default routes;
