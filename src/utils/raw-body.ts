import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export function registerRawBodyHook(app: FastifyInstance): void {
  app.addHook('preParsing', async (request: FastifyRequest, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);
    request.rawBody = rawBody.toString('utf8');
    const stream = Readable.from(rawBody);
    Object.defineProperty(stream, 'receivedEncodedLength', {
      value: rawBody.length
    });
    return stream;
  });
}
