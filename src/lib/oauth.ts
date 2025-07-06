import {Agent} from '@atproto/api'
import {
  BrowserOAuthClient,
  type OAuthClientMetadataInput,
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
    const devClientMetadata: string = `http://localhost?redirect_uri=${encodeURIComponent('http://127.0.0.1:19006/oauth/callback')}`
    return {
      client_id: devClientMetadata,
      redirect_uris: [`http://127.0.0.1:19006/oauth/callback`],
      scope: 'atproto',
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

      console.log('✅ OAuth client created successfully')
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
    console.log('🔧 Initializing OAuth client...')
    const client = await initOAuthClient()

    if (!handle) {
      console.error('❌ No handle provided')
      throw new Error('No handle provided')
    }

    console.log('🔍 Starting OAuth sign-in flow with handle:', handle)

    // Initiate OAuth flow - this will redirect to the user's PDS
    const result = await client.signIn(handle, {
      prompt: 'login',
    })

    console.log('📋 OAuth signIn result:', result)
    console.log(
      '⚠️ OAuth sign-in completed (this should not be reached if redirect happened)',
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
export async function handleOAuthCallback(
  urlQueryParams: URLSearchParams,
): Promise<{
  agent: Agent
  oauthSession: any
} | null> {
  try {
    console.log(
      `✅ OAuth callback handling started with urlQuery: `,
      urlQueryParams.toString(),
    )

    const client = new BrowserOAuthClient({
      clientMetadata: getClientMetadata(),
      handleResolver: 'https://bsky.social',
    })

    const result = await client.init()

    console.log('📋 OAuth callback result:', result)
    // pause for 1 second to ensure callback processing is complete
    await new Promise(resolve => setTimeout(resolve, 10000))

    if (!result || !result.session) {
      return null
    }

    // Create an Agent with the OAuth session
    const agent = new Agent(result.session)

    // See if this session can query its profile data.
    await agent.app.bsky.actor.getProfile({actor: result.session.sub})

    // Wait 20 seconds to see logs
    await new Promise(resolve => setTimeout(resolve, 20000))

    return {
      agent,
      oauthSession: result.session,
    }
  } catch (error) {
    console.error('OAuth callback handling failed: ', error)

    // Pause for 30 seconds before returning null
    await new Promise(resolve => setTimeout(resolve, 30000))
    return null
  }
}

/**
 * Create session account data from OAuth session
 */
export async function DONTUSEME(agent: Agent, oauthSession: any) {
  try {
    // Get session information from the OAuth agent
    const sessionInfo = await agent.com.atproto.server.getSession()
    const did = sessionInfo.data.did

    // Get profile info
    const profile = await agent.app.bsky.actor.getProfile({actor: did})

    // Extract real tokens from the OAuth session
    // The OAuthSession should contain actual JWT tokens
    const accessJwt = oauthSession.accessJwt || oauthSession.access_token
    const refreshJwt = oauthSession.refreshJwt || oauthSession.refresh_token

    console.log('🔑 OAuth session tokens:', {
      hasAccessJwt: !!accessJwt,
      hasRefreshJwt: !!refreshJwt,
      oauthSessionKeys: Object.keys(oauthSession),
    })

    // Create session account data using real tokens from OAuth session
    const account = {
      service: 'https://bsky.social',
      handle: profile.data.handle,
      did: did,
      email: sessionInfo.data.email || '',
      emailConfirmed: sessionInfo.data.emailConfirmed || false,
      emailAuthFactor: sessionInfo.data.emailAuthFactor || false,
      // Use real JWT tokens from OAuth session
      accessJwt: accessJwt,
      refreshJwt: refreshJwt,
      active: sessionInfo.data.active !== false,
      status: sessionInfo.data.status || 'active',
      signupQueued: false,
      pdsUrl: undefined,
      isSelfHosted: false,
      // Store OAuth session metadata
      _isOAuth: true,
      _oauthSessionId: oauthSession.sub || did,
    }

    return account
  } catch (error) {
    console.error('Failed to create OAuth session account:', error)
    // Pause for 10 seconds before throwing
    await new Promise(resolve => setTimeout(resolve, 30000))
    throw error
  }
}
