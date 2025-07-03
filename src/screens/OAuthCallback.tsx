import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {createOAuthSessionAccount, handleOAuthCallback} from '#/lib/oauth'
import {logger} from '#/logger'
import {isWeb} from '#/platform/detection'
import {useSessionApi} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {CenteredView} from '#/view/com/util/Views'
import {atoms as a} from '#/alf'
import {Text} from '#/components/Typography'

export function OAuthCallbackScreen() {
  const {_} = useLingui()
  const {login} = useSessionApi()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    // Only process OAuth callback on web
    if (!isWeb) {
      return
    }

    const processOAuthCallback = async () => {
      try {
        console.log('🔄 Processing OAuth callback at:', window.location.href)
        setStatus('processing')

        const result = await handleOAuthCallback()

        if (!result) {
          console.error('❌ OAuth callback failed: No result returned')
          setStatus('error')
          setTimeout(() => {
            if (isWeb) window.location.href = '/'
          }, 2000)
          return
        }

        const {agent, oauthSession} = result
        console.log('✅ OAuth session received successfully')
        setStatus('extracting')

        console.log('📝 Creating OAuth session account')
        setStatus('logging_in')

        // Create proper OAuth session account using the OAuthSession
        const oauthAccount = await createOAuthSessionAccount(
          agent,
          oauthSession,
        )

        // Write directly to persisted storage using the expected format
        const persisted = await import('#/state/persisted')
        const currentStorage = persisted.get('session') || {accounts: []}

        // Remove any existing account with same DID
        const existingIndex = currentStorage.accounts.findIndex(
          (acc: any) => acc.did === oauthAccount.did,
        )
        if (existingIndex >= 0) {
          currentStorage.accounts[existingIndex] = oauthAccount
        } else {
          currentStorage.accounts.unshift(oauthAccount)
        }

        // Set as current account
        const newSessionData = {
          accounts: currentStorage.accounts,
          currentAccount: oauthAccount,
        }

        persisted.write('session', newSessionData)

        console.log(
          '✅ OAuth session saved to storage with handle:',
          oauthAccount.handle,
        )
        setStatus('success')

        // Hide the logged out view
        setShowLoggedOut(false)

        // Force a page reload to reinitialize the session system
        setTimeout(() => {
          if (isWeb) {
            window.location.href = '/'
          }
        }, 500)
      } catch (error) {
        console.error('❌ OAuth callback processing failed:', error)
        logger.error('OAuth callback processing failed:', {error})
        setStatus('error')

        setTimeout(() => {
          if (isWeb) {
            window.location.href = '/?error=oauth_failed'
          }
        }, 2000)
      }
    }

    processOAuthCallback()
  }, [login, setShowLoggedOut])

  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return 'Processing OAuth callback...'
      case 'extracting':
        return 'Extracting user information...'
      case 'logging_in':
        return 'Creating your session...'
      case 'success':
        return 'Success! Redirecting...'
      case 'error':
        return 'Error occurred. Redirecting...'
      default:
        return 'Completing sign in...'
    }
  }

  return (
    <CenteredView
      style={[a.h_full, a.flex_1, a.justify_center, a.align_center]}>
      <View style={[a.gap_md, a.align_center]}>
        <Text style={[a.text_lg, a.font_bold]}>
          <Trans>Completing sign in...</Trans>
        </Text>
        <Text style={[a.text_md, a.text_center]}>{getStatusMessage()}</Text>
        <Text style={[a.text_sm, a.text_center, a.opacity_70]}>
          <Trans>
            Please wait while we complete your OAuth sign in with bsky.social
          </Trans>
        </Text>
      </View>
    </CenteredView>
  )
}
