import {z} from 'zod'

export type WalletType = 'solana' | 'ethereum'

export const SolanaWalletSchema = z.object({
  address: z.string().min(32).max(44), // Base58 encoded Solana public key
  signature: z.string(), // Signed message attestation
  timestamp: z.number(), // When the wallet was verified
  message: z.string(), // The message that was signed
})

export const SiweSchema = z.object({
  uri: z.string(),
  nonce: z.string(),
  domain: z.string(),
  address: z.string(),
  chainId: z.number(),
  version: z.string(),
  issuedAt: z.string(),
  statement: z.string().optional(),
})

export const EthereumWalletSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'), // Hex encoded Ethereum address
  signature: z.string(), // Signed SIWE message attestation
  timestamp: z.number(), // When the wallet was verified
  siwe: SiweSchema, // The SIWE message that was signed
})

export type SolanaWallet = z.infer<typeof SolanaWalletSchema>
export type EthereumWallet = z.infer<typeof EthereumWalletSchema>
export type Siwe = z.infer<typeof SiweSchema>

export interface WalletConnection {
  publicKey: string
  signMessage: (message: Uint8Array | string) => Promise<Uint8Array | string>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  connected: boolean
}

export interface EthereumWalletConnection {
  address: string
  signMessage: (message: string) => Promise<string>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  connected: boolean
}

export interface ProfileWalletData {
  solanaWallet?: SolanaWallet
  ethereumWallet?: EthereumWallet
}

export const ProfileWalletDataSchema = z.object({
  solanaWallet: SolanaWalletSchema.optional(),
  ethereumWallet: EthereumWalletSchema.optional(),
})

export interface WalletDisplayInfo {
  type: WalletType
  address: string
  timestamp: number
  displayName: string
}
