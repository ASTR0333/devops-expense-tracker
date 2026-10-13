"""Integration check of the running stack. Only removes its own temporary row."""
import datetime
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080').rstrip('/')

def request(path, method='GET', data=None, expected=200):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            status, body = res.status, res.read()
    except urllib.error.HTTPError as exc:
        status, body = exc.code, exc.read()
    assert status == expected, (method, path, status, body)
    return json.loads(body) if body else None

assert request('/api/health')['status'] == 'ok'
assert isinstance(request('/api/items'), list)
assert request('/api/budget')['amount'] > 0
with urllib.request.urlopen(BASE, timeout=10) as res:
    assert b'<div id="root">' in res.read()

payload = {'name': 'smoke-' + uuid.uuid4().hex[:8], 'amount': 12345,
           'kind': 'expense', 'category': 'Кафе', 'date': datetime.date.today().isoformat()}
item = request('/api/items', 'POST', payload, 201)
try:
    assert item['amount'] == 12345
    assert any(i['id'] == item['id'] for i in request('/api/items'))
    payload['amount'] = 67890
    updated = request(f"/api/items/{item['id']}", 'PUT', payload)
    assert updated['amount'] == 67890
    assert next(i for i in request('/api/items') if i['id'] == item['id'])['amount'] == 67890
    for change in [{'amount': -1}, {'amount': 1.5}, {'date': '2026-02-30'}, {'name': ' '}, {'category': 'missing'}]:
        request('/api/items', 'POST', {**payload, **change}, 400)
    request('/api/unknown', expected=404)
    request('/api/items/999999999', 'PUT', payload, 404)
finally:
    request(f"/api/items/{item['id']}", 'DELETE', expected=204)
assert not any(i['id'] == item['id'] for i in request('/api/items'))
request(f"/api/items/{item['id']}", 'DELETE', expected=404)
print('PASS: page, DB health, list, create, update, delete, validation, 404, budget')
