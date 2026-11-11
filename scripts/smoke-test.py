"""Local development only: python3 scripts/smoke-test.py (requires running dev server)."""
import http.cookiejar, json, urllib.request, urllib.error, secrets, hashlib, time
from pathlib import Path

base = 'http://localhost:3000/api/poems'
sessions = []
created = None
nickname = '카카오에서 받은 열두 글자보다 긴 닉네임'
def client(user_id=None):
    jar = http.cookiejar.CookieJar()
    if user_id:
        token = secrets.token_hex(32)
        path = Path('.data/sessions') / (hashlib.sha256(token.encode()).hexdigest() + '.json')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'version':2,'user':{'id':user_id,'name':nickname},'expires':int(time.time()*1000)+60000}))
        sessions.append(path)
        jar.set_cookie(http.cookiejar.Cookie(0,'pepero-session',token,None,False,'localhost.local',False,False,'/',True,False,None,True,None,None,{}))
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(client, data=None):
    req = urllib.request.Request(base, data=json.dumps(data).encode() if data else None, headers={'Content-Type':'application/json','Origin':'http://localhost:3000'})
    with client.open(req) as response:
        return json.load(response)
def denied(client, data, status):
    try:
        request(client,data)
        raise AssertionError('Unauthorized/invalid operation accepted')
    except urllib.error.HTTPError as error:
        assert error.code == status, (error.code, status)
def poem(rows): return next(p for p in rows if p['id'] == created)
lines = ['빼곡한 테스트','빼놓지 않는 확인','로컬에서 검증 완료']
try:
    guest, a, b, a_second = client(), client('test-author'), client('test-other'), client('test-author')
    for action in ['create','vote','update','delete']:
        denied(guest,{'action':action,'id':'sample-3','lines':lines},401)
    rows = request(a,{'action':'create','name':'위조 이름','authorId':'test-other','lines':lines})
    created = rows[-1]['id']
    assert poem(rows)['name'] == nickname and poem(rows)['owned'] is True
    assert 'authorId' not in poem(rows) and 'voters' not in poem(rows)
    assert poem(request(b))['owned'] is False
    assert poem(request(guest))['owned'] is False
    denied(b,{'action':'update','id':created,'lines':lines},403)
    denied(b,{'action':'delete','id':created},403)
    denied(a,{'action':'delete','id':'sample-3'},403)
    assert poem(request(a,{'action':'vote','id':created}))['votes'] == 1
    assert poem(request(a_second))['voted'] is True
    assert poem(request(b,{'action':'vote','id':created}))['votes'] == 2
    result = poem(request(a_second,{'action':'vote','id':created}))
    assert result['votes'] == 1 and result['voted'] is False
    denied(a,{'action':'update','id':created,'lines':['다른','시작','글자']},400)
    changed = ['빼곡한 수정','빼놓지 않는 검사','로컬 수정 완료']
    result = poem(request(a,{'action':'update','id':created,'name':'위조','lines':changed}))
    assert result['lines'] == changed and result['name'] == nickname and result['votes'] == 1
    assert result['created'] == poem(rows)['created']
    assert poem(request(a_second))['owned'] is True
    assert not any(p['id'] == created for p in request(a,{'action':'delete','id':created}))
    denied(a,{'action':'update','id':created,'lines':lines},404)
    for path in sessions:
        saved=json.loads(path.read_text());saved['expires']=0;path.write_text(json.dumps(saved))
    denied(a,{'action':'create','lines':lines},401)
    denied(b,{'action':'vote','id':'sample-3'},401)
    print('PASS: authenticated writes/votes, owner-only edits/deletes, account votes across sessions, immutable author, validation, expiration')
finally:
    for path in sessions: path.unlink(missing_ok=True)
    if created:
        path=Path('.data/poems.json')
        rows=json.loads(path.read_text())
        temp=path.with_suffix('.tmp')
        temp.write_text(json.dumps([p for p in rows if p['id'] != created],ensure_ascii=False))
        temp.replace(path)
