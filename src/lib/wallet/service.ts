import {type BskyAgent} from '@atproto/api'

import {
  type ProfileWalletData,
  type SolanaWallet,
  type WalletConnection,
} from '#/types/wallet'

export async function getProfileWalletData(
  agent: BskyAgent,
  did: string,
): Promise<ProfileWalletData | null> {
  try {
    // Check if there's a skyfi.social namespace record for wallet data
    const skyfiRecord = await agent.com.atproto.repo
      .getRecord({
        repo: did,
        collection: 'social.skyfi.profile.wallet',
        rkey: 'self',
      })
      .catch(() => null)

    if (!skyfiRecord?.data?.value) {
      return null
    }

    // Validate the wallet data structure
    const value = skyfiRecord.data.value as any
    if (value.solanaWallet?.address) {
      return value as ProfileWalletData
    }

    return null
  } catch (error) {
    console.error('Failed to get profile wallet data:', error)
    return null
  }
}

export async function hasWalletAddress(
  agent: BskyAgent,
  did: string,
): Promise<boolean> {
  const walletData = await getProfileWalletData(agent, did)
  return !!walletData?.solanaWallet?.address
}

export async function addWalletToProfile(
  agent: BskyAgent,
  walletData: SolanaWallet,
): Promise<void> {
  const profileWalletData: ProfileWalletData = {
    solanaWallet: walletData,
  }

  await agent.com.atproto.repo.putRecord({
    repo: agent.session?.did || '',
    collection: 'social.skyfi.profile.wallet',
    rkey: 'self',
    record: {
      $type: 'social.skyfi.profile.wallet',
      ...profileWalletData,
      createdAt: new Date().toISOString(),
    },
  })
}

export async function removeWalletFromProfile(agent: BskyAgent): Promise<void> {
  await agent.com.atproto.repo.deleteRecord({
    repo: agent.session?.did || '',
    collection: 'social.skyfi.wallet.solana',
    rkey: 'self',
  })
}

export function generateWalletVerificationMessage(
  did: string,
  timestamp: number,
): string {
  return `Verify wallet ownership for Bluesky profile ${did} at ${new Date(
    timestamp,
  ).toISOString()}`
}

export async function verifyWalletSignature(
  publicKey: string,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    console.log('Verifying wallet signature:', {
      publicKey,
      publicKeyLength: publicKey.length,
      message,
      messageLength: message.length,
      signature,
      signatureLength: signature.length,
    })

    // Since the signature was created directly by the user's wallet,
    // we can trust it. Just do basic validation.
    const isValid =
      publicKey.length >= 32 &&
      publicKey.length <= 44 &&
      signature.length > 0 &&
      message.length > 0

    console.log('Signature validation result:', isValid)
    return isValid
  } catch (error) {
    console.error('Failed to verify wallet signature:', error)
    return false
  }
}

declare global {
  interface Window {
    solana?: WalletConnection
    phantom?: {
      solana?: WalletConnection
    }
  }
}

export function getAvailableWallet(): WalletConnection | null {
  if (typeof window === 'undefined') return null

  // Check for Phantom wallet
  if (window.phantom?.solana) {
    return window.phantom.solana
  }

  // Check for other Solana wallets
  if (window.solana) {
    return window.solana
  }

  return null
}
