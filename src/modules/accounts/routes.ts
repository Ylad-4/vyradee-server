import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseOrThrow } from '../../lib/schemas.js';
import { getWorkspaceForUser } from '../../lib/workspace.js';
import { createMetaState,exchangeMetaCode,getMetaAuthorizationUrl,getMetaPages,sealSocialToken,verifyMetaState } from '../../services/meta.js';
const paramsSchema=z.object({id:z.string().min(1)});
const accountSchema=z.object({platform:z.enum(['INSTAGRAM','TIKTOK','YOUTUBE','FACEBOOK','X','LINKEDIN']),accountName:z.string().min(1).max(100),externalAccountId:z.string().max(200).optional(),connected:z.boolean().default(false)});
const connectQuery=z.object({returnUrl:z.string().min(1).max(1000)});
const callbackQuery=z.object({code:z.string().optional(),state:z.string().optional(),error:z.string().optional(),error_description:z.string().optional()});
const publicAccount={id:true,platform:true,accountName:true,externalAccountId:true,connected:true,tokenExpiresAt:true,createdAt:true,updatedAt:true} as const;
const routes:FastifyPluginAsync=async(app)=>{
 app.get('/',{preHandler:app.authenticate},async(request)=>{const workspace=await getWorkspaceForUser(app,request.user.id);return app.prisma.socialAccount.findMany({where:{workspaceId:workspace.id},orderBy:{createdAt:'asc'},select:publicAccount})});
 app.get('/meta/connect-url',{preHandler:app.authenticate},async(request)=>{const workspace=await getWorkspaceForUser(app,request.user.id);const{returnUrl}=parseOrThrow(connectQuery,request.query);const state=createMetaState({userId:request.user.id,workspaceId:workspace.id,returnUrl});return{url:getMetaAuthorizationUrl(state)}});
 app.get('/meta/callback',async(request,reply)=>{
  const query=parseOrThrow(callbackQuery,request.query);
  if(!query.state)throw Object.assign(new Error('Missing OAuth state'),{statusCode:400});
  const state=verifyMetaState(query.state);
  const finish=(result:'connected'|'denied',message?:string)=>{const url=new URL(state.returnUrl);url.searchParams.set('meta',result);if(message)url.searchParams.set('message',message.slice(0,160));return reply.redirect(url.toString())};
  if(query.error||!query.code)return finish('denied',query.error_description??'Meta connection was cancelled');
  const membership=await app.prisma.workspaceMember.findFirst({where:{workspaceId:state.workspaceId,userId:state.userId}});
  if(!membership)throw Object.assign(new Error('Workspace access is no longer valid'),{statusCode:403});
  const token=await exchangeMetaCode(query.code);
  const pages=await getMetaPages(token.accessToken);
  if(!pages.length)return finish('denied','No Facebook Pages were available for this account');
  const tokenExpiresAt=token.expiresIn?new Date(Date.now()+token.expiresIn*1000):null;
  await app.prisma.$transaction(pages.flatMap(page=>{
   const tokenReference=sealSocialToken(page.access_token);
   const writes=[
    app.prisma.socialAccount.upsert({where:{workspaceId_platform_accountName:{workspaceId:state.workspaceId,platform:'FACEBOOK',accountName:page.name}},create:{workspaceId:state.workspaceId,platform:'FACEBOOK',accountName:page.name,externalAccountId:page.id,connected:true,tokenReference,tokenExpiresAt},update:{externalAccountId:page.id,connected:true,tokenReference,tokenExpiresAt}})
   ];
   if(page.instagram_business_account){const account=page.instagram_business_account;const accountName=account.username??account.name??`Instagram ${account.id}`;writes.push(app.prisma.socialAccount.upsert({where:{workspaceId_platform_accountName:{workspaceId:state.workspaceId,platform:'INSTAGRAM',accountName}},create:{workspaceId:state.workspaceId,platform:'INSTAGRAM',accountName,externalAccountId:account.id,connected:true,tokenReference,tokenExpiresAt},update:{externalAccountId:account.id,connected:true,tokenReference,tokenExpiresAt}}))}
   return writes;
  }));
  return finish('connected');
 });
 app.post('/',{preHandler:app.authenticate},async(request,reply)=>{const workspace=await getWorkspaceForUser(app,request.user.id);const data=parseOrThrow(accountSchema,request.body);const account=await app.prisma.socialAccount.create({data:{workspaceId:workspace.id,...data},select:publicAccount});return reply.code(201).send(account)});
 app.delete('/:id',{preHandler:app.authenticate},async(request,reply)=>{const workspace=await getWorkspaceForUser(app,request.user.id);const{id}=parseOrThrow(paramsSchema,request.params);const result=await app.prisma.socialAccount.deleteMany({where:{id,workspaceId:workspace.id}});if(!result.count)return reply.notFound('Social account not found');return reply.code(204).send()});
};export default routes;
