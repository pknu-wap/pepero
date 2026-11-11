import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { readPoems, savePoems, type Poem } from '@/lib/store';

function response(poems: Poem[], userId?: string) {
  return NextResponse.json(poems.map(({ voters, authorId, ...poem }) => ({
    ...poem,
    votes: voters.length,
    voted: !!userId && voters.includes(`kakao:${userId}`),
    owned: !!userId && authorId === userId,
  })), { headers: { 'Cache-Control': 'no-store' } });
}
export function GET(request: NextRequest) {
  try {
    const user = readSession(request.cookies.get(SESSION_COOKIE)?.value);
    return response(readPoems(), user?.id);
  } catch { return NextResponse.json({ error: '작품을 불러오지 못했어요.' }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const origin = new URL(process.env.KAKAO_REDIRECT_URI || request.url).origin;
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  const user = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: '카카오 로그인이 필요합니다.' }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: '올바르지 않은 요청이에요.' }, { status: 400 }); }
  if (!body || !['create', 'update', 'delete', 'vote'].includes(body.action)) return NextResponse.json({ error: '올바르지 않은 요청이에요.' }, { status: 400 });
  try {
    const poems = readPoems();
    const poem = poems.find(p => p.id === body.id);
    if (body.action !== 'create') {
      if (!poem) return NextResponse.json({ error: '작품을 찾을 수 없어요.' }, { status: 404 });
      if (['update', 'delete'].includes(body.action) && poem.authorId !== user.id) return NextResponse.json({ error: '본인이 작성한 작품만 수정·삭제할 수 있습니다.' }, { status: 403 });
    }
    if (body.action === 'create' || body.action === 'update') {
      if (!Array.isArray(body.lines) || body.lines.length !== 3 || !body.lines.every((line: unknown, i: number) => typeof line === 'string' && line.trim().length > 1 && line.trim().length <= 60 && line.trim().startsWith(['빼', '빼', '로'][i]))) return NextResponse.json({ error: '빼·빼·로로 시작하는 세 줄을 확인해주세요.' }, { status: 400 });
      const lines = body.lines.map((s: string) => s.trim());
      if (body.action === 'create') {
        poems.push({ id: randomUUID(), authorId: user.id, name: user.name, lines, created: Date.now(), voters: [] });
      } else if (poem) {
        poem.lines = lines;
      }
    } else if (body.action === 'vote' && poem) {
      const voter = `kakao:${user.id}`;
      poem.voters = poem.voters.includes(voter) ? poem.voters.filter(v => v !== voter) : [...poem.voters, voter];
    }
    const updated = body.action === 'delete' ? poems.filter(p => p.id !== body.id) : poems;
    savePoems(updated);
    return response(updated, user.id);
  } catch { return NextResponse.json({ error: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 }); }
}
