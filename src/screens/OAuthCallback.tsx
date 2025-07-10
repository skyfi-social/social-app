import {useEffect} from 'react'
import {View} from 'react-native'

import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {navigate} from '#/Navigation'

export function OAuthCallbackScreen() {
  const {hasSession} = useSession()
  const t = useTheme()

  useEffect(() => {
    // OAuth callback is now handled during app initialization
    // If we have a session, redirect to home
    // If not, redirect to the main page to start login flow
    const timer = setTimeout(() => {
      if (hasSession) {
        navigate('Home')
      } else {
        // Replace with the root URL to trigger normal app flow
        window.location.replace('/')
      }
    }, 1000) // Small delay to show the message

    return () => clearTimeout(timer)
  }, [hasSession])

  return (
    <View
      style={[a.flex_1, a.justify_center, a.align_center, a.p_xl, t.atoms.bg]}>
      <View style={[a.align_center]}>
        <Text style={[a.text_xl, a.mb_sm, t.atoms.text]}>
          Completing sign in...
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          Please wait while we redirect you
        </Text>
      </View>
    </View>
  )
}
