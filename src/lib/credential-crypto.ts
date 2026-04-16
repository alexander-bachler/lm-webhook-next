import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

function getKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw || raw.length < 8) return null;
  return scryptSync(raw, 'lm-webhook-salt', 32);
}

/**
 * Encrypt a UTF-8 string; returns base64 payload prefixed with enc:v1:
 */
export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) throw new Error('CREDENTIALS_KEY is not set');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${Buffer.concat([iv, tag, enc]).toString('base64')}`;
}

export function decryptSecretIfNeeded(value: string | undefined | null): string | undefined {
  if (value == null || value === '') return undefined;
  if (!value.startsWith('enc:v1:')) return value;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIALS_KEY required to decrypt stored secrets');
    }
    return value;
  }
  const raw = Buffer.from(value.slice('enc:v1:'.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
