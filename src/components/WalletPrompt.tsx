import {useEffect} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useHasWallet} from '#/lib/wallet/useWallet'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {WalletConnectionDialog} from './dialogs/WalletConnectionDialog'

export function WalletPrompt() {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const t = useTheme()

  const walletConnectionControl = Dialog.useDialogControl()

  const {data: hasWallet, isLoading} = useHasWallet(currentAccount?.did)

  // Auto-show wallet prompt if user doesn't have a wallet
  useEffect(() => {
    if (!isLoading && hasWallet === false && currentAccount?.did) {
      walletConnectionControl.open()
    }
  }, [hasWallet, isLoading, currentAccount?.did, walletConnectionControl])

  // Don't render anything if loading or user already has a wallet
  if (isLoading || hasWallet) {
    return null
  }

  return (
    <>
      <View
        style={[
          a.p_md,
          a.border,
          a.rounded_md,
          a.gap_sm,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_25,
        ]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Text style={[a.text_lg]}>💰</Text>
          <Text style={[a.font_bold, a.text_md]}>
            <Trans>Connect Your Solana Wallet</Trans>
          </Text>
        </View>

        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Add your Solana wallet to your profile to enable crypto features and
            prove ownership of your address.
          </Trans>
        </Text>

        <View style={[a.flex_row, a.gap_sm, a.mt_sm]}>
          <Button
            label={_(msg`Connect Wallet`)}
            variant="solid"
            color="primary"
            size="small"
            onPress={() => walletConnectionControl.open()}>
            <ButtonText>
              <Trans>Connect Wallet</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>

      <WalletConnectionDialog
        control={walletConnectionControl}
        walletType="solana"
        onWalletAdded={() => {
          // Refresh the wallet status
          window.location.reload()
        }}
      />
    </>
  )
}

export function useWalletPromptChecker() {
  const {currentAccount} = useSession()
  const {data: hasWallet, isLoading} = useHasWallet(currentAccount?.did)

  return {
    shouldShowPrompt: !isLoading && hasWallet === false,
    hasWallet,
    isLoading,
  }
}
