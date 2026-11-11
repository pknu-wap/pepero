"""Run against a local dev server: python3 scripts/smoke-test.py"""
import http.cookiejar, json, urllib.request, urllib.error, secrets, hashlib, time
from pathlib import Path

base = 'http://localhost:3000/api/poems'
jar = http.cookiejar.CookieJar()
a = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
b = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(client, data=None):
    req = urllib.request.Request(base, data=json.dumps(data).encode() if data else None, headers={'Content-Type': 'application/json'})
    with client.open(req) as response:
        return json.load(response)
request(a)
request(b)
created = None
session_path = None
try:
    try:
        request(a, {'action':'create','name':'위조 이름','lines':['빼곡한 테스트','빼놓지 않는 확인','로컬에서 검증 완료']})
        raise AssertionError('Anonymous creation accepted')
    except urllib.error.HTTPError as error:
        assert error.code == 401
    token = secrets.token_hex(32)
    session_path = Path('.data/sessions') / (hashlib.sha256(token.encode()).hexdigest() + '.json')
    session_path.parent.mkdir(parents=True, exist_ok=True)
    nickname = '카카오에서 받은 열두 글자보다 긴 닉네임'
    session = {'version':2, 'user':{'id':'test-user','name':nickname}, 'expires':int(time.time()*1000)+60000}
    session_path.write_text(json.dumps(session))
    jar.set_cookie(http.cookiejar.Cookie(0, 'pepero-session', token, None, False, 'localhost.local', False, False, '/', True, False, None, True, None, None, {}))
    rows = request(a, {'action':'create','name':'API 검증','lines':['빼곡한 테스트','빼놓지 않는 확인','로컬에서 검증 완료']})
    created = rows[-1]['id']
    assert rows[-1]['name'] == nickname, 'Client cannot choose or truncate the author name'
    assert any(p['id'] == created for p in request(b)), 'Creation must be shared'
    def poem(rows): return next(p for p in rows if p['id'] == created)
    assert poem(request(a, {'action':'vote','id':created}))['votes'] == 1
    assert poem(request(b))['voted'] is False
    assert poem(request(b, {'action':'vote','id':created}))['votes'] == 2
    result = poem(request(a, {'action':'vote','id':created}))
    assert result['votes'] == 1 and result['voted'] is False
    try:
        request(a, {'action':'create','name':'잘못된 작품','lines':['다른','시작','글자']})
        raise AssertionError('Invalid acrostic accepted')
    except urllib.error.HTTPError as error:
        assert error.code == 400
    session['expires'] = 0
    session_path.write_text(json.dumps(session))
    try:
        request(a, {'action':'create','lines':['빼곡한 테스트','빼놓지 않는 확인','로컬에서 검증 완료']})
        raise AssertionError('Expired session accepted')
    except urllib.error.HTTPError as error:
        assert error.code == 401
    print('PASS: login required, server-owned nickname, no truncation, expired session, voting, validation')
finally:
    if session_path:
        session_path.unlink(missing_ok=True)
    if created:
        path = Path('.data/poems.json')
        rows = json.loads(path.read_text())
        path.with_suffix('.tmp').write_text(json.dumps([p for p in rows if p['id'] != created], ensure_ascii=False))
        path.with_suffix('.tmp').replace(path)
