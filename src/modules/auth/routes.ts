import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { parseOrThrow } from '../../lib/schemas.js';

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60).optional(),
  workspaceName: z.string().min(2).max(80).optional(),
});
const loginSchema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), password: z.string().min(1) });

const routes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const data = parseOrThrow(registerSchema, request.body);
    const exists = await app.prisma.user.findFirst({ where: { OR: [{ email: data.email }, { username: data.username }] } });
    if (exists) return reply.conflict('Email or username is already in use');
    const passwordHash = await hashPassword(data.password);
    const result = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: data.email, username: data.username, displayName: data.displayName, passwordHash } });
      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName ?? `${data.displayName ?? data.username}'s workspace`,
          slug: `${data.username}-${user.id.slice(-6)}`,
          ownerId: user.id,
          members: { create: { userId: user.id, role: 'OWNER' } },
          brandProfile: { create: {} },
        },
      });
      return { user, workspace };
    });
    const token = app.jwt.sign({ id: result.user.id, email: result.user.email, username: result.user.username });
    return reply.code(201).send({ token, user: publicUser(result.user), workspace: result.workspace });
  });

  app.post('/login', async (request, reply) => {
    const data = parseOrThrow(loginSchema, request.body);
    const user = await app.prisma.user.findUnique({ where: { email: data.email }, include: { memberships: { include: { workspace: true }, take: 1 } } });
    if (!user || !(await verifyPassword(data.password, user.passwordHash))) return reply.unauthorized('Invalid email or password');
    const token = app.jwt.sign({ id: user.id, email: user.email, username: user.username });
    return { token, user: publicUser(user), workspace: user.memberships[0]?.workspace ?? null };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUnique({ where: { id: request.user.id }, include: { memberships: { include: { workspace: true }, take: 1 } } });
    return user ? { user: publicUser(user), workspace: user.memberships[0]?.workspace ?? null } : null;
  });
};

function publicUser(user: { id: string; email: string; username: string; displayName: string | null; bio: string | null; avatarUrl: string | null; createdAt: Date }) {
  return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
}
export default routes;
