import { createPartFromUri, FileState, GoogleGenAI } from '@google/genai';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import type { Platform, PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

type GeneratedResult={analysis:{topic:string;summary:string;audience:string;purpose:string;tone:string;confidence:'LOW'|'MEDIUM'|'HIGH';uncertainties:string[]};variants:{platform:Platform;caption:string;cta:string;hashtags:string[];warnings:string[]}[]};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export async function analyzeContent(prisma:PrismaClient,contentId:string,language:string,platforms:Platform[]){
 if(!env.GEMINI_API_KEY){const error=new Error('Gemini is not configured. Add GEMINI_API_KEY to server/.env.') as Error&{statusCode:number};error.statusCode=503;throw error}
 const content=await prisma.contentItem.findUnique({where:{id:contentId},include:{workspace:{include:{brandProfile:true}}}});
 if(!content?.mediaUrl)throw new Error('This content does not have an uploaded media URL');
 await prisma.contentItem.update({where:{id:contentId},data:{processingStatus:'RUNNING',status:'PROCESSING'}});
 const ai=new GoogleGenAI({apiKey:env.GEMINI_API_KEY});let tempPath:string|undefined;let geminiFileName:string|undefined;
 try{
  const response=await fetch(content.mediaUrl);if(!response.ok)throw new Error(`Could not download uploaded media (${response.status})`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>100*1024*1024)throw new Error('Gemini MVP analysis supports media up to 100 MB');
  const extension=extname(content.originalFilename??'')||`.${content.mediaFormat??(content.mediaType==='IMAGE'?'jpg':'mp4')}`;tempPath=join(tmpdir(),`vyradee-${content.id}${extension}`);await writeFile(tempPath,bytes);
  const mimeType=content.mediaType==='IMAGE'?`image/${content.mediaFormat??'jpeg'}`:`video/${content.mediaFormat??'mp4'}`;
  let file=await ai.files.upload({file:tempPath,config:{mimeType,displayName:content.title}});geminiFileName=file.name;
  const started=Date.now();while(file.state===FileState.PROCESSING){if(Date.now()-started>180000)throw new Error('Gemini took too long to process the media');await sleep(3000);file=await ai.files.get({name:file.name!})}
  if(file.state===FileState.FAILED||!file.uri||!file.mimeType)throw new Error(file.error?.message??'Gemini media processing failed');
  const brand=content.workspace.brandProfile;const brandContext=brand?JSON.stringify({identity:brand.identity,positioning:brand.positioning,audience:brand.audience,voice:brand.voice,preferredLanguage:brand.preferredLanguage,prohibitedLanguage:brand.prohibitedLanguage,contentThemes:brand.contentThemes,publishingRules:brand.publishingRules}):'No Brand Brain has been configured.';
  const prompt=`Analyze this creator media for VyraDee. Output language: ${language}. Target platforms: ${platforms.join(', ')}. Creator context: ${content.description??'None provided'}. Brand Brain: ${brandContext}. Return factual content understanding plus one platform-native caption, a concise CTA, relevant hashtags without # symbols, and warnings for each requested platform. Do not invent claims that are not supported by the media. Keep captions useful and editable.`;
  const generated=await ai.models.generateContent({
   model:env.GEMINI_MODEL,
   contents:[{role:'user',parts:[createPartFromUri(file.uri,file.mimeType),{text:prompt}]}],
   config:{
    temperature:.4,
    responseMimeType:'application/json',
    responseJsonSchema:{
     type:'object',
     required:['analysis','variants'],
     properties:{
      analysis:{
       type:'object',
       required:['topic','summary','audience','purpose','tone','confidence','uncertainties'],
       properties:{topic:{type:'string'},summary:{type:'string'},audience:{type:'string'},purpose:{type:'string'},tone:{type:'string'},confidence:{type:'string',enum:['LOW','MEDIUM','HIGH']},uncertainties:{type:'array',items:{type:'string'}}},
      },
      variants:{
       type:'array',
       items:{type:'object',required:['platform','caption','cta','hashtags','warnings'],properties:{platform:{type:'string',enum:platforms},caption:{type:'string'},cta:{type:'string'},hashtags:{type:'array',items:{type:'string'}},warnings:{type:'array',items:{type:'string'}}}},
      },
     },
    },
   },
  });
  const text=generated.text;if(!text)throw new Error('Gemini returned an empty response');const parsed=JSON.parse(text) as GeneratedResult;
  await prisma.$transaction(async tx=>{await tx.contentAnalysis.upsert({where:{contentId},create:{contentId,...parsed.analysis},update:parsed.analysis});for(const variant of parsed.variants){if(!platforms.includes(variant.platform))continue;await tx.platformVariant.upsert({where:{contentId_platform:{contentId,platform:variant.platform}},create:{contentId,...variant,status:'NEEDS_REVIEW'},update:{...variant,status:'NEEDS_REVIEW'}})}await tx.contentItem.update({where:{id:contentId},data:{processingStatus:'COMPLETE',status:'NEEDS_REVIEW'}})});
  return prisma.contentItem.findUnique({where:{id:contentId},include:{analysis:true,variants:true}});
 }catch(error){await prisma.contentItem.update({where:{id:contentId},data:{processingStatus:'FAILED',status:'FAILED'}}).catch(()=>undefined);throw error}
 finally{if(tempPath)await unlink(tempPath).catch(()=>undefined);if(geminiFileName)await ai.files.delete({name:geminiFileName}).catch(()=>undefined)}
}
