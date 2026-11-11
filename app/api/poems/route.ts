import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { readPoems, savePoems, type Poem } from '@/lib/store';
function response(poems: Poem[], voter: string) {
  const result = NextResponse.json(poems.map(({ voters, ...poem }) => ({ ...poem, votes: voters.length, voted: voters.includes(voter) })));
  result.headers.set('Cache-Control', 'no-store');
  result.cookies.set('pepero-voter', voter, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 31536000, path: '/' });
  return result;
}
export function GET(request: NextRequest) {
  try { return response(readPoems(), request.cookies.get('pepero-voter')?.value || randomUUID()); }
  catch { return NextResponse.json({ error: '작품을 불러오지 못했어요.' }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const origin = new URL(process.env.KAKAO_REDIRECT_URI || request.url).origin;
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
  try {
    const body = await request.json();
    const voter = request.cookies.get('pepero-voter')?.value || randomUUID();
    const poems = readPoems();
    if (body.action === 'vote') {
      const poem = poems.find(p => p.id === body.id);
      if (!poem) return NextResponse.json({ error: '작품을 찾을 수 없어요.' }, { status: 404 });
      poem.voters = poem.voters.includes(voter) ? poem.voters.filter(v => v !== voter) : [...poem.voters, voter];
    } else if (body.action === 'create') {
      const user = readSession(request.cookies.get(SESSION_COOKIE)?.value);
      if (!user) return NextResponse.json({ error: '삼행시를 쓰려면 카카오 로그인이 필요합니다.' }, { status: 401 });
      if (!Array.isArray(body.lines) || body.lines.length !== 3 || !body.lines.every((line: unknown, i: number) => typeof line === 'string' && line.trim().length > 1 && line.trim().length <= 60 && line.trim().startsWith(['빼', '빼', '로'][i]))) return NextResponse.json({ error: '빼·빼·로로 시작하는 세 줄을 확인해주세요.' }, { status: 400 });
      poems.push({ id: randomUUID(), name: user.name, lines: body.lines.map((s: string) => s.trim()), created: Date.now(), voters: [] });
    } else return NextResponse.json({ error: '올바르지 않은 요청이에요.' }, { status: 400 });
    savePoems(poems);
    return response(poems, voter);
  } catch { return NextResponse.json({ error: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 }); }
}
