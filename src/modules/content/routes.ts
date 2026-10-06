import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseOrThrow, paginationSchema } from '../../lib/schemas.js';
import { assertContentAccess, getWorkspaceForUser } from '../../lib/workspace.js';
import { analyzeContent } from '../../services/gemini.js';
const idSchema = z.object({ id: z.string().min(1) });
const querySchema = paginationSchema.extend({ status: z.enum(['DRAFT','PROCESSING','NEEDS_REVIEW','APPROVED','SCHEDULED','PUBLISHING','PUBLISHED','FAILED']).optional() });
const createSchema = z.object({ title: z.string().min(1).max(160), description: z.string().max(2000).optional(), mediaType: z.enum(['VIDEO','IMAGE','TEXT']), mediaUrl: z.string().url().optional(), mediaPublicId: z.string().max(500).optional(), thumbnailUrl: z.string().url().optional(), mediaFormat: z.string().max(30).optional(), mediaBytes: z.number().int().nonnegative().max(2147483647).optional(), originalFilename: z.string().max(255).optional(), durationSeconds: z.number().int().nonnegative().optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional() });
const updateSchema = createSchema.partial().extend({ status: z.enum(['DRAFT','PROCESSING','NEEDS_REVIEW','APPROVED','SCHEDULED','PUBLISHING','PUBLISHED','FAILED']).optional() });
const analyzeRequestSchema = z.object({ language: z.string().min(2).max(80).default('English'), platforms: z.array(z.enum(['INSTAGRAM','TIKTOK','YOUTUBE','FACEBOOK','X','LINKEDIN'])).min(1).max(6) });
const analysisSchema = z.object({ topic: z.string().max(500).optional(), summary: z.string().max(4000).optional(), audience: z.string().max(2000).optional(), purpose: z.string().max(2000).optional(), tone: z.string().max(1000).optional(), confidence: z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'), keyMoments: z.any().optional(), uncertainties: z.array(z.string()).max(30).optional(), recommendations: z.any().optional() });
const variantSchema = z.object({ platform: z.enum(['INSTAGRAM','TIKTOK','YOUTUBE','FACEBOOK','X','LINKEDIN']), hook: z.string().max(1000).optional(), title: z.string().max(500).optional(), caption: z.string().max(10000).optional(), cta: z.string().max(1000).optional(), hashtags: z.array(z.string().max(100)).max(50).optional(), warnings: z.array(z.string().max(300)).max(30).optional(), status: z.enum(['DRAFT','NEEDS_REVIEW','APPROVED']).optional() });

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.get('/', async (request) => {
    const workspace = await getWorkspaceForUser(app, request.user.id); const parsed = parseOrThrow(querySchema, request.query); const page=parsed.page??1; const limit=parsed.limit??20; const status=parsed.status;
    const where = { workspaceId: workspace.id, ...(status ? { status } : {}) };
    const [items,total] = await app.prisma.$transaction([app.prisma.contentItem.findMany({ where, skip:(page-1)*limit, take:limit, orderBy:{updatedAt:'desc'}, include:{analysis:true,variants:true} }),app.prisma.contentItem.count({where})]);
    return { items, pagination:{page,limit,total,pages:Math.ceil(total/limit)} };
  });
  app.post('/', async (request, reply) => {
    const workspace = await getWorkspaceForUser(app, request.user.id); const data = parseOrThrow(createSchema, request.body);
    const item = await app.prisma.contentItem.create({ data:{...data,workspaceId:workspace.id,ownerId:request.user.id}, include:{analysis:true,variants:true} });
    return reply.code(201).send(item);
  });
  app.get('/:id', async (request) => { const {id}=parseOrThrow(idSchema,request.params); const {workspace}=await assertContentAccess(app,request.user.id,id); return app.prisma.contentItem.findFirst({where:{id,workspaceId:workspace.id},include:{analysis:true,variants:true,approvals:true,schedules:{include:{socialAccount:true,variant:true}},publications:true,performance:{orderBy:{capturedAt:'desc'},take:20}}}); });
  app.patch('/:id', async (request) => { const {id}=parseOrThrow(idSchema,request.params); await assertContentAccess(app,request.user.id,id); return app.prisma.contentItem.update({where:{id},data:parseOrThrow(updateSchema,request.body)}); });
  app.delete('/:id', async (request,reply) => { const {id}=parseOrThrow(idSchema,request.params); await assertContentAccess(app,request.user.id,id); await app.prisma.contentItem.delete({where:{id}}); return reply.code(204).send(); });
  app.post('/:id/analyze', async (request, reply) => { const {id}=parseOrThrow(idSchema,request.params); await assertContentAccess(app,request.user.id,id); const data=parseOrThrow(analyzeRequestSchema,request.body); const result=await analyzeContent(app.prisma,id,data.language??'English',data.platforms??[]); return reply.code(200).send(result); });
  app.put('/:id/analysis', async (request) => { const {id}=parseOrThrow(idSchema,request.params); await assertContentAccess(app,request.user.id,id); const data=parseOrThrow(analysisSchema,request.body); const analysis=await app.prisma.contentAnalysis.upsert({where:{contentId:id},create:{contentId:id,...data},update:data}); await app.prisma.contentItem.update({where:{id},data:{processingStatus:'COMPLETE',status:'NEEDS_REVIEW'}}); return analysis; });
  app.put('/:id/variants', async (request) => { const {id}=parseOrThrow(idSchema,request.params); await assertContentAccess(app,request.user.id,id); const data=parseOrThrow(variantSchema,request.body); return app.prisma.platformVariant.upsert({where:{contentId_platform:{contentId:id,platform:data.platform}},create:{contentId:id,...data},update:data}); });
  app.post('/:id/approve', async (request,reply) => { const {id}=parseOrThrow(idSchema,request.params); await assertContentAccess(app,request.user.id,id); const body=parseOrThrow(z.object({variantId:z.string().optional(),note:z.string().max(1000).optional()}),request.body??{}); if(body.variantId){const variant=await app.prisma.platformVariant.findFirst({where:{id:body.variantId,contentId:id}});if(!variant)return reply.badRequest('Variant does not belong to this content');await app.prisma.platformVariant.update({where:{id:body.variantId},data:{status:'APPROVED'}});} const approval=await app.prisma.approval.create({data:{contentId:id,variantId:body.variantId,approvedById:request.user.id,note:body.note}}); await app.prisma.contentItem.update({where:{id},data:{status:'APPROVED'}}); return reply.code(201).send(approval); });
};
export default routes;
