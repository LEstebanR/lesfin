# Lesfin Mobile

Mobile application for Lesfin personal finance manager built with Expo and React Native.

## Features

- **Google Authentication**: Secure login using Better Auth with Google OAuth
- **Persistent Sessions**: Sessions are stored securely using Expo Secure Store
- **Protected Routes**: Automatic redirection based on authentication state
- **Cross-platform**: Works on iOS and Android

## Getting Started

### Prerequisites

- Node.js 18+
- Bun (package manager)
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies from the root
bun install

# Navigate to mobile app
cd apps/mobile
```

### Environment Variables

Create a `.env` file in `apps/mobile`:

```env
# Optional: Override auth URL (defaults to http://localhost:3000 in dev,
# https://www.lesfin.app in production builds)
EXPO_PUBLIC_AUTH_URL=http://localhost:3000
```

`localhost` only works on the iOS simulator. On the Android emulator use
`http://10.0.2.2:3000`, and on a physical device use your machine's LAN IP
(e.g. `http://192.168.1.10:3000`).

### Running the App

```bash
# Start the Expo development server
bun start

# Run on iOS simulator
bun ios

# Run on Android emulator
bun android
```

### Development with Web Backend

For authentication to work, you need to have the web app running:

```bash
# In the root directory
bun dev
```

This starts the Next.js web app on `http://localhost:3000`, which provides the Better Auth API endpoints that the mobile app connects to.

## Authentication Flow

1. User opens the app; while the stored session is validated a loading screen is shown
2. Without a session, the `(app)` layout redirects to `/login`
3. User taps "Continuar con Google": `@better-auth/expo` opens the Google flow in the system browser (via the web app's `/api/auth`)
4. Google redirects back to the web callback, which deep-links into the app (`lesfin://`); the session cookie is stored encrypted in SecureStore
5. The `(auth)` layout sees the session and redirects to the main app
6. On restart the cookie is read from SecureStore, so the user stays signed in
7. If the server rejects the session (expired/revoked), the user is sent back to login with an explanatory message
8. Logout calls `signOut()`, which clears the stored cookie and session cache

## Project Structure

```
apps/mobile/
├── app/
│   ├── (auth)/           # Authentication screens
│   │   ├── login.tsx     # Login screen
│   │   └── _layout.tsx
│   ├── (app)/            # Authenticated app screens
│   │   ├── index.tsx     # Main app (home, transactions, etc.)
│   │   └── _layout.tsx
│   └── _layout.tsx       # Root layout with AuthProvider
├── components/
│   └── loading-screen.tsx
├── lib/
│   ├── auth-client.ts    # Better Auth client configuration
│   └── auth-context.tsx  # Auth context provider
├── app.json              # Expo configuration
└── package.json
```

## Key Technologies

- **Expo** - React Native framework
- **Expo Router** - File-based routing
- **Better Auth** - Authentication library
- **Expo Secure Store** - Encrypted storage for tokens
- **Expo Web Browser** - OAuth flow handling

## Notes

- The mobile app connects to the same Better Auth instance as the web app; the server registers the `expo()` plugin and trusts the `lesfin://` scheme (`exp://` is trusted automatically in development for Expo Go)
- No extra Google OAuth client is needed: the redirect URI is still the web's `/api/auth/callback/google`
- Google OAuth credentials must be configured in the web app's environment variables
- Session tokens are stored encrypted on the device
- Protected routes automatically redirect unauthenticated users to login
