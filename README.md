# Lesfin

Aplicación de finanzas personales con una aplicación web en Next.js y una aplicación mobile en Expo / React Native.

## Requisitos

- [Bun](https://bun.sh/)
- Node.js compatible con las versiones usadas por Expo y Next.js
- Para mobile: [Expo Go](https://expo.dev/go) o un emulador de Android / simulador de iOS
- Para compilar iOS localmente: macOS y Xcode
- Para compilar Android localmente: Android Studio y un Android SDK configurado

## Instalación

Instala todas las dependencias desde la raíz del repositorio:

```bash
bun install
```

El repositorio usa Bun como único gestor de paquetes. No uses `npm`, `yarn` ni `pnpm`.

## Aplicación web

Arranca el servidor de desarrollo desde la raíz:

```bash
bun dev
```

Abre [http://localhost:3000](http://localhost:3000).

Comandos útiles:

```bash
bun run lint
bun run build
bun run start
```

La aplicación web vive en la raíz del repositorio. Usa Next.js, React, Prisma, Neon y Better Auth.

## Aplicación mobile

La aplicación mobile está en `apps/mobile` y usa Expo Router.

Desde la raíz del repositorio, inicia Expo con:

```bash
bun --cwd apps/mobile start
```

También puedes entrar al workspace y ejecutar los comandos directamente:

```bash
cd apps/mobile
bun start
```

Comandos específicos:

```bash
bun --cwd apps/mobile android  # Emulador o dispositivo Android
bun --cwd apps/mobile ios      # Simulador o dispositivo iOS
bun --cwd apps/mobile web      # Expo Web
bun --cwd apps/mobile typecheck
```

Al iniciar Expo aparecerá un código QR. Puedes abrirlo con Expo Go en un dispositivo conectado a la misma red. También puedes usar las teclas interactivas que muestra Expo para abrir Android, iOS o la versión web.

El código mobile principal está en `apps/mobile/app`. Actualmente algunas vistas todavía utilizan datos mockeados.

## Variables de entorno

La aplicación web necesita las variables de entorno definidas para Prisma, Better Auth, Google OAuth y, cuando se pruebe billing, Polar. Consulta la configuración del entorno antes de iniciar funcionalidades que dependan de estos servicios.

### Polar billing

Configura un producto Pro recurrente en Polar Sandbox para desarrollo local y otro en Polar Production. Usa las variables correspondientes en cada entorno.

`.env` local:

```text
POLAR_ACCESS_TOKEN=polar_sandbox_oat_...
POLAR_PRO_PRODUCT_ID=<sandbox-product-id>
POLAR_WEBHOOK_SECRET=<sandbox-webhook-secret>
```

Para probar webhooks localmente:

```bash
polar listen http://localhost:3000
```

El webhook se recibe en `/api/webhooks/polar`.

## Estructura principal

```text
app/          Aplicación web Next.js y Server Actions
components/   Componentes de la aplicación web
lib/          Prisma, autenticación, consultas y utilidades compartidas
prisma/       Esquema y migraciones de base de datos
apps/mobile/  Aplicación Expo / React Native
```

## Deploy web en Vercel

La aplicación web se despliega en [Vercel](https://vercel.com/) con el directorio raíz del repositorio (`.`) y el comando de build:

```bash
bun run build
```

La aplicación mobile no forma parte del build de Next.js.
