import {useCallback} from 'react'
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
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import * as SettingsList from './components/SettingsList'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'WalletSettings'>
export function WalletSettingsScreen({}: Props) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {data: walletData, error, refetch} = useWalletQuery(currentAccount?.did)
  const walletConnectionControl = useDialogControl()
  const deleteWalletControl = useDialogControl()
  const removeWalletMutation = useRemoveWalletMutation()
  const {gtMobile} = useBreakpoints()
  const t = useTheme()

  const onDeleteWallet = useCallback(async () => {
    try {
      await removeWalletMutation.mutateAsync()
      Toast.show(_(msg`Wallet removed`))
      refetch()
    } catch (e: any) {
      Toast.show(_(msg`Failed to remove wallet: ${cleanError(e)}`))
    }
  }, [_, refetch, removeWalletMutation])

  const formatWalletAddress = (address: string) => {
    // Show full address on larger screens
    if (gtMobile) return address
    // Truncate on smaller screens
    if (address.length <= 8) return address
    return `${address.slice(0, 4)}...${address.slice(-4)}`
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
                  Connect your Solana wallet to enable crypto features and prove
                  ownership of your address.
                </Trans>
              </Admonition>
            </SettingsList.Item>
            <SettingsList.Item>
              <Button
                label={_(msg`Add Solana Wallet`)}
                size="large"
                color="primary"
                variant="solid"
                onPress={() => walletConnectionControl.open()}
                style={[a.flex_1]}>
                <ButtonIcon icon={PlusIcon} position="left" />
                <ButtonText>
                  <Trans>Add Solana Wallet</Trans>
                </ButtonText>
              </Button>
            </SettingsList.Item>
            {walletData?.solanaWallet && (
              <SettingsList.Item>
                <LayoutAnimationConfig skipEntering>
                  <Animated.View
                    entering={!isWeb ? FadeIn : undefined}
                    exiting={!isWeb ? StretchOutY.duration(200) : undefined}
                    layout={!isWeb ? LinearTransition.duration(150) : undefined}
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
                        <Text style={[a.font_bold, a.text_md]}>
                          Solana Wallet
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            copyAddressToClipboard(
                              walletData.solanaWallet.address,
                            )
                          }
                          style={[a.mt_xs]}>
                          <Text
                            style={[a.text_sm, {color: t.palette.primary_500}]}>
                            Address:{' '}
                            {formatWalletAddress(
                              walletData.solanaWallet.address,
                            )}
                          </Text>
                        </Pressable>
                        <Text
                          style={[a.text_sm, {color: t.palette.contrast_500}]}>
                          Added:{' '}
                          {formatDateTime(walletData.solanaWallet.timestamp)}
                        </Text>
                      </View>
                      <Button
                        label={_(msg`Delete wallet`)}
                        size="small"
                        color="negative"
                        variant="ghost"
                        onPress={() => deleteWalletControl.open()}>
                        <ButtonIcon icon={TrashIcon} />
                      </Button>
                    </View>
                  </Animated.View>
                </LayoutAnimationConfig>
              </SettingsList.Item>
            )}
            {!walletData?.solanaWallet && (
              <SettingsList.Item>
                <EmptyState
                  icon="💰"
                  message={_(msg`No wallet connected`)}
                  testID="walletListEmpty"
                />
              </SettingsList.Item>
            )}
          </SettingsList.Container>
        )}
        <WalletConnectionDialog
          control={walletConnectionControl}
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
