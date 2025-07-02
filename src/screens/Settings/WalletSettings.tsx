import React, {useCallback} from 'react'
import {Pressable, View} from 'react-native'
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  LinearTransition,
  StretchOutY,
} from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {getWalletDisplayInfo} from '#/lib/wallet/service'
import {useRemoveWalletMutation, useWalletQuery} from '#/lib/wallet/useWallet'
import {isWeb} from '#/platform/detection'
import {useSession} from '#/state/session'
import {EmptyState} from '#/view/com/util/EmptyState'
import {ErrorScreen} from '#/view/com/util/error/ErrorScreen'
import * as Toast from '#/view/com/util/Toast'
import {useBreakpoints} from '#/alf'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {WalletConnectionDialog} from '#/components/dialogs/WalletConnectionDialog'
import {EthereumLogo} from '#/components/icons/EthereumLogo'
import {SolanaLogo} from '#/components/icons/SolanaLogo'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {type WalletType} from '#/types/wallet'
import * as SettingsList from './components/SettingsList'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'WalletSettings'>
export function WalletSettingsScreen({}: Props) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {data: walletData, error, refetch} = useWalletQuery(currentAccount?.did)
  const solanaWalletConnectionControl = useDialogControl()
  const ethereumWalletConnectionControl = useDialogControl()
  const deleteWalletControl = useDialogControl()
  const removeWalletMutation = useRemoveWalletMutation()
  const {gtMobile} = useBreakpoints()
  const t = useTheme()

  const [walletToDelete, setWalletToDelete] = React.useState<WalletType | null>(
    null,
  )

  const onDeleteWallet = useCallback(async () => {
    if (!walletToDelete) return

    try {
      await removeWalletMutation.mutateAsync(walletToDelete)
      Toast.show(_(msg`Wallet removed`))
      refetch()
      setWalletToDelete(null)
    } catch (e: any) {
      Toast.show(_(msg`Failed to remove wallet: ${cleanError(e)}`))
    }
  }, [_, refetch, removeWalletMutation, walletToDelete])

  const formatWalletAddress = (address: string) => {
    // Show full address on larger screens
    if (gtMobile) return address
    // Truncate on smaller screens
    if (address.length <= 8) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    )
  }

  const copyAddressToClipboard = useCallback(
    async (address: string) => {
      try {
        await Clipboard.setStringAsync(address)
        Toast.show(_(msg`Address copied to clipboard`))
      } catch (e) {
        Toast.show(_(msg`Failed to copy address`))
      }
    },
    [_],
  )

  const handleDeleteWallet = useCallback(
    (walletType: WalletType) => {
      setWalletToDelete(walletType)
      deleteWalletControl.open()
    },
    [deleteWalletControl],
  )

  const wallets = walletData ? getWalletDisplayInfo(walletData) : []
  const hasWallets = wallets.length > 0

  return (
    <Layout.Screen testID="WalletSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Wallet</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        {error ? (
          <ErrorScreen
            title={_(msg`Oops!`)}
            message={_(msg`There was an issue fetching your wallet data`)}
            details={cleanError(error)}
          />
        ) : (
          <SettingsList.Container>
            <SettingsList.Item>
              <Admonition type="tip" style={[a.flex_1]}>
                <Trans>
                  Connect your crypto wallets to enable crypto features and
                  prove ownership of your addresses.
                </Trans>
              </Admonition>
            </SettingsList.Item>

            {/* Connect Wallet Buttons */}
            <SettingsList.Item>
              <Button
                label={_(msg`Connect Solana`)}
                size="large"
                color="primary"
                variant="solid"
                onPress={() => solanaWalletConnectionControl.open()}
                style={[a.w_full]}>
                <SolanaLogo width={24} />
                <ButtonText>
                  <Trans>Connect Solana</Trans>
                </ButtonText>
              </Button>
            </SettingsList.Item>
            <SettingsList.Item>
              <Button
                label={_(msg`Connect Ethereum`)}
                size="large"
                color="primary"
                variant="solid"
                onPress={() => ethereumWalletConnectionControl.open()}
                style={[a.w_full]}>
                <EthereumLogo width={20} />
                <ButtonText>
                  <Trans>Connect Ethereum</Trans>
                </ButtonText>
              </Button>
            </SettingsList.Item>

            {/* Connected Wallets and Empty State */}
            <LayoutAnimationConfig skipEntering skipExiting>
              {hasWallets ? (
                wallets.map(wallet => (
                  <SettingsList.Item key={`${wallet.type}-${wallet.address}`}>
                    <Animated.View
                      entering={!isWeb ? FadeIn : undefined}
                      exiting={!isWeb ? StretchOutY.duration(200) : undefined}
                      layout={
                        !isWeb ? LinearTransition.duration(150) : undefined
                      }
                      style={[a.w_full]}>
                      <View
                        style={[
                          a.flex_row,
                          a.align_center,
                          a.gap_md,
                          a.px_lg,
                          a.py_md,
                          a.border,
                          a.rounded_md,
                          {borderColor: t.palette.contrast_200},
                        ]}>
                        <View style={[a.flex_1]}>
                          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                            {wallet.type === 'solana' ? (
                              <SolanaLogo width={24} />
                            ) : (
                              <EthereumLogo width={20} />
                            )}
                            <Text style={[a.font_bold, a.text_md]}>
                              {wallet.displayName}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              copyAddressToClipboard(wallet.address)
                            }
                            style={[a.mt_xs]}>
                            <Text
                              style={[
                                a.text_sm,
                                {color: t.palette.primary_500},
                              ]}>
                              Address: {formatWalletAddress(wallet.address)}
                            </Text>
                          </Pressable>
                          <Text
                            style={[
                              a.text_sm,
                              {color: t.palette.contrast_500},
                            ]}>
                            Added: {formatDateTime(wallet.timestamp)}
                          </Text>
                        </View>
                        <Button
                          label={_(
                            msg`Delete ${wallet.displayName.toLowerCase()}`,
                          )}
                          size="small"
                          color="negative"
                          variant="ghost"
                          onPress={() => handleDeleteWallet(wallet.type)}>
                          <ButtonIcon icon={TrashIcon} />
                        </Button>
                      </View>
                    </Animated.View>
                  </SettingsList.Item>
                ))
              ) : (
                <>
                  <SettingsList.Divider />
                  <EmptyState
                    icon="wallet"
                    message={_(msg`No wallets connected`)}
                  />
                </>
              )}
            </LayoutAnimationConfig>
          </SettingsList.Container>
        )}

        {/* Dialogs */}
        <WalletConnectionDialog
          control={solanaWalletConnectionControl}
          walletType="solana"
          onWalletAdded={() => {
            refetch()
          }}
        />
        <WalletConnectionDialog
          control={ethereumWalletConnectionControl}
          walletType="ethereum"
          onWalletAdded={() => {
            refetch()
          }}
        />
        <Prompt.Basic
          control={deleteWalletControl}
          title={_(msg`Delete wallet`)}
          description={_(
            msg`Are you sure you want to remove this wallet from your profile? This cannot be undone.`,
          )}
          onConfirm={onDeleteWallet}
          confirmButtonCta={_(msg`Delete`)}
          confirmButtonColor="negative"
        />
      </Layout.Content>
    </Layout.Screen>
  )
}
