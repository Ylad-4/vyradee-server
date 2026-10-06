import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../lib/schemas.js";

const updateSchema = z.object({
  displayName: z.string().min(1).max(60).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional()
});
const paramsSchema = z.object({ username: z.string() });

const routes: FastifyPluginAsync = async (app) => {
  app.get("/:username", async (request, reply) => {
    const { username } = parseOrThrow(paramsSchema, request.params);
    const user = await app.prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: {
      id: true, username: true, displayName: true, bio: true, avatarUrl: true, createdAt: true,
      _count: { select: { posts: true, followers: true, following: true } }
    }});
    if (!user) return reply.notFound("User not found");
    return user;
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (request) => {
    const data = parseOrThrow(updateSchema, request.body);
    return app.prisma.user.update({ where: { id: request.user.id }, data, select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true } });
  });
};
export default routes;
