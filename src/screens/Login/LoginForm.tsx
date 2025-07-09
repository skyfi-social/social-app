import React, {useRef, useState} from 'react'
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  type TextInput,
  View,
} from 'react-native'
import {
  ComAtprotoServerCreateSession,
  type ComAtprotoServerDescribeServer,
} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {startOAuthLogin} from '#/lib/oauth'
import {isNetworkError} from '#/lib/strings/errors'
import {cleanError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {isWeb} from '#/platform/detection'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
import {useSessionApi} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import {HostingProvider} from '#/components/forms/HostingProvider'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {FormContainer} from './FormContainer'

type ServiceDescription = ComAtprotoServerDescribeServer.OutputSchema

export const LoginForm = ({
  error,
  serviceUrl,
  serviceDescription,
  initialHandle,
  setError,
  setServiceUrl,
  onPressRetryConnect,
  onPressBack,
  onPressForgotPassword,
  onAttemptSuccess,
  onAttemptFailed,
}: {
  error: string
  serviceUrl: string
  serviceDescription: ServiceDescription | undefined
  initialHandle: string
  setError: (v: string) => void
  setServiceUrl: (v: string) => void
  onPressRetryConnect: () => void
  onPressBack: () => void
  onPressForgotPassword: () => void
  onAttemptSuccess: () => void
  onAttemptFailed: () => void
}) => {
  const t = useTheme()
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isAuthFactorTokenNeeded, setIsAuthFactorTokenNeeded] =
    useState<boolean>(false)
  const [isAuthFactorTokenValueEmpty, setIsAuthFactorTokenValueEmpty] =
    useState<boolean>(true)
  const identifierValueRef = useRef<string>(initialHandle || '')
  const passwordValueRef = useRef<string>('')
  const authFactorTokenValueRef = useRef<string>('')
  const passwordRef = useRef<TextInput>(null)
  const {_} = useLingui()
  const {login, loginOAuth} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()

  const onPressSelectService = React.useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const onPressNext = async () => {
    if (isProcessing) return
    Keyboard.dismiss()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setError('')

    const identifier = identifierValueRef.current.toLowerCase().trim()

    if (!identifier) {
      setError(_(msg`Please enter your username`))
      return
    }

    setIsProcessing(true)

    try {
      // Use OAuth flow for web, fallback to traditional login for mobile
      if (isWeb) {
        console.log('🌐 LoginForm: Starting OAuth flow for user:', identifier)

        try {
          const oauthSession = await startOAuthLogin(identifier)

          if (oauthSession) {
            console.log(
              '✅ OAuth popup completed successfully:',
              oauthSession.sub,
            )
            // Use the OAuth session to log in through SessionProvider
            await loginOAuth(oauthSession, 'OAuth')
            console.log('✅ OAuth login completed successfully')

            // Trigger success callbacks
            onAttemptSuccess()
            requestNotificationsPermission('LoginForm')
            setHasCheckedForStarterPack(true)
          } else {
            console.log('👤 OAuth was cancelled or failed')
            setError(_(msg`Sign in was cancelled`))
          }
        } catch (oauthError) {
          setIsProcessing(false)

          const errMsg = (oauthError as Error).toString()

          if (errMsg.includes('Invalid handle')) {
            setError(
              _(msg`Invalid handle. Please check your username and try again.`),
            )
          } else {
            setError(_(msg`OAuth login failed. Please try again.`))
          }
          return
        }
      } else {
        // For mobile platforms, fall back to traditional login flow
        const password = passwordValueRef.current
        const authFactorToken = authFactorTokenValueRef.current

        if (!password) {
          setError(_(msg`Please enter your password`))
          setIsProcessing(false)
          return
        }

        // try to guess the handle if the user just gave their own username
        let fullIdent = identifier
        if (
          !identifier.includes('@') && // not an email
          !identifier.includes('.') && // not a domain
          serviceDescription &&
          serviceDescription.availableUserDomains.length > 0
        ) {
          let matched = false
          for (const domain of serviceDescription.availableUserDomains) {
            if (fullIdent.endsWith(domain)) {
              matched = true
            }
          }
          if (!matched) {
            fullIdent = createFullHandle(
              identifier,
              serviceDescription.availableUserDomains[0],
            )
          }
        }

        await login(
          {
            service: serviceUrl,
            identifier: fullIdent,
            password,
            authFactorToken: authFactorToken.trim(),
          },
          'LoginForm',
        )
        onAttemptSuccess()
        setShowLoggedOut(false)
        setHasCheckedForStarterPack(true)
        requestNotificationsPermission('Login')
      }
    } catch (e: any) {
      const errMsg = e.toString()
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setIsProcessing(false)

      if (isWeb) {
        // Handle OAuth errors
        console.error('🚨 OAuth login failed - Full error object:', e)
        console.error('🚨 Error string representation:', errMsg)
        console.error('🚨 Error type:', typeof e)
        console.error('🚨 Error constructor:', e.constructor?.name)

        if (errMsg.includes('https') || errMsg.includes('HTTPS')) {
          console.log('🔒 HTTPS-related error detected')
          setError(_(msg`OAuth requires HTTPS. Using development server.`))
        } else if (errMsg.includes('Failed to resolve identity')) {
          console.log('👤 Identity resolution error detected')
          // Extract the handle from the error message for better UX
          const handleMatch = errMsg.match(/Failed to resolve identity: (.+)/)
          const handle = handleMatch ? handleMatch[1] : 'handle'
          setError(
            _(
              msg`Handle "${handle}" not found. Please check your username or handle and try again.`,
            ),
          )
        } else if (errMsg.includes('OAuthResolverError')) {
          console.log('🔍 OAuth resolver error detected')
          setError(
            _(
              msg`Unable to find your account. Please check your username or handle and try again.`,
            ),
          )
        } else {
          console.log('❓ Unknown OAuth error - showing generic message')
          console.log('❓ Error details for debugging:', {
            message: e.message,
            name: e.name,
            stack: e.stack,
            errorString: errMsg,
          })
          setError(_(msg`OAuth login failed. Please try again.`))
        }
        onAttemptFailed()
      } else {
        // Handle traditional login errors
        if (
          e instanceof
          ComAtprotoServerCreateSession.AuthFactorTokenRequiredError
        ) {
          setIsAuthFactorTokenNeeded(true)
        } else {
          onAttemptFailed()
          if (errMsg.includes('Token is invalid')) {
            logger.debug('Failed to login due to invalid 2fa token', {
              error: errMsg,
            })
            setError(_(msg`Invalid 2FA confirmation code.`))
          } else if (
            errMsg.includes('Authentication Required') ||
            errMsg.includes('Invalid identifier or password')
          ) {
            logger.debug('Failed to login due to invalid credentials', {
              error: errMsg,
            })
            setError(_(msg`Incorrect username or password`))
          } else if (isNetworkError(e)) {
            logger.warn('Failed to login due to network error', {error: errMsg})
            setError(
              _(
                msg`Unable to contact your service. Please check your Internet connection.`,
              ),
            )
          } else {
            logger.warn('Failed to login', {error: errMsg})
            setError(cleanError(errMsg))
          }
        }
      }
    }
  }

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      {/* Hide hosting provider selection for web (OAuth), show for mobile */}
      {!isWeb && (
        <View>
          <TextField.LabelText>
            <Trans>Hosting provider</Trans>
          </TextField.LabelText>
          <HostingProvider
            serviceUrl={serviceUrl}
            onSelectServiceUrl={setServiceUrl}
            onOpenDialog={onPressSelectService}
          />
        </View>
      )}
      <View>
        <TextField.LabelText>
          <Trans>Account</Trans>
        </TextField.LabelText>
        <View style={[a.gap_sm]}>
          <TextField.Root>
            <TextField.Icon icon={At} />
            <TextField.Input
              testID="loginUsernameInput"
              label={_(
                isWeb
                  ? msg`Username or handle`
                  : msg`Username or email address`,
              )}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="username"
              returnKeyType={isWeb ? 'done' : 'next'}
              textContentType="username"
              defaultValue={initialHandle || ''}
              onChangeText={v => {
                identifierValueRef.current = v
              }}
              onSubmitEditing={
                isWeb
                  ? onPressNext
                  : () => {
                      passwordRef.current?.focus()
                    }
              }
              blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
              editable={!isProcessing}
              accessibilityHint={_(
                isWeb
                  ? msg`Enter your Bluesky username or handle (e.g. alice.bsky.social)`
                  : msg`Enter the username or email address you used when you created your account`,
              )}
            />
          </TextField.Root>

          {/* Hide password field for web (OAuth), show for mobile */}
          {!isWeb && (
            <TextField.Root>
              <TextField.Icon icon={Lock} />
              <TextField.Input
                testID="loginPasswordInput"
                inputRef={passwordRef}
                label={_(msg`Password`)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                returnKeyType="done"
                enablesReturnKeyAutomatically={true}
                secureTextEntry={true}
                textContentType="password"
                clearButtonMode="while-editing"
                onChangeText={v => {
                  passwordValueRef.current = v
                }}
                onSubmitEditing={onPressNext}
                blurOnSubmit={false} // HACK: https://github.com/facebook/react-native/issues/21911#issuecomment-558343069 Keyboard blur behavior is now handled in onSubmitEditing
                editable={!isProcessing}
                accessibilityHint={_(msg`Enter your password`)}
              />
              <Button
                testID="forgotPasswordButton"
                onPress={onPressForgotPassword}
                label={_(msg`Forgot password?`)}
                accessibilityHint={_(msg`Opens password reset form`)}
                variant="solid"
                color="secondary"
                style={[
                  a.rounded_sm,
                  // t.atoms.bg_contrast_100,
                  {marginLeft: 'auto', left: 6, padding: 6},
                  a.z_10,
                ]}>
                <ButtonText>
                  <Trans>Forgot?</Trans>
                </ButtonText>
              </Button>
            </TextField.Root>
          )}
        </View>
      </View>
      {/* Only show 2FA for traditional login (non-web) */}
      {!isWeb && isAuthFactorTokenNeeded && (
        <View>
          <TextField.LabelText>
            <Trans>2FA Confirmation</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Icon icon={Ticket} />
            <TextField.Input
              testID="loginAuthFactorTokenInput"
              label={_(msg`Confirmation code`)}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="one-time-code"
              returnKeyType="done"
              textContentType="username"
              blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
              onChangeText={v => {
                setIsAuthFactorTokenValueEmpty(v === '')
                authFactorTokenValueRef.current = v
              }}
              onSubmitEditing={onPressNext}
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Input the code which has been emailed to you`,
              )}
              style={[
                {
                  textTransform: isAuthFactorTokenValueEmpty
                    ? 'none'
                    : 'uppercase',
                },
              ]}
            />
          </TextField.Root>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
            <Trans>
              Check your email for a sign in code and enter it here.
            </Trans>
          </Text>
        </View>
      )}

      {/* Show OAuth explanation for web users */}
      {isWeb && (
        <View style={[a.mt_md]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Enter your Bluesky username or handle. You'll be securely
              redirected to bsky.social to complete sign in.
            </Trans>
          </Text>
        </View>
      )}
      <FormError error={error} />
      <View style={[a.flex_row, a.align_center, a.pt_md]}>
        <Button
          label={_(msg`Back`)}
          variant="solid"
          color="secondary"
          size="large"
          onPress={onPressBack}>
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
        <View style={a.flex_1} />
        {!serviceDescription && error ? (
          <Button
            testID="loginRetryButton"
            label={_(msg`Retry`)}
            accessibilityHint={_(msg`Retries signing in`)}
            variant="solid"
            color="secondary"
            size="large"
            onPress={onPressRetryConnect}>
            <ButtonText>
              <Trans>Retry</Trans>
            </ButtonText>
          </Button>
        ) : !serviceDescription ? (
          <>
            <ActivityIndicator />
            <Text style={[t.atoms.text_contrast_high, a.pl_md]}>
              <Trans>Connecting...</Trans>
            </Text>
          </>
        ) : (
          <Button
            testID="loginNextButton"
            label={_(isWeb ? msg`Sign in with Bluesky` : msg`Next`)}
            accessibilityHint={_(
              isWeb
                ? msg`Start OAuth sign in with Bluesky`
                : msg`Navigates to the next screen`,
            )}
            variant="solid"
            color="primary"
            size="large"
            onPress={onPressNext}>
            <ButtonText>
              {isWeb ? (
                <Trans>Sign in with Bluesky</Trans>
              ) : (
                <Trans>Next</Trans>
              )}
            </ButtonText>
            {isProcessing && <ButtonIcon icon={Loader} />}
          </Button>
        )}
      </View>
    </FormContainer>
  )
}
