import {Agent} from '@atproto/api'
import {BrowserOAuthClient} from '@atproto/oauth-client-browser'

import {isWeb} from '#/platform/detection'

// OAuth client configuration for bsky.social
const getOAuthClientId = () => {
  if (!isWeb) return ''
  // For development, we need to handle the HTTPS requirement
  // AT Protocol OAuth requires HTTPS for security
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    // For local development, we'll use a production-like URL for now
    // In a real deployment, this would be your actual domain
    return 'https://bsky.app/client-metadata.json'
  }
  // For GitHub Pages and other HTTPS deployments, use the actual origin
  return `${window.location.origin}${window.location.pathname !== '/' ? window.location.pathname : ''}/client-metadata.json`
}

const getOAuthRedirectUri = () => {
  if (!isWeb) return ''
  // For local development testing, we'll need to use a production callback
  // or set up local HTTPS. For now, let's use a dummy callback
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return 'https://bsky.app/oauth/callback'
  }
  // For GitHub Pages and other HTTPS deployments, use the actual origin
  return `${window.location.origin}${window.location.pathname !== '/' ? window.location.pathname : ''}/oauth/callback`
}

const OAUTH_SCOPE = 'atproto'

export interface OAuthConfig {
  clientId: string
  redirectUri: string
  scope: string
}

// Client metadata that should be served at /client-metadata.json
export const getClientMetadata = () => ({
  client_id: getOAuthClientId(),
  client_name: 'Skyfi',
  redirect_uris: [getOAuthRedirectUri()],
  scope: OAUTH_SCOPE,
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'web',
  dpop_bound_access_tokens: true,
})

let oauthClient: BrowserOAuthClient | null = null

/**
 * Initialize the OAuth client (web only)
 */
export async function initOAuthClient(): Promise<BrowserOAuthClient> {
  if (!isWeb) {
    throw new Error('OAuth client is only available on web platform')
  }

  if (!oauthClient) {
    const clientId = getOAuthClientId()
    const redirectUri = getOAuthRedirectUri()

    console.log('Creating OAuth client with inline metadata:', {
      clientId,
      redirectUri,
      scope: OAUTH_SCOPE,
    })

    try {
      // Use inline metadata instead of loading from URL for dev server
      oauthClient = new BrowserOAuthClient({
        clientMetadata: {
          client_id: clientId,
          client_name: 'Skyfi',
          redirect_uris: [redirectUri],
          scope: OAUTH_SCOPE,
          grant_types: ['authorization_code'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
          application_type: 'web',
          dpop_bound_access_tokens: true,
        },
        handleResolver: 'https://bsky.social',
      })

      console.log('OAuth client created successfully')
    } catch (error) {
      console.error('Failed to create OAuth client:', error)
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

  console.log('Initializing OAuth client...')

  try {
    const client = await initOAuthClient()
    console.log('OAuth client initialized successfully')

    // If no handle provided, prompt user for their handle
    const userHandle =
      handle || prompt('Enter your Bluesky handle (e.g., alice.bsky.social):')

    if (!userHandle) {
      throw new Error('No handle provided')
    }

    console.log('Starting OAuth sign-in flow with handle:', userHandle)
    // Initiate OAuth flow - this will redirect to the user's PDS
    await client.signIn(userHandle, {
      scope: OAUTH_SCOPE,
    })
    console.log(
      'OAuth sign-in completed (this should not be reached if redirect happened)',
    )
  } catch (error) {
    console.error('OAuth login failed:', error)
    throw new Error(`Failed to start OAuth login: ${error}`)
  }
}

/**
 * Handle OAuth callback after redirect from bsky.social
 */
export async function handleOAuthCallback(): Promise<Agent | null> {
  try {
    const client = await initOAuthClient()

    // Handle OAuth callback
    const result = await client.signInCallback()
    if (!result || !result.session) {
      return null
    }

    // Create an Agent with the OAuth session
    const agent = new Agent(result.session)

    return agent
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
export async function getCurrentOAuthSession(): Promise<Agent | null> {
  try {
    const client = await initOAuthClient()
    const result = await client.init()

    if (!result || !result.session) {
      return null
    }

    // Create agent with session
    const agent = new Agent(result.session)

    return agent
  } catch (error) {
    console.error('Failed to get OAuth session:', error)
    return null
  }
}
