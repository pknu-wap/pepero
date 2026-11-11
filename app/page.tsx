'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { randomOrder } from '@/lib/random-order';
type Poem = { id: string; name: string; lines: string[]; created: number; votes: number; voted: boolean; owned: boolean };
function Heart({ filled = false }: { filled?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>; }
export default function Home() {
  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const [lines, setLines] = useState(['', '', '']);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  async function refresh() {
    try { const response = await fetch('/api/poems'); if (!response.ok) throw new Error(); const result: Poem[] = await response.json(); setPoems(previous => randomOrder(previous, result)); }
    catch { setMessage('작품을 불러오지 못했어요. 새로고침으로 다시 시도해주세요.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('login_error');
    if (error) {
      const errors: Record<string, string> = {
        nickname: '카카오 닉네임 제공 동의가 필요합니다. 다시 로그인해주세요.',
        cancelled: '카카오 로그인이 취소됐습니다.',
        state: '로그인 요청이 만료됐습니다. 다시 로그인해주세요.',
        configuration: '카카오 로그인 설정을 확인해주세요.',
        failed: '카카오 로그인에 실패했습니다. 다시 시도해주세요.',
      };
      setMessage(errors[error] || errors.failed);
      params.delete('login_error');
      window.history.replaceState(null, '', window.location.pathname + (params.size ? `?${params}` : '') + window.location.hash);
    }
    fetch('/api/auth/session').then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      setUser(result.user);
    }).catch(() => setMessage('로그인 상태를 확인하지 못했습니다.')).finally(() => setAuthLoading(false));
  }, []);
  async function logout() {
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setUser(null);
      setPoems(previous => previous.map(p => ({ ...p, owned: false, voted: false })));
      await refresh();
      setMessage('로그아웃했습니다.');
    } catch { setMessage('로그아웃하지 못했습니다. 다시 시도해주세요.'); }
    finally { setAuthLoading(false); }
  }
  async function mutate(data: object) {
    if (authLoading) return false;
    if (!user) { window.location.assign('/api/auth/kakao'); return false; }
    setBusy(true);
    try {
      const response = await fetch('/api/poems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json();
      if (response.status === 401) {
        setUser(null);
        setPoems(previous => previous.map(p => ({ ...p, owned: false, voted: false })));
        dialog.current?.close();
        setMessage('로그인이 만료됐습니다. 다시 로그인해주세요.');
        return false;
      }
      if (!response.ok) throw new Error(result.error);
      setPoems(previous => randomOrder(previous, result)); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : '다시 시도해주세요.'); return false; }
    finally { setBusy(false); }
  }
  function openComposer(poem?: Poem) {
    if (authLoading) return;
    if (!user) { window.location.assign('/api/auth/kakao'); return; }
    setMessage('');
    setEditingId(poem?.id ?? null);
    setLines(poem ? poem.lines.map(line => line.slice(1)) : ['', '', '']);
    dialog.current?.showModal();
  }
  return <>
    <main id="poems">
      <div className="title-row">
        <div className="pepero-decoration decoration-left" aria-hidden="true"><i/><i/></div>
        <h1><Image className="wap-logo" src="/wap.png" alt="WAP" width={774} height={322} preload />{' X 빼빼로데이'}</h1>
        <div className="pepero-decoration decoration-right" aria-hidden="true"><Image className="chiikawa-pepero" src="/chiikawa-pepero.png" alt="" width={1073} height={1466} sizes="(max-width: 600px) 48px, 100px" /></div>
        <button className="button write-button" disabled={authLoading} onClick={() => openComposer()}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z"/></svg>삼행시 쓰기</button>
        <div className="auth-controls">
          {authLoading ? <span>로그인 확인 중…</span> : user ? <><span>{user.name}님</span><button type="button" onClick={logout}>로그아웃</button></> : <a className="kakao-login" href="/api/auth/kakao"><Image src="/images/kakao-login.svg" alt="카카오 로그인" width={224} height={46} unoptimized /></a>}
        </div>
      </div>
      {loading ? <p className="empty">불러오는 중…</p> : poems.length === 0 ? <p className="empty">등록된 작품이 없습니다.</p> : <div className="poem-grid">{poems.map(p => <article className="poem-card" key={p.id}>
        {p.id.startsWith('sample') && <div className="card-top">예시</div>}
        <div className="poem-lines">{p.lines.map((line,i) => <div key={i}><b>{['빼','빼','로'][i]}</b><p>{line.slice(1)}</p></div>)}</div>
        <div className="card-bottom"><span>{p.name}</span><button disabled={busy || authLoading} className={`vote ${p.voted ? 'voted' : ''}`} aria-label={`${p.name} 작품 ${p.voted ? '투표 취소' : '투표'}`} aria-pressed={p.voted} onClick={() => mutate({ action: 'vote', id: p.id })}><Heart filled={p.voted}/>{p.votes}</button></div>
        {user && p.owned && <div className="owner-actions"><button disabled={busy} onClick={() => openComposer(p)}>수정</button><button disabled={busy} onClick={async () => { if (window.confirm('이 작품을 삭제할까요? 삭제하면 복구할 수 없습니다.')) { if (await mutate({ action: 'delete', id: p.id })) setMessage('삭제했습니다.'); } }}>삭제</button></div>}
      </article>)}</div>}
    </main>
    {message && <div className="toast" role="status">{message}<button aria-label="알림 닫기" onClick={() => setMessage('')}>×</button></div>}
    <dialog aria-labelledby="compose-title" ref={dialog} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}><form onSubmit={async e => { e.preventDefault(); if (await mutate({ action: editingId ? 'update' : 'create', id: editingId, lines: lines.map((s,i) => ['빼','빼','로'][i] + s) })) { dialog.current?.close(); setLines(['','','']); setMessage(editingId ? '수정했습니다.' : '등록했습니다.'); setEditingId(null); document.getElementById('poems')?.scrollIntoView({ behavior:'smooth' }); } }}><div className="modal-top"><h2 id="compose-title">{editingId ? '삼행시 수정' : '삼행시 쓰기'}</h2><button type="button" aria-label="닫기" onClick={() => dialog.current?.close()}>×</button></div><p className="author-name">작성자 <strong>{user?.name}</strong></p><div className="compose-lines">{lines.map((line,i) => <label key={i}><b>{['빼','빼','로'][i]}</b><input aria-label={`${i+1}번째 줄, ${['빼','빼','로'][i]} 다음 내용`} required maxLength={59} value={line} onChange={e => setLines(lines.map((s,j) => i === j ? e.target.value : s))} placeholder="내용 입력"/></label>)}</div><p className="form-note">등록한 작품은 모든 방문자에게 공개됩니다.</p>{message && <p role="alert" className="coral">{message}</p>}<button className="button submit" disabled={busy}>{busy ? '저장 중…' : editingId ? '수정하기' : '등록하기'}</button></form></dialog>
  </>;
}
