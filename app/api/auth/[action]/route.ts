import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createSession, deleteSession, readSession, SESSION_COOKIE, SESSION_SECONDS } from '@/lib/auth';

const STATE_COOKIE = 'pepero-oauth-state';
function config() {
  const redirect = new URL(process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback');
  return { redirect, clientId: process.env.KAKAO_REST_API_KEY, cookie: { httpOnly: true, sameSite: 'lax' as const, secure: redirect.protocol === 'https:', path: '/' } };
}
function finish(error?: string) {
  const { redirect, cookie } = config();
  const url = new URL('/', redirect);
  if (error) url.searchParams.set('login_error', error);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, '', { ...cookie, maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export async function GET(request: NextRequest, context: RouteContext<'/api/auth/[action]'>) {
  const { action } = await context.params;
  const { redirect, clientId, cookie } = config();
  if (action === 'session') {
    const user = readSession(request.cookies.get(SESSION_COOKIE)?.value);
    return NextResponse.json({ user: user ? { name: user.name } : null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (action === 'kakao') {
    if (!clientId) return finish('configuration');
    const state = randomBytes(32).toString('hex');
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect.href, response_type: 'code', scope: 'profile_nickname', state }).toString();
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, state, { ...cookie, maxAge: 600 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  if (action !== 'callback') return new NextResponse(null, { status: 404 });
  const state = request.nextUrl.searchParams.get('state');
  if (!state || state !== request.cookies.get(STATE_COOKIE)?.value) return finish('state');
  if (request.nextUrl.searchParams.has('error')) return finish('cancelled');
  const code = request.nextUrl.searchParams.get('code');
  if (!code || !clientId) return finish('configuration');
  try {
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect.href, code });
    if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
    const tokens = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const token = await tokens.json();
    if (!tokens.ok || typeof token.access_token !== 'string') return finish(token.error_code === 'KOE010' ? 'configuration' : 'failed');
    const profile = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const user = await profile.json();
    if (!profile.ok || !Number.isSafeInteger(user.id) || user.id <= 0) return finish('failed');
    const nickname = user.kakao_account?.profile?.nickname ?? user.properties?.nickname;
    if (typeof nickname !== 'string' || !nickname.trim()) return finish('nickname');
    const name = nickname;
    const session = createSession({ id: String(user.id), name });
    deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = finish();
    response.cookies.set(SESSION_COOKIE, session, { ...cookie, maxAge: SESSION_SECONDS });
    return response;
  } catch { return finish('failed'); }
}
export async function POST(request: NextRequest, context: RouteContext<'/api/auth/[action]'>) {
  const { action } = await context.params;
  if (action !== 'logout') return new NextResponse(null, { status: 404 });
  const { redirect, cookie } = config();
  if (request.headers.get('origin') !== redirect.origin) return new NextResponse(null, { status: 403 });
  try {
    deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SESSION_COOKIE, '', { ...cookie, maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ error: '로그아웃하지 못했습니다.' }, { status: 500 }); }
}
