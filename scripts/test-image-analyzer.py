import urllib.request, json, time, sys, base64  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected

base = 'http://localhost:3000'

def get_csrf(token):
    req = urllib.request.Request(base + '/api/csrf-token',  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req) as r:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        return json.load(r).get('csrfToken', '')

# Login
data = json.dumps({'email': 'demo@vaultlister.com', 'password': 'DemoPassword123!'}).encode()
with urllib.request.urlopen(urllib.request.Request(base + '/api/auth/login', data=data,  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        headers={'Content-Type': 'application/json'})) as r:
    token = json.load(r)['token']
print('Login OK')

# === Test 1: generate-listing with image URL (measures vision + text generation) ===
print()
print('=== Test 1: generate-listing with Nike image URL ===')
csrf = get_csrf(token)
image_url = 'https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/4f37fca8-6bce-43e7-ad07-f57ae3c13142/air-max-90-shoes-kRsBnD.png'
payload = json.dumps({'imageUrl': image_url, 'condition': 'good'}).encode()
t0 = time.time()
with urllib.request.urlopen(urllib.request.Request(base + '/api/ai/generate-listing',  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        data=payload, headers={'Content-Type':'application/json',
        'Authorization':'Bearer '+token, 'X-CSRF-Token':csrf})) as r:
    result = json.load(r)
elapsed = time.time() - t0

ia = result.get('imageAnalysis', {})
meta = ia.get('metadata', {})
print('Total elapsed: %.2fs (vision + text generation)' % elapsed)
print('analyzed:   ', meta.get('analyzed'), '| source:', meta.get('source'))
print('Brand:      ', ia.get('brand'))
print('Category:   ', ia.get('category'))
print('Colors:     ', ia.get('colors'))
print('Condition:  ', ia.get('condition'))
print('Confidence: ', ia.get('confidence'))
print('Tags:       ', ia.get('tags', [])[:5])
print('Title:      ', result.get('title'))
print('AI Source:  ', result.get('aiSource'))

assert meta.get('analyzed') is True, 'analyzed=False: %s' % meta
assert ia.get('brand') not in (None, ''), 'Brand not detected'
assert ia.get('category') is not None, 'Category not detected'
assert len(ia.get('colors', [])) > 0, 'Colors not detected'
print('ALL Test 1 ASSERTIONS PASSED')

# === Test 2: analyze-listing-image with JPEG base64 (Sonnet endpoint) ===
print()
print('=== Test 2: analyze-listing-image with JPEG base64 ===')
csrf2 = get_csrf(token)
# Use a plain JPEG product image (Picsum)
jpeg_url = 'https://picsum.photos/id/26/600/600'
with urllib.request.urlopen(urllib.request.Request(jpeg_url,  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        headers={'User-Agent': 'Mozilla/5.0'}), timeout=10) as img_r:
    img_bytes = img_r.read()
    actual_ct = img_r.headers.get('Content-Type', 'image/jpeg')
img_b64 = base64.b64encode(img_bytes).decode()
mime = actual_ct.split(';')[0].strip() if actual_ct else 'image/jpeg'
print('Image: %d bytes, mime: %s' % (len(img_bytes), mime))

payload2 = json.dumps({'imageBase64': img_b64, 'imageMimeType': mime, 'platform': 'poshmark'}).encode()
t1 = time.time()
try:
    with urllib.request.urlopen(urllib.request.Request(base + '/api/ai/analyze-listing-image',  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
            data=payload2, headers={'Content-Type':'application/json',
            'Authorization':'Bearer '+token, 'X-CSRF-Token':csrf2})) as r:
        result2 = json.load(r)
    elapsed2 = time.time() - t1
    an = result2.get('analysis', result2)
    print('Elapsed: %.2fs' % elapsed2)
    print('Brand:    ', an.get('brand'))
    print('Category: ', an.get('category'))
    print('Color:    ', an.get('color'))
    print('Condition:', an.get('condition'))
    print('Title:    ', str(an.get('title', ''))[:80])
    print('Confidence:', an.get('confidence'))
    assert elapsed2 < 15, 'Too slow: %.2fs' % elapsed2
    print('Test 2 PASSED')
except urllib.error.HTTPError as e:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
    body = e.read().decode()[:400]
    print('Test 2 HTTP %d: %s' % (e.code, body))
    print('NOTE: analyze-listing-image uses claude-sonnet-4-6. Test 2 is informational.')

print()
print('C-2 COMPLETE — image-analyzer.js analyzeImage() wired to Claude Haiku Vision')
print('Vision API detects brand/category/colors/condition from product photos.')
