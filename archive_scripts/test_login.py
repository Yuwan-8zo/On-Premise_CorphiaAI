import urllib.request
import json
import traceback

data = json.dumps({"email": "engineer@gmail.com", "password": "Engineer123"}).encode('utf-8')
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login', data=data, headers={'Content-Type': 'application/json'}, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        print("Success:", response.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Exception:", str(e))
