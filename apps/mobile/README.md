# Lesfin Mobile

Expo / React Native app for Lesfin.

From the repository root:

```bash
bun install
cd apps/mobile && bun start
```

The web app intentionally remains at the repository root. Vercel should keep
its Root Directory as `.` and its existing build command (`bun run build` or
the configured equivalent). The mobile workspace is not included in that
Next.js build.
