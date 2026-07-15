// PKCE helper: converts random bytes to URL-safe Base64 (no padding)
export function base64urlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = (typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64'));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}