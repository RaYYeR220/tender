// The two rails PayBox can pay an x402 request on, and how each one is named
// by MoonPay Commerce (blockchain symbol), by x402 (CAIP-2) and by PayBox.

export type Rail = "solana" | "base";

export const RAILS: readonly Rail[] = ["solana", "base"];

export const NETWORK: Record<Rail, string> = {
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  base: "eip155:8453",
};

export const PAYBOX_CHAIN = {
  solana: "solana:mainnet",
  base: "eip155:8453",
} as const satisfies Record<Rail, string>;

export type PayboxChain = (typeof PAYBOX_CHAIN)[Rail];

export const USDC: Record<Rail, string> = {
  solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export const USDC_DECIMALS = 6;

export const EXPLORER: Record<Rail, (tx: string) => string> = {
  solana: (tx) => `https://solscan.io/tx/${tx}`,
  base: (tx) => `https://basescan.org/tx/${tx}`,
};

const HELIO_BLOCKCHAINS: Record<string, Rail> = { SOL: "solana", BASE: "base" };

export function railFromNetwork(network: string): Rail | null {
  if (network === NETWORK.solana || network === "solana" || network === "solana:mainnet") return "solana";
  if (network === NETWORK.base || network === "base") return "base";
  return null;
}

export function railFromHelioBlockchain(symbol: string): Rail | null {
  return HELIO_BLOCKCHAINS[symbol.toUpperCase()] ?? null;
}

export function isUsdc(rail: Rail, asset: string): boolean {
  return rail === "base" ? asset.toLowerCase() === USDC.base.toLowerCase() : asset === USDC.solana;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Length(value: string): number | null {
  let bytes: number[] = [];
  for (const char of value) {
    let carry = BASE58.indexOf(char);
    if (carry < 0) return null;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeros = 0;
  while (value[leadingZeros] === "1") leadingZeros++;
  return bytes.length + leadingZeros;
}

export function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) && base58Length(value) === 32;
}

export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function railFromAddress(address: string): Rail | null {
  if (isEvmAddress(address)) return "base";
  if (isSolanaAddress(address)) return "solana";
  return null;
}

export function isSolanaSignature(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(value) && base58Length(value) === 64;
}

export function isEvmTxHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
