import {useEffect, useState} from 'react'
import {View} from 'react-native'

import {handleOAuthCallback} from '#/lib/oauth'
import {useSessionApi} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {navigate} from '#/Navigation'

export function OAuthCallbackScreen() {
  const {loginOAuth} = useSessionApi()
  const [status, setStatus] = useState<'authenticating' | 'error'>(
    'authenticating',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Pause to allow debug
        const result = await handleOAuthCallback()

        if (result.session) {
          // Login with the OAuth session
          await loginOAuth(result.session, 'OAuth')
          // Navigate to home using history.replace for smoother transition
          // window.history.replaceState({}, '', '/')
          navigate('Home')
        } else {
          setStatus('error')
          setError(result.error || 'OAuth authentication failed')
        }
      } catch (err) {
        setStatus('error')
        setError(
          err instanceof Error ? err.message : 'An unexpected error occurred',
        )
      }
    }

    processCallback()
  }, [loginOAuth])

  const t = useTheme()

  return (
    <View
      style={[a.flex_1, a.justify_center, a.align_center, a.p_xl, t.atoms.bg]}>
      {status === 'authenticating' ? (
        <View style={[a.align_center]}>
          <Text style={[a.text_xl, a.mb_sm, t.atoms.text]}>
            Authenticating...
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            Please wait while we complete your sign in
          </Text>
        </View>
      ) : (
        <View style={[a.align_center]}>
          <Text style={[a.text_xl, a.mb_sm, {color: '#d32f2f'}]}>
            Authentication Error
          </Text>
          <Text style={[a.text_sm, a.mb_lg, t.atoms.text_contrast_medium]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  )
}
