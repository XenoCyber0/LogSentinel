import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose';
import { env } from '@/env';
import crypto from 'crypto';

const ALGORITHM = 'RS256';
const ACCESS_TOKEN_EXPIRY = '15m';

export interface JWTPayload extends JoseJWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  const privateKey = await importPrivateKey();
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer(env.NEXT_PUBLIC_APP_URL)
    .setAudience(env.NEXT_PUBLIC_APP_URL)
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const publicKey = await importPublicKey();
  
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: env.NEXT_PUBLIC_APP_URL,
    audience: env.NEXT_PUBLIC_APP_URL,
  });
  
  return payload as JWTPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function importPrivateKey(): Promise<CryptoKey> {
  const pem = env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  const keyData = pemToArrayBuffer(pem, 'PRIVATE KEY');
  
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function importPublicKey(): Promise<CryptoKey> {
  const pem = env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
  const keyData = pemToArrayBuffer(pem, 'PUBLIC KEY');
  
  return await crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

function pemToArrayBuffer(pem: string, type: string): BufferSource {
  const base64 = pem
    .replace(`-----BEGIN ${type}-----`, '')
    .replace(`-----END ${type}-----`, '')
    .replace(/\s/g, '');
  return Buffer.from(base64, 'base64');
}
