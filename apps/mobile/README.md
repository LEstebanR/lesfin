# Lesfin Mobile

Expo / React Native app for Lesfin.

From the repository root:

```bash
bun install
bun dev                     # web app: serves the Better Auth API on :3000
cd apps/mobile && bun start # Expo dev server
```

The web app intentionally remains at the repository root. Vercel should keep
its Root Directory as `.` and its existing build command (`bun run build` or
the configured equivalent). The mobile workspace is not included in that
Next.js build.

## Auth server URL

The app talks to the web's Better Auth API at `EXPO_PUBLIC_AUTH_URL`
(defaults to `http://localhost:3000` in dev and `https://www.lesfin.app` in
production builds). Set it in `apps/mobile/.env` or inline, and restart Expo
with `--clear` after changing it.

Google redirects to `BETTER_AUTH_URL/api/auth/callback/google` on the server,
and it only accepts `localhost` or public domains as redirect URIs, so a LAN IP
does not work:

- **iOS simulator:** `localhost` works as is.
- **Android (emulator or USB device):** `adb reverse tcp:3000 tcp:3000` and
  keep `localhost`.
- **iPhone / physical device:** expose the web with a tunnel
  (`cloudflared tunnel --url http://localhost:3000`), set both
  `BETTER_AUTH_URL` (web) and `EXPO_PUBLIC_AUTH_URL` (mobile) to the tunnel
  URL, and add `<tunnel>/api/auth/callback/google` as an authorized redirect
  URI on the Google OAuth client. New redirect URIs can take a few minutes to
  propagate, so `redirect_uri_mismatch` right after adding one is expected.

Expo Go returns to the app through `exp://`, which the server's `expo()` plugin
only trusts in development, so Expo Go cannot sign in against production. A
development or store build uses the `lesfin://` scheme instead.

## Auth flow

1. `@better-auth/expo` opens Google in the system browser through the web's
   `/api/auth`, and the callback deep-links back into the app.
2. The session cookie is stored encrypted in SecureStore and attached to every
   request, so the session survives restarts.
3. The `(app)` and `(auth)` layouts redirect based on the session. If the
   server drops the session without a sign-out, the login screen says it
   expired.
4. Sign-out clears the stored cookie and the cached session.

## Look and feel

`lib/theme.ts` mirrors the web's light tokens from `app/globals.css` (OKLCH
converted to hex) and uses Geist, the web's font. Update it when the web
palette changes.
