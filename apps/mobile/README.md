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
# Optional: Override auth URL (defaults to localhost:3000 in dev)
EXPO_PUBLIC_AUTH_URL=http://localhost:3000
```

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

1. User opens the app and sees the login screen
2. User taps "Continue with Google"
3. OAuth flow is handled by Better Auth
4. On successful login, session token is stored securely
5. User is redirected to the main app
6. Session persists across app restarts

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
│   ├── _layout.tsx       # Root layout with AuthProvider
│   └── index.tsx         # Entry point redirect
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

- The mobile app connects to the same Better Auth instance as the web app
- Google OAuth credentials must be configured in the web app's environment variables
- Session tokens are stored encrypted on the device
- Protected routes automatically redirect unauthenticated users to login
