/**
 * Pairing code ("ADC1." token) shown in the admin panel. One string carries everything `setup` needs:
 *
 *   "ADC1." + base64url(JSON.stringify({ v:1, url, slug, inst, dev, key }))
 *
 * url  = API base URL WITHOUT a trailing /api
 * slug = madrasa slug, inst = institution id (number), dev = device id (string), key = raw device key ("adk_...")
 * base64url = standard base64 with + -> -, / -> _, no '=' padding (padding is accepted when parsing).
 */

export const PAIRING_PREFIX = 'ADC1.';
export const PAIRING_VERSION = 1;

export interface PairingData {
  v: 1;
  url: string;
  slug: string;
  inst: number;
  dev: string;
  key: string;
}

export function encodePairingToken(d: Omit<PairingData, 'v'> & { v?: number }): string {
  const url = String(d.url).replace(/\/+$/, '').replace(/\/api$/, '');
  const json = JSON.stringify({ v: PAIRING_VERSION, url, slug: d.slug, inst: d.inst, dev: d.dev, key: d.key });
  const b64 = Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return PAIRING_PREFIX + b64;
}

export function parsePairingToken(input: string): PairingData {
  const s = String(input ?? '').replace(/\s+/g, '');
  if (!s) throw new Error('pairing code is empty');
  if (!s.startsWith(PAIRING_PREFIX)) {
    throw new Error(`pairing code must start with "${PAIRING_PREFIX}" (copy the whole code from the admin panel)`);
  }
  const body = s.slice(PAIRING_PREFIX.length);
  if (!/^[A-Za-z0-9_\-+/]+={0,2}$/.test(body)) throw new Error('pairing code contains invalid characters (copy it again)');
  let obj: any;
  try {
    const b64 = body.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    obj = JSON.parse(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8'));
  } catch {
    throw new Error('pairing code is damaged or incomplete (copy it again)');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('pairing code is damaged (not an object)');
  if (obj.v !== PAIRING_VERSION) {
    throw new Error(`unsupported pairing code version ${JSON.stringify(obj.v)} (this connector understands v${PAIRING_VERSION}; update the connector)`);
  }
  const missing: string[] = [];
  const str = (k: string) => (typeof obj[k] === 'string' && obj[k].trim() ? obj[k].trim() : (missing.push(k), ''));
  const url = str('url');
  const slug = str('slug');
  const dev = obj.dev !== undefined && obj.dev !== null && typeof obj.dev !== 'object' && String(obj.dev).trim() ? String(obj.dev).trim() : (missing.push('dev'), '');
  const key = str('key');
  const inst = Number(obj.inst);
  if (obj.inst === undefined || obj.inst === null || obj.inst === '') missing.push('inst');
  if (missing.length) throw new Error(`pairing code is missing field(s): ${missing.join(', ')}`);
  if (!Number.isInteger(inst) || inst <= 0) throw new Error('pairing code field "inst" must be a positive integer');
  return { v: 1, url: url.replace(/\/+$/, '').replace(/\/api$/, ''), slug, inst, dev, key };
}
