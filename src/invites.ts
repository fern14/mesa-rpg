export function makeInviteUrl(code: string, siteUrl: string) {
  if (!/^[A-Z0-9]{8,24}$/.test(code)) throw new Error('Código de convite inválido.');
  const url = new URL(siteUrl);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    throw new Error('O endereço público precisa usar HTTPS.');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.searchParams.set('code', code);
  return url.toString();
}
export function publicSiteUrl() {
  if (process.env.EXPO_PUBLIC_SITE_URL) return process.env.EXPO_PUBLIC_SITE_URL;
  if (typeof window !== 'undefined' && window.location) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }
  throw new Error(
    'Configure EXPO_PUBLIC_SITE_URL com o endereço publicado para compartilhar convites HTTPS.',
  );
}
