import {Agent} from '@atproto/api'
import {
  BrowserOAuthClient,
  type OAuthClientMetadataInput,
} from '@atproto/oauth-client-browser'

import {isWeb} from '#/platform/detection'

// Client metadata that should be served at /client-metadata.json
const getClientMetadata = (): OAuthClientMetadataInput => {
  // Always use production HTTPS URLs, even for local development
  // AT Protocol OAuth requires HTTPS for all URLs
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
    throw new Error(`Failed to start OAuth login: ${error}`)
  }
}

/**
 * Handle OAuth callback after redirect from bsky.social
 */
export async function handleOAuthCallback(): Promise<{
  agent: Agent
  oauthSession: any
} | null> {
  try {
    const client = await initOAuthClient()

    // Handle OAuth callback
    const result = await client.signInCallback()
    if (!result || !result.session) {
      return null
    }

    // Create an Agent with the OAuth session
    const agent = new Agent(result.session)

    return {
      agent,
      oauthSession: result.session,
    }
  } catch (error) {
    console.error('OAuth callback handling failed:', error)
    return null
  }
}

/**
 * Check if we're currently in an OAuth callback
 */
export function isOAuthCallback(): boolean {
  if (!isWeb) return false

  return (
    window.location.pathname === '/oauth/callback' ||
    window.location.search.includes('code=') ||
    window.location.search.includes('state=')
  )
}

/**
 * Get the current OAuth session if available
 */
export async function getCurrentOAuthSession(): Promise<{
  agent: Agent
  oauthSession: any
} | null> {
  try {
    const client = await initOAuthClient()
    const result = await client.init()

    if (!result || !result.session) {
      return null
    }

    // Create agent with session
    const agent = new Agent(result.session)

    return {
      agent,
      oauthSession: result.session,
    }
  } catch (error) {
    console.error('Failed to get OAuth session:', error)
    return null
  }
}

/**
 * Create session account data from OAuth session
 */
export async function createOAuthSessionAccount(
  agent: Agent,
  oauthSession: any,
) {
  try {
    // Get session information from the OAuth agent
    const sessionInfo = await agent.com.atproto.server.getSession()
    const did = sessionInfo.data.did

    // Get profile info
    const profile = await agent.app.bsky.actor.getProfile({actor: did})

    // Create session account data that marks this as an OAuth session
    const account = {
      service: 'https://bsky.social',
      handle: profile.data.handle,
      did: did,
      email: sessionInfo.data.email || '',
      emailConfirmed: sessionInfo.data.emailConfirmed || false,
      emailAuthFactor: sessionInfo.data.emailAuthFactor || false,
      // Mark this as an OAuth session with special tokens
      accessJwt: `oauth:${did}:access`,
      refreshJwt: `oauth:${did}:refresh`,
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
    throw error
  }
}
