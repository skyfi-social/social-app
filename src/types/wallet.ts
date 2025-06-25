import {z} from 'zod'

export const SolanaWalletSchema = z.object({
  address: z.string().min(32).max(44), // Base58 encoded Solana public key
  signature: z.string(), // Signed message attestation
  timestamp: z.number(), // When the wallet was verified
  message: z.string(), // The message that was signed
})

export type SolanaWallet = z.infer<typeof SolanaWalletSchema>

export interface WalletConnection {
  publicKey: string
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  connected: boolean
}

export interface ProfileWalletData {
  solanaWallet?: SolanaWallet
}

export const ProfileWalletDataSchema = z.object({
  solanaWallet: SolanaWalletSchema.optional(),
})
