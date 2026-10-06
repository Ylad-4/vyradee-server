import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../../config/env.js';
import { getWorkspaceForUser } from '../../lib/workspace.js';

const routes:FastifyPluginAsync=async(app)=>{
 app.addHook('preHandler',app.authenticate);
 app.post('/upload-signature',async(request,reply)=>{
  if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET)return reply.code(503).send({error:'Media storage is not configured. Add the Cloudinary values to server/.env.',statusCode:503});
  const workspace=await getWorkspaceForUser(app,request.user.id);const timestamp=Math.round(Date.now()/1000);const folder=`vyradee/${workspace.id}`;const publicId=randomUUID();
  const signature=cloudinary.utils.api_sign_request({timestamp,folder,public_id:publicId,overwrite:false},env.CLOUDINARY_API_SECRET);
  return{cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,timestamp,signature,folder,publicId,uploadUrl:`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`};
 });
};
export default routes;
