import {useCallback, useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'

import {useAgent, useSession} from '#/state/session'
import {
  type EthereumWallet,
  type EthereumWalletConnection,
  type SolanaWallet,
  type WalletConnection,
  type WalletType,
} from '#/types/wallet'
import {
  addEthereumWalletToProfile,
  addSolanaWalletToProfile,
  generateSiweMessage,
  generateWalletVerificationMessage,
  getAvailableEthereumWallet,
  getAvailableSolanaWallet,
  getProfileWalletData,
  hasWalletAddress,
  removeWalletFromProfile,
  verifySiweSignature,
  verifySolanaWalletSignature,
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

export function useSolanaWalletConnection() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const [connected, setConnected] = useState(false)

  const connectWallet = useCallback(async () => {
    const availableWallet = getAvailableSolanaWallet()
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

export function useEthereumWalletConnection() {
  const [wallet, setWallet] = useState<EthereumWalletConnection | null>(null)
  const [connected, setConnected] = useState(false)

  const connectWallet = useCallback(async () => {
    const availableWallet = getAvailableEthereumWallet()
    if (!availableWallet) {
      throw new Error(
        'No Ethereum wallet found. Please install MetaMask or another Ethereum wallet.',
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

export function useAddSolanaWalletMutation() {
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

      let signature: string
      if (typeof signatureResponse === 'string') {
        signature = signatureResponse
      } else if (signatureResponse instanceof Uint8Array) {
        // Handle Uint8Array response - convert to base64 safely
        const signatureArray = Array.from(signatureResponse)
        console.log('Signature array:', signatureArray)
        console.log('Signature array length:', signatureArray.length)

        // Use a safer approach for large arrays
        if (signatureArray.length > 1000) {
          // For very large arrays, process in chunks
          const chunks = []
          for (let i = 0; i < signatureArray.length; i += 1000) {
            chunks.push(
              String.fromCharCode(...signatureArray.slice(i, i + 1000)),
            )
          }
          signature = btoa(chunks.join(''))
        } else {
          signature = btoa(String.fromCharCode(...signatureArray))
        }
      } else if (
        signatureResponse &&
        typeof signatureResponse === 'object' &&
        'signature' in signatureResponse
      ) {
        // Handle wrapped response objects
        const wrappedResponse = signatureResponse as {
          signature: string | Uint8Array
        }
        signature =
          typeof wrappedResponse.signature === 'string'
            ? wrappedResponse.signature
            : btoa(
                String.fromCharCode(...Array.from(wrappedResponse.signature)),
              )
      } else {
        throw new Error('Unexpected signature response format')
      }
      console.log('Final signature:', signature)

      const publicKeyString = walletConnection.publicKey.toString()

      const isValid = await verifySolanaWalletSignature(
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

      await addSolanaWalletToProfile(agent, walletData)

      return walletData
    },
  })
}

export function useAddEthereumWalletMutation() {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useMutation({
    mutationFn: async ({
      walletConnection,
    }: {
      walletConnection: EthereumWalletConnection
    }) => {
      if (!currentAccount?.did) {
        throw new Error('No active session')
      }

      const timestamp = Date.now()
      const {siwe, message} = generateSiweMessage(
        walletConnection.address,
        currentAccount.did,
        timestamp,
      )

      const signature = await walletConnection.signMessage(message)
      console.log('Ethereum SIWE signature:', signature)

      const isValid = await verifySiweSignature(message, signature)

      if (!isValid) {
        throw new Error('Invalid wallet signature')
      }

      const walletData: EthereumWallet = {
        address: walletConnection.address,
        signature,
        timestamp,
        siwe,
      }

      await addEthereumWalletToProfile(agent, walletData)

      return walletData
    },
  })
}

export function useRemoveWalletMutation() {
  const agent = useAgent()

  return useMutation({
    mutationFn: async (walletType: WalletType) => {
      await removeWalletFromProfile(agent, walletType)
    },
  })
}

// Legacy hook for backward compatibility
export function useWalletConnection() {
  return useSolanaWalletConnection()
}

// Legacy hook for backward compatibility
export function useAddWalletMutation() {
  return useAddSolanaWalletMutation()
}
