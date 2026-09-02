This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This project uses [Bun](https://bun.sh) as its package manager and runtime — install dependencies with `bun install`, not `npm`/`yarn`/`pnpm`.

First, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Polar billing

Configure one recurring Pro product in Polar Sandbox for local development and another in Polar Production for the deployed app. Use the matching product ID and access token in each environment.

Local `.env`:

```text
POLAR_ACCESS_TOKEN=polar_sandbox_oat_...
POLAR_PRO_PRODUCT_ID=<sandbox-product-id>
POLAR_WEBHOOK_SECRET=<sandbox-webhook-secret>
```

Vercel Production:

```text
POLAR_ACCESS_TOKEN=polar_oat_...
POLAR_PRO_PRODUCT_ID=<production-product-id>
POLAR_WEBHOOK_SECRET=<production-webhook-secret>
```

For local webhooks, run `polar listen http://localhost:3000` and use the generated Sandbox secret; Polar will forward events to `/api/webhooks/polar`. For production, register `https://lesfin.app/api/webhooks/polar` in Polar Production. Subscribe the endpoint to the subscription lifecycle events handled by the route and use the raw delivery format. Local code always selects Sandbox; only a production build selects Production. The migration is applied by the normal `bun run build` command.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
