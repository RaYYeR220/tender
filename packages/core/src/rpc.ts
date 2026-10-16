import { type Rail, USDC } from "./chains.js";
import type { Fetch } from "./helio.js";

// Minimal JSON-RPC readers for Solana and Base, so the plugin bundle stays small
// and every network host it touches is one we declared.

export interface RpcEndpoints {
  solana: string;
  base: string;
}

export const PUBLIC_RPC: RpcEndpoints = {
  solana: "https://api.mainnet-beta.solana.com",
  base: "https://mainnet.base.org",
};

export interface RpcOptions {
  fetch?: Fetch;
  timeoutMs?: number;
  endpoints?: RpcEndpoints;
}

export async function rpc<T>(rail: Rail, method: string, params: unknown[], options: RpcOptions = {}): Promise<T> {
  const endpoint = (options.endpoints ?? PUBLIC_RPC)[rail];
  const response = await (options.fetch ?? fetch)(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    redirect: "error",
    signal: AbortSignal.timeout(options.timeoutMs ?? 3_500),
  });
  if (!response.ok) throw new Error(`${rail} RPC answered HTTP ${response.status}`);
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(`${rail} RPC error: ${payload.error.message ?? "unknown"}`);
  return payload.result as T;
}

interface ParsedTokenAccount {
  account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } };
}

export async function usdcBalance(rail: Rail, owner: string, options: RpcOptions = {}): Promise<string | null> {
  try {
    if (rail === "solana") {
      const result = await rpc<{ value: ParsedTokenAccount[] }>(
        "solana",
        "getTokenAccountsByOwner",
        [owner, { mint: USDC.solana }, { encoding: "jsonParsed", commitment: "confirmed" }],
        options,
      );
      return result.value.reduce((sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n).toString();
    }
    const data = `0x70a08231${owner.slice(2).toLowerCase().padStart(64, "0")}`;
    const result = await rpc<string>("base", "eth_call", [{ to: USDC.base, data }, "latest"], options);
    return BigInt(result).toString();
  } catch {
    return null;
  }
}
