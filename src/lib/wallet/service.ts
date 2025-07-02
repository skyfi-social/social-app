import {type BskyAgent} from '@atproto/api'

import {
  type EthereumWallet,
  type EthereumWalletConnection,
  type ProfileWalletData,
  type Siwe,
  type SolanaWallet,
  type WalletConnection,
  type WalletDisplayInfo,
  type WalletType,
} from '#/types/wallet'

export async function getProfileWalletData(
  agent: BskyAgent,
  did: string,
): Promise<ProfileWalletData | null> {
  try {
    const walletData: ProfileWalletData = {}

    // Check for Solana wallet
    const solanaRecord = await agent.com.atproto.repo
      .getRecord({
        repo: did,
        collection: 'social.skyfi.wallet.solana',
        rkey: 'self',
      })
      .catch(() => null)

    if (solanaRecord?.data?.value) {
      const value = solanaRecord.data.value as any
      if (value.address) {
        walletData.solanaWallet = value as SolanaWallet
      }
    }

    // Check for Ethereum wallet
    const ethereumRecord = await agent.com.atproto.repo
      .getRecord({
        repo: did,
        collection: 'social.skyfi.wallet.ethereum',
        rkey: 'self',
      })
      .catch(() => null)

    if (ethereumRecord?.data?.value) {
      const value = ethereumRecord.data.value as any
      if (value.address) {
        walletData.ethereumWallet = value as EthereumWallet
      }
    }

    // Return data if any wallets found
    if (walletData.solanaWallet || walletData.ethereumWallet) {
      return walletData
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
  return !!(
    walletData?.solanaWallet?.address || walletData?.ethereumWallet?.address
  )
}

export async function addSolanaWalletToProfile(
  agent: BskyAgent,
  walletData: SolanaWallet,
): Promise<void> {
  await agent.com.atproto.repo.putRecord({
    repo: agent.session?.did || '',
    collection: 'social.skyfi.wallet.solana',
    rkey: 'self',
    record: {
      $type: 'social.skyfi.wallet.solana',
      ...walletData,
      createdAt: new Date().toISOString(),
    },
  })
}

export async function addEthereumWalletToProfile(
  agent: BskyAgent,
  walletData: EthereumWallet,
): Promise<void> {
  await agent.com.atproto.repo.putRecord({
    repo: agent.session?.did || '',
    collection: 'social.skyfi.wallet.ethereum',
    rkey: 'self',
    record: {
      $type: 'social.skyfi.wallet.ethereum',
      ...walletData,
      createdAt: new Date().toISOString(),
    },
  })
}

export async function removeWalletFromProfile(
  agent: BskyAgent,
  walletType: WalletType,
): Promise<void> {
  const collection =
    walletType === 'solana'
      ? 'social.skyfi.wallet.solana'
      : 'social.skyfi.wallet.ethereum'

  await agent.com.atproto.repo.deleteRecord({
    repo: agent.session?.did || '',
    collection,
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

export function generateSiweMessage(
  address: string,
  did: string,
  timestamp: number,
): {siwe: Siwe; message: string} {
  const {SiweMessage} = require('siwe')
  const {ethers} = require('ethers')

  // Ensure address is properly checksummed according to EIP-55
  const checksummedAddress = ethers.getAddress(address.toLowerCase())

  const issuedAt = new Date(timestamp).toISOString()
  const nonce = Math.random().toString(36).substring(2, 15)

  const siweMessage = new SiweMessage({
    domain: 'skyfi.social',
    address: checksummedAddress,
    statement: `Sign in to Skyfi to verify ownership of your Ethereum wallet for Bluesky profile ${did}`,
    uri: 'https://skyfi.social/',
    version: '1',
    chainId: 1, // Ethereum mainnet
    nonce,
    issuedAt,
  })

  const message = siweMessage.prepareMessage()

  const siwe: Siwe = {
    uri: siweMessage.uri,
    nonce: siweMessage.nonce,
    domain: siweMessage.domain,
    address: siweMessage.address,
    chainId: siweMessage.chainId,
    version: siweMessage.version,
    issuedAt: siweMessage.issuedAt,
    statement: siweMessage.statement,
  }

  return {siwe, message}
}

export async function verifySiweSignature(
  siweMessage: string,
  ethereumSignature: string,
): Promise<boolean> {
  try {
    console.log('Verifying SIWE signature...')
    console.log('SIWE message:', siweMessage)
    console.log('Ethereum signature:', ethereumSignature)

    const {SiweMessage} = require('siwe')

    // Parse the SIWE message
    const parsedSiweMessage = new SiweMessage(siweMessage)
    console.log('Expected Ethereum address:', parsedSiweMessage.address)

    // Use SIWE library's built-in verification which handles all the details
    const verificationResult = await parsedSiweMessage.verify({
      signature: ethereumSignature,
    })

    console.log('SIWE verification result:', verificationResult)

    if (verificationResult.success) {
      console.log('SIWE signature validation successful')
      return true
    } else {
      console.error('SIWE verification failed:', verificationResult.error)
      return false
    }
  } catch (siweError) {
    console.error('SIWE verification failed:', siweError)
    return false
  }
}

export async function verifySolanaWalletSignature(
  solanaPublicKey: string,
  verificationMessage: string,
  solanaSignature: string,
): Promise<boolean> {
  try {
    console.log('Verifying Solana wallet signature:', {
      solanaPublicKey,
      solanaPublicKeyLength: solanaPublicKey.length,
      verificationMessage,
      verificationMessageLength: verificationMessage.length,
      solanaSignature,
      solanaSignatureLength: solanaSignature.length,
    })

    // TODO: Implement proper Solana signature verification using @solana/web3.js
    // For now, keep basic validation
    console.log('Using basic validation for Solana signature')
    const isValid =
      solanaPublicKey.length > 0 &&
      solanaSignature.length > 0 &&
      verificationMessage.length > 0

    console.log('Solana signature validation result:', isValid)
    return isValid
  } catch (error) {
    console.error('Failed to verify Solana wallet signature:', error)
    return false
  }
}

declare global {
  interface Window {
    solana?: WalletConnection
    phantom?: {
      solana?: WalletConnection
    }
    ethereum?: {
      request: (args: {method: string; params?: any[]}) => Promise<any>
      isConnected?: () => boolean
      selectedAddress?: string | null
    }
  }
}

export function getAvailableSolanaWallet(): WalletConnection | null {
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

export function getAvailableEthereumWallet(): EthereumWalletConnection | null {
  if (typeof window === 'undefined') return null

  // Check for MetaMask or other Ethereum wallets
  if (window.ethereum) {
    const ethereum = window.ethereum
    const {ethers} = require('ethers')

    // Create a wrapper that adapts MetaMask API to our interface
    let initialAddress = ethereum.selectedAddress || ''
    if (initialAddress) {
      try {
        initialAddress = ethers.getAddress(initialAddress.toLowerCase())
      } catch (e) {
        initialAddress = ''
      }
    }

    return {
      address: initialAddress,
      connected: ethereum.isConnected?.() || false,

      async connect() {
        try {
          const {ethers} = require('ethers')

          // Request account access
          const accounts = await ethereum.request({
            method: 'eth_requestAccounts',
          })

          if (accounts && accounts.length > 0) {
            // Ensure address is properly checksummed according to EIP-55
            this.address = ethers.getAddress(accounts[0].toLowerCase())
            this.connected = true
          } else {
            throw new Error('No accounts returned from wallet')
          }
        } catch (error) {
          console.error('Failed to connect Ethereum wallet:', error)
          throw error
        }
      },

      async disconnect() {
        // MetaMask doesn't have a programmatic disconnect method
        // The user needs to disconnect through the extension
        this.connected = false
        this.address = ''
      },

      async signMessage(message: string): Promise<string> {
        if (!this.address) {
          throw new Error('Wallet not connected')
        }

        try {
          const signature = await ethereum.request({
            method: 'personal_sign',
            params: [message, this.address],
          })

          return signature
        } catch (error) {
          console.error('Failed to sign message:', error)
          throw error
        }
      },
    }
  }

  return null
}

export function getWalletDisplayInfo(
  walletData: ProfileWalletData,
): WalletDisplayInfo[] {
  const wallets: WalletDisplayInfo[] = []

  if (walletData.solanaWallet) {
    wallets.push({
      type: 'solana',
      address: walletData.solanaWallet.address,
      timestamp: walletData.solanaWallet.timestamp,
      displayName: 'Solana Wallet',
    })
  }

  if (walletData.ethereumWallet) {
    wallets.push({
      type: 'ethereum',
      address: walletData.ethereumWallet.address,
      timestamp: walletData.ethereumWallet.timestamp,
      displayName: 'Ethereum Wallet',
    })
  }

  return wallets
}
