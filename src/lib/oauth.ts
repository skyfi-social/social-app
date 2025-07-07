import {
  BrowserOAuthClient,
  type OAuthClientMetadataInput,
  type OAuthSession,
} from '@atproto/oauth-client-browser'

import {isWeb} from '#/platform/detection'

// Client metadata that should be served at /client-metadata.json
const getClientMetadata = (): OAuthClientMetadataInput => {
  // Check if we're running in development mode
  const isDev =
    process.env.NODE_ENV === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  if (isDev) {
    // Development configuration for AT Protocol OAuth
    // For development, we use a special client_id format with redirect_uri as query param
    const devClientMetadata: string = `http://localhost?redirect_uri=${encodeURIComponent('http://127.0.0.1:19006/oauth/callback')}&scope=${encodeURIComponent('atproto transition:generic')}`
    return {
      client_id: devClientMetadata,
      redirect_uris: [`http://127.0.0.1:19006/oauth/callback`],
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
      logo_uri: 'https://app.skyfi.social/favicon.png',
      tos_uri: 'https://app.skyfi.social/tos',
      policy_uri: 'https://app.skyfi.social/privacy-policy',
      redirect_uris: ['https://app.skyfi.social/oauth/callback'],
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
 * Initialize the OAuth client (web only)
 */
export async function initOAuthClient(): Promise<BrowserOAuthClient> {
  if (!isWeb) {
    throw new Error('OAuth client is only available on web platform')
  }

  if (!oauthClient) {
    console.log(
      '🔧 Creating OAuth client with configuration:',
      getClientMetadata(),
    )

    try {
      // Use the client metadata from our deployed URL
      oauthClient = new BrowserOAuthClient({
        clientMetadata: getClientMetadata(),
        handleResolver: 'https://bsky.social',
      })

      const result = await oauthClient.init()

      console.log('✅ OAuth client created successfully: ', result)
    } catch (error) {
      console.error('❌ Failed to create OAuth client:', error)
      throw error
    }
  } else {
    console.log('♻️ Reusing existing OAuth client instance')
  }
  return oauthClient
}

/**
 * Start OAuth login flow by redirecting to bsky.social (web only)
 */
export async function startOAuthLogin(handle?: string): Promise<void> {
  if (!isWeb) {
    throw new Error('OAuth login is only available on web platform')
  }

  try {
    console.log('🔍 Starting OAuth sign-in flow with handle:', handle)

    if (!handle) {
      console.error('❌ No handle provided')
      throw new Error('No handle provided')
    }

    const client = new BrowserOAuthClient({
      clientMetadata: getClientMetadata(),
      handleResolver: 'https://bsky.social',
    })

    console.log('🔧 OAuth client:', client)

    // Initiate OAuth flow - this will redirect to the user's PDS
    const result = await client.signIn(handle, {
      prompt: 'login',
    })

    console.log(
      '⚠️ OAuth sign-in completed (this should not be reached if redirect happened): ',
      result,
    )
  } catch (error) {
    console.error('❌ OAuth login failed - Error object:', error)
    // Pause for 30 seconds before throwing
    await new Promise(resolve => setTimeout(resolve, 30000))
    throw new Error(`Failed to start OAuth login: ${error}`)
  }
}

/**
 * Handle OAuth callback after redirect from bsky.social
 */
export async function handleOAuthCallback(): Promise<{
  oauthSession: OAuthSession
} | null> {
  try {
    console.log(`✅ OAuth callback handling started with urlQuery`)

    const client = new BrowserOAuthClient({
      clientMetadata: getClientMetadata(),
      handleResolver: 'https://bsky.social',
    })

    const result = await client.init()

    console.log('📋 OAuth callback result:', result)

    if (!result || !result.session) {
      return null
    }

    return {
      oauthSession: result.session,
    }
  } catch (error) {
    console.error('OAuth callback handling failed: ', error)

    // Pause for 30 seconds before returning null
    await new Promise(resolve => setTimeout(resolve, 30000))
    return null
  }
}
