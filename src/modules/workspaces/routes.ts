import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseOrThrow } from '../../lib/schemas.js';
import { getWorkspaceForUser } from '../../lib/workspace.js';
const updateSchema = z.object({ name: z.string().min(2).max(80) });
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.get('/current', async (request) => getWorkspaceForUser(app, request.user.id));
  app.patch('/current', async (request) => {
    const workspace = await getWorkspaceForUser(app, request.user.id);
    return app.prisma.workspace.update({ where: { id: workspace.id }, data: parseOrThrow(updateSchema, request.body) });
  });
};
export default routes;
