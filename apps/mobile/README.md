# Lesfin Mobile

Expo / React Native app for Lesfin.

The web app intentionally remains at the repository root. Vercel should keep
its Root Directory as `.` and its existing build command (`bun run build` or
the configured equivalent). The mobile workspace is not included in that
Next.js build.

## Running the app

The app signs in through the web's Better Auth API, so the web app must be
running too. It reads the server URL from `EXPO_PUBLIC_AUTH_URL` (defaults to
`http://localhost:3000` in dev and `https://www.lesfin.app` in production
builds).

Requirements: `bun install` at the repo root, a root `.env` with the web's
variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, …), and Expo Go on the phone (it must match the
project's Expo SDK, currently 58).

### Why a physical device needs a tunnel

Google redirects to `BETTER_AUTH_URL/api/auth/callback/google` and only
accepts `localhost` or public domains as redirect URIs, so your Mac's LAN IP
does not work, and `localhost` on the phone is the phone itself.

- **iOS simulator:** `localhost` works as is; skip the tunnel.
- **Android (emulator or USB device):** run `adb reverse tcp:3000 tcp:3000`
  and keep `localhost`; skip the tunnel.
- **iPhone or other physical device:** use the tunnel below.

Expo Go also can't sign in against production: it returns to the app through
`exp://`, which the server's `expo()` plugin only trusts in development. A
development or store build uses the `lesfin://` scheme instead.

### On an iPhone with Expo Go (tunnel)

Use three terminals, all from the repo root, and keep the phone on the same
Wi‑Fi as the Mac.

1. **Tunnel** (install once with `brew install cloudflared`):

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

   Copy the `https://<random>.trycloudflare.com` URL it prints and export it
   in the other two terminals: `export TUNNEL=https://<random>.trycloudflare.com`.

2. **Google redirect URI:** in Google Cloud Console → APIs & Services →
   Credentials → the web OAuth client, add
   `$TUNNEL/api/auth/callback/google` to _Authorized redirect URIs_. New URIs
   can take a few minutes to propagate; a `redirect_uri_mismatch` right after
   adding one usually clears up on its own.

3. **Web app** pointing Better Auth at the tunnel:

   ```bash
   BETTER_AUTH_URL=$TUNNEL bun dev
   ```

   Make sure nothing else (e.g. another checkout's `bun dev`) is already on
   port 3000, or Next moves to 3001 and the tunnel won't reach it.

4. **Expo** pointing the app at the tunnel:

   ```bash
   cd apps/mobile && EXPO_PUBLIC_AUTH_URL=$TUNNEL bunx expo start --clear
   ```

   `--clear` is required: `EXPO_PUBLIC_*` values are inlined at bundle time.

5. **Open the app:** in Expo Go pick the project under recent projects /
   development servers, or open `exp://<mac-lan-ip>:8081` in Safari. The
   first load rebuilds the bundle and takes about a minute.

**Every time the tunnel restarts, its URL changes.** Then: add the new
redirect URI in Google (step 2), restart `bun dev` and Expo with the new URL
(steps 3–4), and fully close Expo Go (swipe it away from the app switcher)
before reopening the project — a reload keeps the old URL. Symptoms of a stale
URL: "No se pudo iniciar sesión" or "No se pudo conectar con el servidor".

When you're done, remove the tunnel's redirect URI from the Google OAuth
client.

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
