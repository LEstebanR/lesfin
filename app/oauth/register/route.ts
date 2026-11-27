import { isValidRedirectUri } from '@/lib/oauth-redirect'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

const MAX_REDIRECT_URIS = 10
const MAX_CLIENT_NAME_LENGTH = 200

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  const redirectUris = body?.redirect_uris
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > MAX_REDIRECT_URIS ||
    !redirectUris.every(isValidRedirectUri)
  ) {
    return NextResponse.json(
      {
        error: 'invalid_client_metadata',
        error_description:
          'redirect_uris must be a non-empty array of https (or http loopback) URLs (max 10)',
      },
      { status: 400, headers: corsHeaders }
    )
  }

  const name =
    typeof body?.client_name === 'string' && body.client_name.trim()
      ? body.client_name.trim().slice(0, MAX_CLIENT_NAME_LENGTH)
      : 'Unnamed client'

  const client = await prisma.oAuthClient.create({
    data: { name, redirectUris },
  })

  return NextResponse.json(
    {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    { status: 201, headers: corsHeaders }
  )
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
