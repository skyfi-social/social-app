import {
  BrowserOAuthClient,
  type OAuthClientMetadataInput,
  type OAuthSession,
} from '@atproto/oauth-client-browser'

import {isWeb} from '#/platform/detection'

// Client metadata that should be served at /client-metadata.json
const devClientMetadata = (): OAuthClientMetadataInput => {
  // Development configuration for AT Protocol OAuth
  // For development, we use a special client_id format with redirect_uri as query param

  // Add 'transition:chat.bsky' scope for access to chats.
  // Add 'transition:email' scope for email verification.
  // To encourage more people to try Skyfi in the early days we
  // won't ask for this access. Maybe after we build some brand trust.
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
}

let oauthClient: BrowserOAuthClient | null = null

/**
 * Initialize the OAuth client (web only)
 */
export async function initializedOAuthClient(): Promise<BrowserOAuthClient> {
  if (!isWeb) {
    throw new Error('OAuth client is only available on web platform')
  }

  if (!oauthClient) {
    try {
      const isDev =
        process.env.NODE_ENV === 'development' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'

      if (isDev) {
        oauthClient = new BrowserOAuthClient({
          clientMetadata: devClientMetadata(),
          handleResolver: 'https://bsky.social',
        })

        const result = await oauthClient.init()
        console.log('✅ OAuth DEV client created successfully: ', result)
      } else {
        // Use the client metadata from our deployed URL
        oauthClient = await BrowserOAuthClient.load({
          clientId: 'https://app.skyfi.social/client-metadata.json',
          handleResolver: 'https://bsky.social',
        })

        const result = await oauthClient.init()
        console.log('✅ OAuth PROD client created successfully: ', result)
      }
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
 * Start OAuth login flow using redirect (web only)
 */
export async function startOAuthLogin(handle: string): Promise<void> {
  const client = await initializedOAuthClient()

  // The @atproto/oauth-client-browser signInPopup method is popping up the window and not closing it if
  // the the handle is not valid. So we need to pre-validate the handle. Remove this when the library is fixed.
  // try {
  //   const response = await fetch(
  //     `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  //   )
  //   if (!response.ok) {
  //     throw new Error(
  //       'Invalid handle. Please check your username and try again.',
  //     )
  //   }
  //   const result = await response.json()
  //   if (!result.did) {
  //     throw new Error(
  //       'Invalid handle. Please check your username and try again.',
  //     )
  //   }
  // } catch (validationError) {
  //   console.log(
  //     '❌ Handle validation failed:',
  //     (validationError as Error).message,
  //   )
  //   throw validationError
  // }

  // Use redirect flow instead of popup
  try {
    console.log('🚀 Starting OAuth redirect...')
    await client.signIn(handle, {
      prompt: 'login',
    })
    // This will redirect to the OAuth provider, no return value
  } catch (error) {
    console.error('❌ OAuth redirect failed:', error)
    if (
      error instanceof Error &&
      error.message.includes('Failed to resolve identity')
    ) {
      throw new Error(
        'Invalid handle. Please check your username and try again.',
      )
    } else {
      throw new Error('An error occurred during sign-in. Please try again.')
    }
  }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(): Promise<{
  session?: OAuthSession
  error?: string
}> {
  try {
    const client = await initializedOAuthClient()
    const result = await client.init() // This will read the callback params from the URL and return the session if available

    console.log('🔍 OAuth callback result:', result)

    if (result?.session) {
      console.log('✅ OAuth session found:', result.session.sub)
      return {session: result.session}
    } else {
      console.log('❌ No OAuth session found in result')
      return {error: 'No session found'}
    }
  } catch (error) {
    console.error('❌ OAuth callback failed:', error)

    // Check to see if the error message contains "user rejected" and give a more user-friendly message
    if (error instanceof Error && error.message.includes('user rejected')) {
      return {error: 'You rejected the sign-in request. Please try again.'}
    } else if (
      error instanceof Error &&
      error.message.includes('Failed to resolve identity')
    ) {
      return {error: 'Username not found'}
    } else {
      return {error: 'An error occurred during sign-in. Please try again.'}
    }
  }
}
