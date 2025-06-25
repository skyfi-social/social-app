import {useState} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {cleanError} from '#/lib/strings/errors'
import {useAddWalletMutation, useWalletConnection} from '#/lib/wallet/useWallet'
import {logger} from '#/logger'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export function WalletConnectionDialog({
  control,
  onWalletAdded,
}: {
  control: Dialog.DialogControlProps
  onWalletAdded?: () => void
}) {
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const t = useTheme()

  const [currentStep, setCurrentStep] = useState<
    'Connect' | 'Sign' | 'Success' | 'Error'
  >('Connect')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const {connectWallet} = useWalletConnection()
  const addWalletMutation = useAddWalletMutation()

  const uiStrings = {
    Connect: {
      title: _(msg`Connect Your Solana Wallet`),
      message: _(
        msg`To enable wallet features on your profile, please connect your Solana wallet. We support Phantom and other popular Solana wallets.`,
      ),
    },
    Sign: {
      title: _(msg`Sign Verification Message`),
      message: _(
        msg`Please sign the verification message with your wallet to prove ownership of your address.`,
      ),
    },
    Success: {
      title: _(msg`Wallet Connected!`),
      message: _(
        msg`Your Solana wallet has been successfully added to your profile.`,
      ),
    },
    Error: {
      title: _(msg`Connection Failed`),
      message: _(
        msg`We couldn't connect your wallet. Please make sure you have a Solana wallet installed and try again.`,
      ),
    },
  }

  const onConnectWallet = async () => {
    setError('')
    setIsProcessing(true)
    try {
      const walletConnection = await connectWallet()
      setCurrentStep('Sign')

      // Automatically proceed to signing
      await addWalletMutation.mutateAsync({walletConnection})
      setCurrentStep('Success')
      onWalletAdded?.()
    } catch (e: unknown) {
      // Check if user cancelled the transaction
      const errorMessage = cleanError(e)
      const isCancellation =
        errorMessage.toLowerCase().includes('user rejected') ||
        errorMessage.toLowerCase().includes('user denied') ||
        errorMessage.toLowerCase().includes('cancelled') ||
        errorMessage.toLowerCase().includes('canceled') ||
        errorMessage.toLowerCase().includes('user cancelled') ||
        (e as any)?.code === 4001 || // Standard wallet rejection code
        (e as any)?.message?.toLowerCase().includes('user rejected')

      if (isCancellation) {
        // User cancelled, just go back to connect step without showing error
        setCurrentStep('Connect')
      } else {
        // Actual error occurred
        logger.error('Failed to connect wallet:', {error: e})
        setError(errorMessage)
        setCurrentStep('Error')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const onRetry = () => {
    setError('')
    setCurrentStep('Connect')
  }

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={_(msg`Wallet connection dialog`)}
        style={web({maxWidth: 450})}>
        <View style={[a.gap_xl]}>
          <View
            style={[
              a.rounded_sm,
              a.align_center,
              a.justify_center,
              {height: 120},
              t.atoms.bg_contrast_100,
            ]}>
            <Text style={[a.text_5xl]}>💰</Text>
          </View>

          <View style={[a.gap_sm]}>
            <Text style={[a.font_heavy, a.text_2xl]}>
              {uiStrings[currentStep].title}
            </Text>

            {error ? (
              <View style={[a.rounded_sm, a.overflow_hidden]}>
                <ErrorMessage message={error} />
              </View>
            ) : null}

            <Text style={[a.text_md, a.leading_snug]}>
              {uiStrings[currentStep].message}
            </Text>

            {currentStep === 'Connect' && (
              <View style={[a.gap_sm]}>
                <Text
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Make sure you have Phantom or another Solana wallet
                    installed in your browser.
                  </Trans>
                </Text>
              </View>
            )}

            {currentStep === 'Sign' && (
              <View style={[a.gap_sm]}>
                <Text
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Your wallet will prompt you to sign a message. This proves
                    you own the wallet address.
                  </Trans>
                </Text>
              </View>
            )}
          </View>

          <View style={[a.gap_sm, gtMobile && [a.flex_row_reverse, a.ml_auto]]}>
            {currentStep === 'Connect' ? (
              <>
                <Button
                  label={_(msg`Connect Wallet`)}
                  variant="solid"
                  color="primary"
                  size="large"
                  disabled={isProcessing}
                  onPress={onConnectWallet}>
                  <ButtonText>
                    <Trans>Connect Wallet</Trans>
                  </ButtonText>
                  {isProcessing ? (
                    <Loader size="sm" style={[{color: 'white'}]} />
                  ) : null}
                </Button>
                <Button
                  label={_(msg`Maybe later`)}
                  variant="ghost"
                  color="secondary"
                  size="large"
                  disabled={isProcessing}
                  onPress={() => control.close()}>
                  <ButtonText>
                    <Trans>Maybe later</Trans>
                  </ButtonText>
                </Button>
              </>
            ) : currentStep === 'Sign' ? (
              <View style={[a.align_center]}>
                <Loader size="lg" />
                <Text
                  style={[a.text_sm, a.mt_sm, t.atoms.text_contrast_medium]}>
                  <Trans>Waiting for signature...</Trans>
                </Text>
              </View>
            ) : currentStep === 'Success' ? (
              <Button
                label={_(msg`Done`)}
                variant="solid"
                color="primary"
                size="large"
                onPress={() => control.close()}>
                <ButtonText>
                  <Trans>Done</Trans>
                </ButtonText>
              </Button>
            ) : currentStep === 'Error' ? (
              <>
                <Button
                  label={_(msg`Try Again`)}
                  variant="solid"
                  color="primary"
                  size="large"
                  onPress={onRetry}>
                  <ButtonText>
                    <Trans>Try Again</Trans>
                  </ButtonText>
                </Button>
                <Button
                  label={_(msg`Cancel`)}
                  variant="ghost"
                  color="secondary"
                  size="large"
                  onPress={() => control.close()}>
                  <ButtonText>
                    <Trans>Cancel</Trans>
                  </ButtonText>
                </Button>
              </>
            ) : null}
          </View>
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
