import urllib.request, json, time, sys  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected

base = 'http://localhost:3000'

# Login
data = json.dumps({'email': 'demo@vaultlister.com', 'password': 'DemoPassword123!'}).encode()
req = urllib.request.Request(base + '/api/auth/login', data=data,  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    auth = json.load(r)
    csrf = dict(r.headers).get('X-CSRF-Token', '')
token = auth['token']
print('Login OK, user:', auth.get('user', {}).get('email', 'unknown'))

# GET /api/csrf-token (authenticated) to get a user-scoped CSRF token
req_csrf = urllib.request.Request(base + '/api/csrf-token',  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    headers={'Authorization': 'Bearer ' + token})
with urllib.request.urlopen(req_csrf) as r:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    csrf_data = json.load(r)
csrf = csrf_data.get('csrfToken', '')
print('User-scoped CSRF obtained:', csrf[:20] + '...')

# Generate listing for Nike sneaker
payload = json.dumps({
    'brand': 'Nike',
    'category': 'Footwear',
    'condition': 'like_new',
    'color': 'White',
    'size': '10',
    'keywords': ['sneakers', 'air max', 'running', 'mens shoes'],
    'originalPrice': '130'
}).encode()

t0 = time.time()
req3 = urllib.request.Request(base + '/api/ai/generate-listing', data=payload,  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-CSRF-Token': csrf
    })
try:
    with urllib.request.urlopen(req3) as r:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        result = json.load(r)
    elapsed = time.time() - t0
    title = result.get('title', '')
    tags = result.get('tags', [])
    desc = result.get('description', '')
    src = result.get('aiSource')
    print()
    print('Elapsed: %.2fs | Source: %s' % (elapsed, src))
    print()
    print('TITLE (%d chars): %s' % (len(title), title))
    print()
    print('TAGS (%d): %s' % (len(tags), tags))
    print()
    print('DESCRIPTION:')
    print(desc[:700])
    print()
    # Assertions
    assert len(title) <= 80, 'Title exceeds 80 chars: %d' % len(title)
    assert len(title) >= 20, 'Title too short: %d' % len(title)
    assert len(tags) >= 5, 'Too few tags: %d' % len(tags)
    assert elapsed < 10, 'Too slow: %.2fs' % elapsed
    assert src == 'claude', 'Expected claude source, got: %s' % src
    print('ALL ASSERTIONS PASSED')
except urllib.error.HTTPError as e:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
    print('HTTP Error:', e.code, e.read().decode()[:400])
    sys.exit(1)
except AssertionError as e:
    print('ASSERTION FAILED:', e)
    sys.exit(1)
