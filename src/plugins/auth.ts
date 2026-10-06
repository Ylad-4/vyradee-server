import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string; username: string };
    user: { id: string; email: string; username: string };
  }
}

declare module "fastify" {
  interface FastifyInstance { authenticate: (request: import("fastify").FastifyRequest) => Promise<void> }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: "7d" } });
  app.decorate("authenticate", async (request) => { await request.jwtVerify(); });
});
