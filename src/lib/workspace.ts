import type { FastifyInstance } from 'fastify';

export async function getWorkspaceForUser(app: FastifyInstance, userId: string) {
  const membership = await app.prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) {
    const error = new Error('No workspace is available for this account') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }
  return membership.workspace;
}

export async function assertContentAccess(app: FastifyInstance, userId: string, contentId: string) {
  const workspace = await getWorkspaceForUser(app, userId);
  const content = await app.prisma.contentItem.findFirst({ where: { id: contentId, workspaceId: workspace.id } });
  if (!content) {
    const error = new Error('Content not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }
  return { workspace, content };
}
