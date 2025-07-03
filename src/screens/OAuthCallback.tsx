import {View} from 'react-native'
import {Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {handleOAuthCallback} from '#/lib/oauth'
import {logger} from '#/logger'
import {isWeb} from '#/platform/detection'
import * as persisted from '#/state/persisted'
import {CenteredView} from '#/view/com/util/Views'
import {atoms as a} from '#/alf'
import {Text} from '#/components/Typography'

export function OAuthCallbackScreen() {
  const {_} = useLingui()

  useEffect(() => {
    // Only process OAuth callback on web
    if (!isWeb) {
      return
    }

    const processOAuthCallback = async () => {
      try {
        const agent = await handleOAuthCallback()
        if (agent) {
          // OAuth agent is already authenticated - we need to extract session data
          // For OAuth agents, we need to get session info differently since the Agent class
          // doesn't have the same session property structure as BskyAgent

          // Get session information from the OAuth agent
          // For OAuth, we need to call com.atproto.server.getSession to get the current session info
          const sessionInfo = await agent.com.atproto.server.getSession()
          const did = sessionInfo.data.did

          // Get profile info
          const profile = await agent.app.bsky.actor.getProfile({actor: did})

          // Create session data for the OAuth login
          const sessionData = {
            service: 'https://bsky.social',
            handle: profile.data.handle,
            did: did,
            email: sessionInfo.data.email || '', // OAuth may provide email
            emailConfirmed: sessionInfo.data.emailConfirmed || false,
            emailAuthFactor: sessionInfo.data.emailAuthFactor || false,
            accessJwt: '', // OAuth uses different auth mechanism
            refreshJwt: '', // OAuth handles refresh internally
            active: sessionInfo.data.active || true,
            status: (sessionInfo.data.status as any) || 'active',
            signupQueued: false,
            pdsUrl: undefined,
            isSelfHosted: false,
          }

          // Add the account to persisted storage
          const currentAccounts = persisted.get('session').accounts
          const existingIndex = currentAccounts.findIndex(
            acc => acc.did === sessionData.did,
          )

          if (existingIndex >= 0) {
            // Update existing account
            currentAccounts[existingIndex] = sessionData
          } else {
            // Add new account
            currentAccounts.unshift(sessionData)
          }

          persisted.write('session', {accounts: currentAccounts})

          logger.info('OAuth login successful')

          // Redirect to home page - the session provider will pick up the new account
          if (isWeb) {
            window.location.href = '/'
          }
        } else {
          logger.error('OAuth callback failed: No agent returned')
          // Navigate back to login screen or show error
          if (isWeb) {
            window.location.href = '/'
          }
        }
      } catch (error) {
        logger.error('OAuth callback processing failed:', {error})
        // Navigate back to login screen
        if (isWeb) {
          window.location.href = '/'
        }
      }
    }

    processOAuthCallback()
  }, [])

  return (
    <CenteredView
      style={[a.h_full, a.flex_1, a.justify_center, a.align_center]}>
      <View style={[a.gap_md, a.align_center]}>
        <Text style={[a.text_lg, a.font_bold]}>
          <Trans>Completing sign in...</Trans>
        </Text>
        <Text style={[a.text_md, a.text_center]}>
          <Trans>
            Please wait while we complete your OAuth sign in with bsky.social
          </Trans>
        </Text>
      </View>
    </CenteredView>
  )
}
