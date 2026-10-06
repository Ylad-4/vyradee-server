import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';
import { env } from './config/env.js';
import analyticsRoutes from './modules/analytics/routes.js';
import accountsRoutes from './modules/accounts/routes.js';
import authRoutes from './modules/auth/routes.js';
import brandRoutes from './modules/brand/routes.js';
import contentRoutes from './modules/content/routes.js';
import healthRoutes from './modules/health/routes.js';
import mediaRoutes from './modules/media/routes.js';
import schedulesRoutes from './modules/schedules/routes.js';
import userRoutes from './modules/users/routes.js';
import workspacesRoutes from './modules/workspaces/routes.js';
import authPlugin from './plugins/auth.js';
import prismaPlugin from './plugins/prisma.js';

export async function buildApp(){
 const app=Fastify({logger:{level:env.NODE_ENV==='production'?'info':'debug'}});
 await app.register(cors,{origin:env.CORS_ORIGIN==='*'?true:env.CORS_ORIGIN.split(',').map(value=>value.trim()),credentials:true});
 await app.register(sensible);await app.register(prismaPlugin);await app.register(authPlugin);
 await app.register(healthRoutes,{prefix:'/api/health'});await app.register(authRoutes,{prefix:'/api/auth'});await app.register(userRoutes,{prefix:'/api/users'});await app.register(workspacesRoutes,{prefix:'/api/workspaces'});await app.register(brandRoutes,{prefix:'/api/brand-profile'});await app.register(contentRoutes,{prefix:'/api/content'});await app.register(mediaRoutes,{prefix:'/api/media'});await app.register(accountsRoutes,{prefix:'/api/social-accounts'});await app.register(schedulesRoutes,{prefix:'/api/schedules'});await app.register(analyticsRoutes,{prefix:'/api/analytics'});
 app.setNotFoundHandler((_,reply)=>reply.code(404).send({error:'Route not found',statusCode:404}));
 app.setErrorHandler((error,request,reply)=>{const err=error as Error & {statusCode?:number};request.log.error(err);const statusCode=err.statusCode&&err.statusCode>=400?err.statusCode:500;reply.code(statusCode).send({error:statusCode===500?'Internal server error':err.message,statusCode})});
 return app;
}
