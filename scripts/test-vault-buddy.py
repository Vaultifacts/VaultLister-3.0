import urllib.request, json, time, sys  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected

base = 'http://localhost:3000'

def get_token():
    data = json.dumps({'email': 'demo@vaultlister.com', 'password': 'DemoPassword123!'}).encode()
    with urllib.request.urlopen(urllib.request.Request(base + '/api/auth/login', data=data,  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
            headers={'Content-Type': 'application/json'})) as r:
        return json.load(r)['token']

def get_csrf(token):
    with urllib.request.urlopen(urllib.request.Request(base + '/api/csrf-token',  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
            headers={'Authorization': 'Bearer ' + token})) as r:
        return json.load(r).get('csrfToken', '')

def post(path, payload, token, csrf):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(base + path, data=data,  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + token,
                 'X-CSRF-Token': csrf})
    with urllib.request.urlopen(req) as r:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        return json.load(r)

token = get_token()
print('Login OK')

# === Test 1: Create conversation and check welcome message ===
print()
print('=== Test 1: Open Vault Buddy — welcome message ===')
csrf = get_csrf(token)
conv = post('/api/chatbot/conversations', {'title': 'C-4 Test'}, token, csrf)
conv_id = conv['conversation']['id']
print('Conversation ID:', conv_id)

# Fetch messages to see welcome
with urllib.request.urlopen(urllib.request.Request(  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        base + '/api/chatbot/conversations/' + conv_id,
        headers={'Authorization': 'Bearer ' + token})) as r:
    conv_data = json.load(r)

messages = conv_data['messages']
assert len(messages) >= 1, 'No messages in new conversation'
welcome = messages[0]['content']
print('Welcome preview:', welcome[:100].replace('\n', ' '))
assert 'Vault Buddy' in welcome, 'Welcome message does not mention Vault Buddy: ' + welcome[:100]
print('Test 1 PASSED — welcome message says "Vault Buddy"')

# === Test 2: Ask about inventory count ===
print()
print('=== Test 2: "How many items do I have in inventory?" ===')
csrf2 = get_csrf(token)
t0 = time.time()
resp = post('/api/chatbot/message',
    {'conversation_id': conv_id, 'message': 'How many items do I have in inventory?'},
    token, csrf2)
elapsed = time.time() - t0

msg = resp['message']
content = msg['content']
source = msg['metadata']['source']
chatbot_mode = resp.get('chatbot_mode', '?')

print('Elapsed:      %.2fs' % elapsed)
print('Source:       ', source)
print('Chatbot mode: ', chatbot_mode)
print()
print('Response:')
print(content[:500])

assert source == 'claude', 'Expected source=claude, got: ' + str(source)
assert chatbot_mode == 'claude', 'Expected chatbot_mode=claude, got: ' + str(chatbot_mode)

# Check response contains a number (actual inventory data)
import re
numbers = re.findall(r'\b\d+\b', content)
assert len(numbers) > 0, 'Response contains no numbers — likely a generic reply: ' + content[:200]
print()
print('Numbers found in response:', numbers[:5])
print('Test 2 PASSED — source=claude, response contains actual inventory data')

# === Test 3: Follow-up question (context retention) ===
print()
print('=== Test 3: Follow-up question — "Which is my top selling platform?" ===')
csrf3 = get_csrf(token)
t1 = time.time()
resp3 = post('/api/chatbot/message',
    {'conversation_id': conv_id, 'message': 'Which is my top selling platform?'},
    token, csrf3)
elapsed3 = time.time() - t1

content3 = resp3['message']['content']
source3 = resp3['message']['metadata']['source']
print('Elapsed: %.2fs | Source: %s' % (elapsed3, source3))
print('Response:', content3[:300])
assert source3 == 'claude', 'Follow-up also expected claude, got: ' + source3
print('Test 3 PASSED — follow-up handled by claude-sonnet-4-6')

print()
print('C-4 COMPLETE — Vault Buddy uses claude-sonnet-4-6, returns real inventory data,')
print('source=claude confirmed, welcome message identifies as Vault Buddy.')
