import { readFileSync } from "node:fs";
import { normalizePaylink, type Product } from "../src/product.js";
import { parseQuote, type Quote } from "../src/quote.js";

export const PAYER_SOL = "7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts";
export const PAYER_EVM = "0xb391F395d54dbfCe10ac75C321F97Cdc348aB8c3";

export const IDS = {
  tipJar: "695cb05415de374626355640",
  registration: "6aca53da3f07606bfe526138",
  scanner: "6a9358d423f54aeb74d19151",
  sponsor: "6968c9646c87f5d568aac432",
  botPlan: "663e178abcab89f49f95d889",
} as const;

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

export function product(id: string): Product {
  return normalizePaylink(fixture(`paylink-${id}.json`));
}

export function quote402(): Quote {
  const f = fixture("quote-402.json") as { paymentRequired: string };
  return parseQuote("https://api.hel.io/v1/x402/checkout/x", 402, f.paymentRequired, '{"message":"Http Exception","code":402}');
}

export function quoteWith(options: { rail: "solana" | "base"; amount: string }[]): Quote {
  return {
    ok: true,
    url: "https://api.hel.io/v1/x402/checkout/x",
    x402Version: 2,
    description: null,
    otherNetworks: [],
    options: options.map((o) => ({
      rail: o.rail,
      network: o.rail === "solana" ? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" : "eip155:8453",
      amount: o.amount,
      asset: o.rail === "solana" ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: o.rail === "solana" ? "2riiUj78ZtQtKbecrLFb6A4uznGAyWCBcXEh1e5Tto8s" : "0x1111111111111111111111111111111111111111",
      feePayer: null,
      maxTimeoutSeconds: 60,
    })),
  };
}
