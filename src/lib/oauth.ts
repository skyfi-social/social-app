import {
  BrowserOAuthClient,
  type OAuthClientMetadataInput,
  type OAuthSession,
} from '@atproto/oauth-client-browser'

import {isWeb} from '#/platform/detection'

// Client metadata that should be served at /client-metadata.json (public/client-metadata.json contains production config that must match this)
const getClientMetadata = (): OAuthClientMetadataInput => {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  if (isDev) {
    // Development configuration for AT Protocol OAuth
    // For development, we use a special client_id format with cfg as query params

    // Add 'transition:chat.bsky' scope for access to chats.
    // Add 'transition:email' scope for email verification.
    // To encourage more people to try Skyfi in the early days we
    // won't ask for this access. Maybe after we build some brand trust.
    const devClientMetadata: string = `http://localhost?redirect_uri=${encodeURIComponent('http://127.0.0.1:19006')}&scope=${encodeURIComponent('atproto transition:generic')}`
    return {
      client_id: devClientMetadata,
      redirect_uris: [`http://127.0.0.1:19006`],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
    }
  } else {
    // Production configuration with HTTPS URLs
    return {
      client_id: 'https://app.skyfi.social/client-metadata.json',
      client_name: 'Skyfi',
      client_uri: 'https://app.skyfi.social',
      redirect_uris: ['https://app.skyfi.social'],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
    }
  }
}

let oauthClient: BrowserOAuthClient | null = null

/**
 * Get OAuth client creates on first call(web only)
 */
export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (!isWeb) {
    throw new Error('OAuth client is only available on web platform')
  }

  if (!oauthClient) {
    try {
      oauthClient = new BrowserOAuthClient({
        clientMetadata: getClientMetadata(),
        handleResolver: 'https://bsky.social',
      })
    } catch (error) {
      console.error('❌ Failed to create OAuth client:', error)
      throw error
    }
  }
  return oauthClient
}

/**
 * Start OAuth login flow using popup (web only)
 */
export async function startOAuthLogin(
  handle: string,
): Promise<OAuthSession | null> {
  console.log('🔧 Production OAuth config:', getClientMetadata())

  const client = await getOAuthClient()

  // The @atproto/oauth-client-browser signInPopup method is popping up the window and not closing it if
  // the the handle is not valid. So we need to pre-validate the handle. Remove this when the library is fixed.
  try {
    const response = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    )
    if (!response.ok) {
      throw new Error(
        'Invalid handle. Please check your username and try again.',
      )
    }
    const result = await response.json()
    if (!result.did) {
      throw new Error(
        'Invalid handle. Please check your username and try again.',
      )
    }
  } catch (validationError) {
    console.log(
      '❌ Handle validation failed:',
      (validationError as Error).message,
    )
    throw validationError
  }

  try {
    const result = await client.signIn(handle, {
      prompt: 'login',
    })
    return result
  } catch (error) {
    console.error('❌ signIn failed:', error)
    throw error
  }
}
