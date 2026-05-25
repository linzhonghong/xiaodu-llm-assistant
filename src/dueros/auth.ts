import { X509Certificate, createVerify } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { DuerOsRequestEnvelope } from './types.js';

const allowedCertHost = 'duer.bdstatic.com';
const allowedCertPathPrefix = '/saiya/flow/';
const requiredSubjectAltName = 'DNS:dueros-api.baidu.com';
const maxTimestampSkewMs = 180_000;

export class DuerOsAuthError extends Error {}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export function validateSignatureCertUrl(signatureCertUrl: string): URL {
  let url: URL;
  try {
    url = new URL(signatureCertUrl);
  } catch {
    throw new DuerOsAuthError('Invalid signature certificate URL');
  }

  if (url.protocol !== 'https:') {
    throw new DuerOsAuthError('Signature certificate URL must use HTTPS');
  }
  if (url.hostname !== allowedCertHost) {
    throw new DuerOsAuthError('Unexpected signature certificate host');
  }
  if (url.port && url.port !== '443') {
    throw new DuerOsAuthError('Unexpected signature certificate port');
  }
  if (!url.pathname.startsWith(allowedCertPathPrefix)) {
    throw new DuerOsAuthError('Unexpected signature certificate path');
  }
  if (url.username || url.password) {
    throw new DuerOsAuthError('Signature certificate URL must not contain credentials');
  }

  return url;
}

function validateCertificate(pem: string): X509Certificate {
  const certificate = new X509Certificate(pem);
  const subjectAltNames = (certificate.subjectAltName ?? '')
    .split(/,\s*/)
    .map((value) => value.trim());

  if (!subjectAltNames.includes(requiredSubjectAltName)) {
    throw new DuerOsAuthError('Unexpected signature certificate SAN');
  }

  return certificate;
}

function assertFreshTimestamp(body: DuerOsRequestEnvelope, now = Date.now()): void {
  const timestamp = body.request?.timestamp;
  if (!timestamp) {
    throw new DuerOsAuthError('Missing DuerOS request timestamp');
  }

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new DuerOsAuthError('Invalid DuerOS request timestamp');
  }

  if (Math.abs(now - timestampMs) >= maxTimestampSkewMs) {
    throw new DuerOsAuthError('Stale DuerOS request timestamp');
  }
}

export function createDuerOsSignatureVerifier(fetchCert: typeof fetch = fetch) {
  const certificateCache = new Map<string, X509Certificate>();

  return {
    async verify(headers: IncomingHttpHeaders, rawBody: string, body: DuerOsRequestEnvelope): Promise<void> {
      const signatureCertUrl = headerValue(headers.signaturecerturl);
      const signature = headerValue(headers.signature);
      if (!signatureCertUrl || !signature) {
        throw new DuerOsAuthError('Missing DuerOS signature headers');
      }

      const certUrl = validateSignatureCertUrl(signatureCertUrl).toString();
      let certificate = certificateCache.get(certUrl);
      if (!certificate) {
        const response = await fetchCert(certUrl);
        if (!response.ok) {
          throw new DuerOsAuthError(`Could not download DuerOS signature certificate: ${response.status}`);
        }
        certificate = validateCertificate(await response.text());
        certificateCache.set(certUrl, certificate);
      }

      const verifier = createVerify('RSA-SHA1');
      verifier.update(rawBody);
      verifier.end();
      const isValid = verifier.verify(certificate.publicKey, signature, 'base64');
      if (!isValid) {
        throw new DuerOsAuthError('Invalid DuerOS request signature');
      }

      assertFreshTimestamp(body);
    }
  };
}
