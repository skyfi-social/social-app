import {
  Agent,
  type AtpSessionData,
  type AtpSessionEvent,
  BskyAgent,
} from '@atproto/api'
import {TID} from '@atproto/common-web'
import {type OAuthSession} from '@atproto/oauth-client-browser'

import {networkRetry} from '#/lib/async/retry'
import {
  BSKY_SERVICE,
  DISCOVER_SAVED_FEED,
  IS_PROD_SERVICE,
  PUBLIC_BSKY_SERVICE,
  TIMELINE_SAVED_FEED,
} from '#/lib/constants'
import {tryFetchGates} from '#/lib/statsig/statsig'
import {getAge} from '#/lib/strings/time'
import {logger} from '#/logger'
import {snoozeEmailConfirmationPrompt} from '#/state/shell/reminders'
import {emitNetworkConfirmed, emitNetworkLost} from '../events'
import {addSessionErrorLog} from './logging'
import {
  configureModerationForAccount,
  configureModerationForGuest,
} from './moderation'
import {type SessionAccount} from './types'
import {isSessionExpired, isSignupQueued} from './util'

export function createPublicAgent() {
  configureModerationForGuest() // Side effect but only relevant for tests
  return new BskyAppAgent({service: PUBLIC_BSKY_SERVICE})
}

export async function createAgentAndResume(
  storedAccount: SessionAccount,
  onSessionChange: (
    agent: BskyAgent,
    did: string,
    event: AtpSessionEvent,
  ) => void,
) {
  const agent = new BskyAppAgent({service: storedAccount.service})
  if (storedAccount.pdsUrl) {
    agent.sessionManager.pdsUrl = new URL(storedAccount.pdsUrl)
  }
  const gates = tryFetchGates(storedAccount.did, 'prefer-low-latency')
  const moderation = configureModerationForAccount(agent, storedAccount)
  const prevSession: AtpSessionData = sessionAccountToSession(storedAccount)
  if (isSessionExpired(storedAccount)) {
    await networkRetry(1, () => agent.resumeSession(prevSession))
  } else {
    agent.sessionManager.session = prevSession
    if (!storedAccount.signupQueued) {
      networkRetry(3, () => agent.resumeSession(prevSession)).catch(
        (e: any) => {
          logger.error(`networkRetry failed to resume session`, {
            status: e?.status || 'unknown',
            // this field name is ignored by Sentry scrubbers
            safeMessage: e?.message || 'unknown',
          })

          throw e
        },
      )
    }
  }

  return agent.prepare(gates, moderation, onSessionChange)
}

export async function createAgentAndLogin(
  {
    service,
    identifier,
    password,
    authFactorToken,
  }: {
    service: string
    identifier: string
    password: string
    authFactorToken?: string
  },
  onSessionChange: (
    agent: BskyAgent,
    did: string,
    event: AtpSessionEvent,
  ) => void,
) {
  const agent = new BskyAppAgent({service})
  await agent.login({
    identifier,
    password,
    authFactorToken,
    allowTakendown: true,
  })

  const account = agentToSessionAccountOrThrow(agent)
  const gates = tryFetchGates(account.did, 'prefer-fresh-gates')
  const moderation = configureModerationForAccount(agent, account)
  return agent.prepare(gates, moderation, onSessionChange)
}

export async function createAgentAndCreateAccount(
  {
    service,
    email,
    password,
    handle,
    birthDate,
    inviteCode,
    verificationPhone,
    verificationCode,
  }: {
    service: string
    email: string
    password: string
    handle: string
    birthDate: Date
    inviteCode?: string
    verificationPhone?: string
    verificationCode?: string
  },
  onSessionChange: (
    agent: BskyAgent,
    did: string,
    event: AtpSessionEvent,
  ) => void,
) {
  const agent = new BskyAppAgent({service})
  await agent.createAccount({
    email,
    password,
    handle,
    inviteCode,
    verificationPhone,
    verificationCode,
  })
  const account = agentToSessionAccountOrThrow(agent)
  const gates = tryFetchGates(account.did, 'prefer-fresh-gates')
  const moderation = configureModerationForAccount(agent, account)

  // Not awaited so that we can still get into onboarding.
  // This is OK because we won't let you toggle adult stuff until you set the date.
  if (IS_PROD_SERVICE(service)) {
    try {
      networkRetry(1, async () => {
        await agent.setPersonalDetails({birthDate: birthDate.toISOString()})
        await agent.overwriteSavedFeeds([
          {
            ...DISCOVER_SAVED_FEED,
            id: TID.nextStr(),
          },
          {
            ...TIMELINE_SAVED_FEED,
            id: TID.nextStr(),
          },
        ])

        if (getAge(birthDate) < 18) {
          await agent.api.com.atproto.repo.putRecord({
            repo: account.did,
            collection: 'chat.bsky.actor.declaration',
            rkey: 'self',
            record: {
              $type: 'chat.bsky.actor.declaration',
              allowIncoming: 'none',
            },
          })
        }
      })
    } catch (e: any) {
      logger.error(e, {
        message: `session: createAgentAndCreateAccount failed to save personal details and feeds`,
      })
    }
  } else {
    agent.setPersonalDetails({birthDate: birthDate.toISOString()})
  }

  try {
    // snooze first prompt after signup, defer to next prompt
    snoozeEmailConfirmationPrompt()
  } catch (e: any) {
    logger.error(e, {message: `session: failed snoozeEmailConfirmationPrompt`})
  }

  return agent.prepare(gates, moderation, onSessionChange)
}

// Create agent and account from OAuth session
// Resume OAuth session from stored account
export async function createAgentAndResumeOAuth(
  storedAccount: SessionAccount,
  onSessionChange: (
    agent: BskyAgent,
    did: string,
    event: AtpSessionEvent,
  ) => void,
) {
  console.log('🔄 Resuming OAuth session for:', storedAccount.did)

  try {
    // Import OAuth client to get the stored session
    const {initOAuthClient} = await import('#/lib/oauth')
    const oauthClient = await initOAuthClient()

    // Try to get the OAuth session for this DID from the OAuth client
    console.log('🔍 Getting OAuth session from client...')
    const oauthSession = await oauthClient.restore(storedAccount.did)

    if (!oauthSession) {
      throw new Error(
        'No OAuth session found for this account - user needs to re-authenticate',
      )
    }

    console.log('✅ OAuth session restored for:', oauthSession.sub)

    // Create the OAuth agent with the restored session
    const agent = new OAuthBskyAppAgent(oauthSession)
    console.log('✅ OAuth agent created for resume')

    const gates = tryFetchGates(storedAccount.did, 'prefer-low-latency')
    const moderation = configureModerationForAccount(
      agent as any,
      storedAccount,
    )

    console.log('🔄 Preparing resumed OAuth agent...')
    const result = await agent.prepare(
      gates,
      moderation,
      onSessionChange,
      oauthSession,
    )
    console.log('✅ OAuth agent resumed successfully')

    return result
  } catch (error) {
    console.error('❌ Failed to resume OAuth session:', error)
    throw error
  }
}

export async function createAgentAndLoginOAuth(
  oauthSession: OAuthSession,
  onSessionChange: (
    agent: BskyAgent,
    did: string,
    event: AtpSessionEvent,
  ) => void,
) {
  console.log('🔄 Creating OAuth agent for session:', oauthSession.sub)
  console.log('🔍 OAuth session details:', {
    sub: oauthSession.sub,
    pdsUrl: oauthSession.pdsUrl,
    hasServerMetadata: !!oauthSession.serverMetadata,
    hasFetchHandler: typeof oauthSession.fetchHandler === 'function',
  })

  try {
    const agent = new OAuthBskyAppAgent(oauthSession)
    console.log('✅ OAuth agent created successfully')

    const gates = tryFetchGates(oauthSession.sub, 'prefer-fresh-gates')
    const moderation = configureModerationForAccount(
      agent as any,
      {
        did: oauthSession.sub,
        service: oauthSession.pdsUrl || 'https://bsky.social',
      } as SessionAccount,
    )

    console.log('🔄 Preparing OAuth agent...')
    const result = await agent.prepare(
      gates,
      moderation,
      onSessionChange,
      oauthSession,
    )
    console.log('✅ OAuth agent prepared successfully', {
      accountDid: result.account.did,
      accountHandle: result.account.handle,
    })

    return result
  } catch (error) {
    console.error('❌ Failed to create OAuth agent:', error)
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    })
    throw error
  }
}

export function agentToSessionAccountOrThrow(agent: BskyAgent): SessionAccount {
  const account = agentToSessionAccount(agent)
  if (!account) {
    throw Error('Expected an active session')
  }
  return account
}

export function agentToSessionAccount(
  agent: BskyAgent,
): SessionAccount | undefined {
  if (!agent.session) {
    return undefined
  }
  return {
    service: agent.service.toString(),
    did: agent.session.did,
    handle: agent.session.handle,
    email: agent.session.email,
    emailConfirmed: agent.session.emailConfirmed || false,
    emailAuthFactor: agent.session.emailAuthFactor || false,
    refreshJwt: agent.session.refreshJwt,
    accessJwt: agent.session.accessJwt,
    signupQueued: isSignupQueued(agent.session.accessJwt),
    active: agent.session.active,
    status: agent.session.status as SessionAccount['status'],
    pdsUrl: agent.pdsUrl?.toString(),
    isSelfHosted: !agent.serviceUrl.toString().startsWith(BSKY_SERVICE),
  }
}

export function sessionAccountToSession(
  account: SessionAccount,
): AtpSessionData {
  return {
    // Sorted in the same property order as when returned by BskyAgent (alphabetical).
    accessJwt: account.accessJwt ?? '',
    did: account.did,
    email: account.email,
    emailAuthFactor: account.emailAuthFactor,
    emailConfirmed: account.emailConfirmed,
    handle: account.handle,
    refreshJwt: account.refreshJwt ?? '',
    /**
     * @see https://github.com/bluesky-social/atproto/blob/c5d36d5ba2a2c2a5c4f366a5621c06a5608e361e/packages/api/src/agent.ts#L188
     */
    active: account.active ?? true,
    status: account.status,
  }
}

// Not exported. Use factories above to create it.
let realFetch = globalThis.fetch
class BskyAppAgent extends BskyAgent {
  persistSessionHandler: ((event: AtpSessionEvent) => void) | undefined =
    undefined

  constructor({service}: {service: string}) {
    super({
      service,
      async fetch(...args) {
        let success = false
        try {
          const result = await realFetch(...args)
          success = true
          return result
        } catch (e) {
          success = false
          throw e
        } finally {
          if (success) {
            emitNetworkConfirmed()
          } else {
            emitNetworkLost()
          }
        }
      },
      persistSession: (event: AtpSessionEvent) => {
        if (this.persistSessionHandler) {
          this.persistSessionHandler(event)
        }
      },
    })
  }

  async prepare(
    // Not awaited in the calling code so we can delay blocking on them.
    gates: Promise<void>,
    moderation: Promise<void>,
    onSessionChange: (
      agent: BskyAgent,
      did: string,
      event: AtpSessionEvent,
    ) => void,
  ) {
    // There's nothing else left to do, so block on them here.
    await Promise.all([gates, moderation])

    // Now the agent is ready.
    const account = agentToSessionAccountOrThrow(this)
    let lastSession = this.sessionManager.session
    this.persistSessionHandler = event => {
      if (this.sessionManager.session) {
        lastSession = this.sessionManager.session
      } else if (event === 'network-error') {
        // Put it back, we'll try again later.
        this.sessionManager.session = lastSession
      }

      onSessionChange(this, account.did, event)
      if (event !== 'create' && event !== 'update') {
        addSessionErrorLog(account.did, event)
      }
    }
    return {account, agent: this}
  }

  dispose() {
    this.sessionManager.session = undefined
    this.persistSessionHandler = undefined
  }
}

// OAuth-aware BskyAppAgent that uses OAuthSession instead of traditional JWT session management
class OAuthBskyAppAgent extends Agent {
  persistSessionHandler: ((event: AtpSessionEvent) => void) | undefined =
    undefined

  constructor(oauthSession: OAuthSession) {
    // Pass the OAuth session directly to the Agent constructor
    super(oauthSession)
  }

  async prepare(
    gates: Promise<void>,
    moderation: Promise<void>,
    onSessionChange: (
      agent: BskyAgent,
      did: string,
      event: AtpSessionEvent,
    ) => void,
    oauthSession: OAuthSession,
  ) {
    // Wait for gates and moderation to complete
    await Promise.all([gates, moderation])

    // Create session account from OAuth session directly
    const account = await oauthSessionToAccount(oauthSession)

    this.persistSessionHandler = event => {
      onSessionChange(this as any, account.did, event)
      if (event !== 'create' && event !== 'update') {
        addSessionErrorLog(account.did, event)
      }
    }

    return {account, agent: this as any}
  }

  dispose() {
    this.persistSessionHandler = undefined
  }
}

// Convert OAuth session to session account
async function oauthSessionToAccount(
  oauthSession: OAuthSession,
): Promise<SessionAccount> {
  try {
    console.log('🔍 Getting token info from OAuth session...')
    const tokenInfo = await oauthSession.getTokenInfo()
    console.log('✅ Token info:', {
      sub: tokenInfo.sub,
      iss: tokenInfo.iss,
      aud: tokenInfo.aud,
      scope: tokenInfo.scope,
      expired: tokenInfo.expired,
      expiresAt: tokenInfo.expiresAt,
    })

    console.log(
      '🔍 Making session request to:',
      '/xrpc/com.atproto.server.getSession',
    )
    // Make a request to get session details
    const sessionResponse = await oauthSession.fetchHandler(
      '/xrpc/com.atproto.server.getSession',
    )
    console.log('📋 Session response status:', sessionResponse.status)

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text()
      console.error('❌ Session request failed:', errorText)
      throw new Error(
        `Session request failed: ${sessionResponse.status} - ${errorText}`,
      )
    }

    const sessionData = await sessionResponse.json()
    console.log('✅ Session data:', sessionData)

    return {
      service: oauthSession.pdsUrl || 'https://bsky.social',
      did: oauthSession.sub,
      handle: sessionData.handle || '',
      email: sessionData.email || '',
      emailConfirmed: sessionData.emailConfirmed || false,
      emailAuthFactor: sessionData.emailAuthFactor || false,
      refreshJwt: 'oauth-managed',
      accessJwt: 'oauth-managed',
      signupQueued: false,
      active: sessionData.active !== false,
      status: sessionData.status || 'active',
      pdsUrl: oauthSession.pdsUrl,
      isSelfHosted: false,
    }
  } catch (error) {
    console.error('❌ Could not get session details:', error)
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    })

    // Fallback with minimal data
    return {
      service: oauthSession.pdsUrl || 'https://bsky.social',
      did: oauthSession.sub,
      handle: '',
      email: '',
      emailConfirmed: false,
      emailAuthFactor: false,
      refreshJwt: 'oauth-managed',
      accessJwt: 'oauth-managed',
      signupQueued: false,
      active: true,
      status: 'active',
      pdsUrl: oauthSession.pdsUrl,
      isSelfHosted: false,
    }
  }
}

export type {BskyAppAgent, OAuthBskyAppAgent}
