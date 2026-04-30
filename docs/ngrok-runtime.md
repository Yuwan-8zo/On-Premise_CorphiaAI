# Ngrok Runtime URL

Corphia uses the local ngrok Agent API to discover the current public tunnel URL.

When `python start.py` or `python ngrok_reset.py` finds an active ngrok tunnel, it writes:

- `.runtime/ngrok.json`
- `.runtime/ngrok.env`
- `frontend/.env.local`

These files are local runtime files and should not be committed.

## Runtime Variables

```env
NGROK_ACTIVE=true
NGROK_PUBLIC_URL=https://your-current-url.ngrok-free.dev
NGROK_API_URL=https://your-current-url.ngrok-free.dev/api/v1/
NGROK_WS_URL=wss://your-current-url.ngrok-free.dev/ws/
VITE_PUBLIC_BASE_URL=https://your-current-url.ngrok-free.dev
VITE_API_BASE_URL=/api/v1
VITE_WS_URL=/ws
```

The frontend intentionally keeps API and WebSocket paths relative. That lets the same app work through localhost, LAN, and ngrok without manually editing URLs.

## Refreshing

Run:

```powershell
python ngrok_reset.py
```

or start the whole platform:

```powershell
python start.py
```

`start.py` also runs a lightweight watcher while the app is open. If ngrok changes the tunnel URL, the runtime files are updated automatically.
