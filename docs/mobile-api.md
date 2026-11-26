# Mobile API (`/api/v1`)

Authenticated REST API for the Expo app (`apps/mobile`). It wraps the same
domain functions the web Server Actions and the MCP server use
(`app/dashboard/*/actions.ts` → `*ForUser(userId, …)`), so business rules
(plan limits, balance updates in `prisma.$transaction`, the blocked "Deuda"
category, debt-payment mirrors) live in one place.

Types for every request/response body: [`lib/api/contracts.ts`](../lib/api/contracts.ts)
(import-free, so the app imports it with `import type`).
`lib/api/contracts.check.ts` breaks `bun run typecheck` if a domain function's
output drifts from those types.

## Authentication

The API uses the **same better-auth session as the web**. The Expo client
(`@better-auth/expo`) keeps the session cookie in SecureStore; send it on
every request:

```ts
const res = await fetch(`${baseURL}/api/v1/overview`, {
  headers: { Cookie: authClient.getCookie() },
})
```

The server resolves it with `auth.api.getSession({ headers })` and uses that
session's `userId` for everything — ids in the URL or body are always checked
against it. A record that belongs to another user responds exactly like one
that doesn't exist (404).

Mutations (`POST`/`PATCH`) require `Content-Type: application/json`.

## Errors

Every non-2xx response has the same body:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "details": { "amount": ["Number must be greater than 0"] }
  }
}
```

| Status | `code`                   | When                                                                                       |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`       | Bad body/query, malformed JSON. `details` maps field path → messages.                      |
| 401    | `UNAUTHENTICATED`        | No/expired session. The app should send the user to login.                                 |
| 404    | `NOT_FOUND`              | The id doesn't exist or isn't yours.                                                       |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | Mutation without `Content-Type: application/json`.                                         |
| 422    | `BUSINESS_RULE`          | A domain rule refused it (Free plan limit, "Deuda" category, …). `message` is user-facing. |
| 500    | `INTERNAL`               | Anything else. Generic message; details are only in server logs.                           |

## Conventions

- Dates are ISO 8601 strings. Inputs accept `YYYY-MM-DD` or a full datetime.
- Amounts are numbers (never strings / Decimal).
- `PATCH` is partial: omitted fields keep their value; unknown fields → 400.
- `DELETE` returns `204` with no body. `POST` returns `201` with the created record.

## Endpoints

| Method | Path                       | Body / query                               | Response                                                   |
| ------ | -------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| GET    | `/api/v1/overview`         | —                                          | `OverviewDto`                                              |
| GET    | `/api/v1/accounts`         | —                                          | `AccountDto[]` (includes archived; filter on `isArchived`) |
| POST   | `/api/v1/accounts`         | `CreateAccountBody`                        | `AccountDto`                                               |
| PATCH  | `/api/v1/accounts/:id`     | `UpdateAccountBody`                        | `AccountDto`                                               |
| GET    | `/api/v1/categories`       | `?type=income\|expense`                    | `CategoryDto[]`                                            |
| GET    | `/api/v1/transactions`     | `?year&month&accountId` (month needs year) | `TransactionListItemDto[]`                                 |
| POST   | `/api/v1/transactions`     | `CreateTransactionBody`                    | `TransactionDto`                                           |
| PATCH  | `/api/v1/transactions/:id` | `UpdateTransactionBody`                    | `TransactionDto`                                           |
| DELETE | `/api/v1/transactions/:id` | —                                          | `204`                                                      |
| GET    | `/api/v1/transfers`        | `?year&month`                              | `TransferDto[]`                                            |
| POST   | `/api/v1/transfers`        | `CreateTransferBody`                       | `TransferDto`                                              |
| PATCH  | `/api/v1/transfers/:id`    | `UpdateTransferBody`                       | `TransferDto`                                              |
| DELETE | `/api/v1/transfers/:id`    | —                                          | `204`                                                      |

Transactions mirroring a debt payment can't be edited/deleted here (422);
change them from the debt.

## Adding an endpoint

1. Put the logic in a `*ForUser(userId, …)` function in the feature's
   `actions.ts` (the web action calls it too).
2. Add a route under `app/api/v1/` wrapped in `withApiUser` from
   `lib/api/http.ts`; parse the body with a schema in `lib/api/schemas.ts`.
3. Add the DTO/body types to `contracts.ts`, a check in `contracts.check.ts`,
   and a row above.
