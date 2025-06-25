import {useCallback, useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'

import {useAgent, useSession} from '#/state/session'
import {type SolanaWallet, type WalletConnection} from '#/types/wallet'
import {
  addWalletToProfile,
  generateWalletVerificationMessage,
  getAvailableWallet,
  getProfileWalletData,
  hasWalletAddress,
  removeWalletFromProfile,
  verifyWalletSignature,
} from './service'

export function useWalletQuery(did?: string) {
  const agent = useAgent()

  return useQuery({
    queryKey: ['wallet', did],
    queryFn: async () => {
      if (!did) return null
      return getProfileWalletData(agent, did)
    },
    enabled: !!did,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useHasWallet(did?: string) {
  const agent = useAgent()

  return useQuery({
    queryKey: ['hasWallet', did],
    queryFn: async () => {
      if (!did) return false
      return hasWalletAddress(agent, did)
    },
    enabled: !!did,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useWalletConnection() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const [connected, setConnected] = useState(false)

  const connectWallet = useCallback(async () => {
    const availableWallet = getAvailableWallet()
    if (!availableWallet) {
      throw new Error(
        'No Solana wallet found. Please install Phantom or another Solana wallet.',
      )
    }

    await availableWallet.connect()
    setWallet(availableWallet)
    setConnected(true)

    return availableWallet
  }, [])

  const disconnectWallet = useCallback(async () => {
    if (wallet) {
      await wallet.disconnect()
    }
    setWallet(null)
    setConnected(false)
  }, [wallet])

  return {
    wallet,
    connected,
    connectWallet,
    disconnectWallet,
  }
}

export function useAddWalletMutation() {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useMutation({
    mutationFn: async ({
      walletConnection,
    }: {
      walletConnection: WalletConnection
    }) => {
      if (!currentAccount?.did) {
        throw new Error('No active session')
      }

      const timestamp = Date.now()
      const message = generateWalletVerificationMessage(
        currentAccount.did,
        timestamp,
      )
      const messageBytes = new TextEncoder().encode(message)

      const signatureResponse = await walletConnection.signMessage(messageBytes)
      console.log('Raw signature response:', signatureResponse)

      const signatureArray = signatureResponse.signature
      console.log('Signature array:', signatureArray)
      console.log('Signature array length:', signatureArray.length)

      const signature = btoa(String.fromCharCode(...signatureArray))
      console.log('Final signature:', signature)

      const publicKeyString = walletConnection.publicKey.toString()

      const isValid = await verifyWalletSignature(
        publicKeyString,
        message,
        signature,
      )

      if (!isValid) {
        throw new Error('Invalid wallet signature')
      }

      const walletData: SolanaWallet = {
        address: publicKeyString,
        signature,
        timestamp,
        message,
      }

      await addWalletToProfile(agent, walletData)

      return walletData
    },
  })
}

export function useRemoveWalletMutation() {
  const agent = useAgent()

  return useMutation({
    mutationFn: async () => {
      await removeWalletFromProfile(agent)
    },
  })
}
