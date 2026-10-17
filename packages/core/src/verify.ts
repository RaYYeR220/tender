import { type Rail, EXPLORER, USDC, isEvmTxHash, isSolanaSignature } from "./chains.js";
import { TenderError } from "./errors.js";
import { formatUsd } from "./money.js";
import type { Product } from "./product.js";
import { rpc, type RpcOptions } from "./rpc.js";

// A MoonPay Commerce x402 payment lands in a per-payer deposit wallet, which then
// sweeps the funds to the merchant's payout wallet minus processing fees. A
// receipt is verified hop by hop from chain data alone; nothing is stored.

export interface Transfer {
  tx: string;
  explorer: string;
  from: string;
  to: string;
  amount: string;
  amountUsd: string;
  at: number | null;
}

export interface ReceiptCheck {
  name: "PAYMENT_CONFIRMED" | "PAID_FROM_PAYER" | "PAID_IN_USDC" | "COVERS_PRICE" | "DEPOSIT_BOUND" | "MERCHANT_PAID" | "AMOUNTS_RECONCILE";
  ok: boolean | null;
  detail: string;
}

export interface Receipt {
  rail: Rail;
  status: "settled" | "swept" | "awaiting_sweep" | "unverified";
  payment: Transfer;
  sweep: { tx: string; explorer: string; at: number | null; merchant: Transfer | null; fees: Transfer[] } | null;
  checks: ReceiptCheck[];
}

interface SolTokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string };
}

interface SolInstruction {
  program?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
}

interface SolTransaction {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    preTokenBalances?: SolTokenBalance[];
    postTokenBalances?: SolTokenBalance[];
    innerInstructions?: { instructions: SolInstruction[] }[];
  } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: SolInstruction[];
    };
  };
}

interface SolTransferLeg {
  source: string;
  destination: string;
  authority: string;
  amount: string;
}

// Token-account address -> mint, for every token account the transaction touched.
function accountMints(tx: SolTransaction): Map<string, string> {
  const keys = tx.transaction.message.accountKeys;
  const mints = new Map<string, string>();
  for (const balance of [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]) {
    const account = keys[balance.accountIndex]?.pubkey;
    if (account) mints.set(account, balance.mint);
  }
  return mints;
}

// USDC movements only: transferChecked must name the USDC mint, and both token
// accounts of any transfer must be USDC accounts according to the balances.
function usdcLegs(tx: SolTransaction): SolTransferLeg[] {
  const all = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((group) => group.instructions)];
  const mints = accountMints(tx);
  const legs: SolTransferLeg[] = [];
  for (const ix of all) {
    const type = ix.parsed?.type;
    const info = ix.parsed?.info ?? {};
    if (ix.program !== "spl-token" || (type !== "transferChecked" && type !== "transfer")) continue;
    if (typeof info.source !== "string" || typeof info.destination !== "string") continue;
    if (type === "transferChecked" && info.mint !== USDC.solana) continue;
    if (mints.get(info.source) !== USDC.solana || mints.get(info.destination) !== USDC.solana) continue;
    const amount =
      typeof info.amount === "string"
        ? info.amount
        : typeof (info.tokenAmount as { amount?: unknown } | undefined)?.amount === "string"
          ? (info.tokenAmount as { amount: string }).amount
          : null;
    if (!amount) continue;
    const authority = typeof info.authority === "string" ? info.authority : typeof info.multisigAuthority === "string" ? info.multisigAuthority : "";
    legs.push({ source: info.source, destination: info.destination, authority, amount });
  }
  return legs;
}

// Token-account address -> owner wallet, for USDC accounts the transaction touched.
function usdcOwners(tx: SolTransaction): Map<string, string> {
  const keys = tx.transaction.message.accountKeys;
  const owners = new Map<string, string>();
  for (const balance of [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]) {
    if (balance.mint !== USDC.solana || !balance.owner) continue;
    const account = keys[balance.accountIndex]?.pubkey;
    if (account) owners.set(account, balance.owner);
  }
  return owners;
}

async function solTx(signature: string, options: RpcOptions): Promise<SolTransaction | null> {
  return rpc<SolTransaction | null>(
    "solana",
    "getTransaction",
    [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
    options,
  );
}

function transfer(rail: Rail, tx: string, from: string, to: string, amount: string, at: number | null): Transfer {
  return { tx, explorer: EXPLORER[rail](tx), from, to, amount, amountUsd: formatUsd(amount), at };
}

async function verifySolana(signature: string, payer: string, product: Product | null, options: RpcOptions, resolveDeposit?: DepositResolver): Promise<Receipt> {
  const tx = await solTx(signature, options);
  if (!tx) throw new TenderError("TX_NOT_FOUND", "Solana has no confirmed transaction with that signature yet.");
  const owners = usdcOwners(tx);
  const leg = usdcLegs(tx).find((l) => owners.get(l.source) === payer);
  if (!leg) throw new TenderError("NOT_A_PAYMENT", "That transaction moves no USDC out of payer_address.");
  const deposit = owners.get(leg.destination) ?? leg.destination;
  const payment = transfer("solana", signature, payer, deposit, leg.amount, tx.blockTime);

  const checks: ReceiptCheck[] = [
    { name: "PAYMENT_CONFIRMED", ok: tx.meta?.err == null, detail: tx.meta?.err == null ? "Confirmed on Solana." : "The transaction failed on chain." },
    { name: "PAID_FROM_PAYER", ok: true, detail: `${payment.amountUsd} USDC left ${payer}.` },
    { name: "PAID_IN_USDC", ok: true, detail: "Both token accounts hold native USDC (EPjF…Dt1v)." },
  ];

  // The sweep is the next transaction that spends the deposit token account.
  const history = await rpc<{ signature: string; slot: number; err: unknown }[]>(
    "solana",
    "getSignaturesForAddress",
    [leg.destination, { limit: 20, commitment: "confirmed" }],
    options,
  );
  const later = history.filter((h) => h.slot >= tx.slot && h.signature !== signature && h.err == null).reverse();
  let sweep: Receipt["sweep"] = null;
  for (const candidate of later.slice(0, 3)) {
    const sweepTx = await solTx(candidate.signature, options);
    if (!sweepTx) continue;
    const sweepOwners = usdcOwners(sweepTx);
    const outflows = usdcLegs(sweepTx).filter((l) => l.source === leg.destination);
    if (!outflows.length) continue;
    const payouts = new Set((product?.payout ?? []).filter((p) => p.rail === "solana").map((p) => p.address));
    const legs = outflows.map((o) => transfer("solana", candidate.signature, deposit, sweepOwners.get(o.destination) ?? o.destination, o.amount, sweepTx.blockTime));
    const merchant = legs.find((l) => payouts.has(l.to)) ?? null;
    sweep = { tx: candidate.signature, explorer: EXPLORER.solana(candidate.signature), at: sweepTx.blockTime, merchant, fees: legs.filter((l) => l !== merchant) };
    break;
  }
  return finish("solana", payment, sweep, checks, product, resolveDeposit);
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

interface EvmLog {
  address: string;
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
  logIndex: string;
}

// About one hour of Base blocks; MoonPay Commerce sweeps within minutes.
const SWEEP_WINDOW_BLOCKS = 1800n;

const topicAddress = (topic: string | undefined) => (topic ? `0x${topic.slice(26)}`.toLowerCase() : "");
const padTopic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;

async function blockTime(blockNumber: string, options: RpcOptions): Promise<number | null> {
  try {
    const block = await rpc<{ timestamp: string } | null>("base", "eth_getBlockByNumber", [blockNumber, false], options);
    return block ? Number(BigInt(block.timestamp)) : null;
  } catch {
    return null;
  }
}

async function verifyBase(hash: string, payer: string, product: Product | null, options: RpcOptions, resolveDeposit?: DepositResolver): Promise<Receipt> {
  const receipt = await rpc<{ status: string; blockNumber: string; logs: EvmLog[] } | null>("base", "eth_getTransactionReceipt", [hash], options);
  if (!receipt) throw new TenderError("TX_NOT_FOUND", "Base has no mined transaction with that hash yet.");
  const usdc = USDC.base.toLowerCase();
  const log = receipt.logs.find((l) => l.address.toLowerCase() === usdc && l.topics[0] === TRANSFER_TOPIC && topicAddress(l.topics[1]) === payer.toLowerCase());
  if (!log) throw new TenderError("NOT_A_PAYMENT", "That transaction moves no USDC out of payer_address.");
  const deposit = topicAddress(log.topics[2]);
  const at = await blockTime(receipt.blockNumber, options);
  const payment = transfer("base", hash, payer, deposit, BigInt(log.data).toString(), at);
  const checks: ReceiptCheck[] = [
    { name: "PAYMENT_CONFIRMED", ok: receipt.status === "0x1", detail: receipt.status === "0x1" ? "Mined on Base." : "The transaction reverted." },
    { name: "PAID_FROM_PAYER", ok: true, detail: `${payment.amountUsd} USDC left ${payer}.` },
    { name: "PAID_IN_USDC", ok: true, detail: "Asset is native USDC on Base." },
  ];
  const paymentBlock = BigInt(log.blockNumber);
  let outflows: EvmLog[];
  try {
    outflows = await rpc<EvmLog[]>(
      "base",
      "eth_getLogs",
      [{ address: USDC.base, topics: [TRANSFER_TOPIC, padTopic(deposit)], fromBlock: log.blockNumber, toBlock: `0x${(paymentBlock + SWEEP_WINDOW_BLOCKS).toString(16)}` }],
      options,
    );
  } catch {
    throw new TenderError("RPC_UNAVAILABLE", "Base RPC could not list the deposit wallet's transfers. Retry explicitly.");
  }
  const after = outflows.filter((l) => {
    const block = BigInt(l.blockNumber);
    return block > paymentBlock || (block === paymentBlock && BigInt(l.logIndex) > BigInt(log.logIndex));
  });
  let sweep: Receipt["sweep"] = null;
  const first = after[0];
  if (first) {
    const sweepAt = await blockTime(first.blockNumber, options);
    const payouts = new Set((product?.payout ?? []).filter((p) => p.rail === "base").map((p) => p.address.toLowerCase()));
    const legs = after
      .filter((l) => l.transactionHash === first.transactionHash)
      .map((l) => transfer("base", l.transactionHash, deposit, topicAddress(l.topics[2]), BigInt(l.data).toString(), sweepAt));
    const merchant = legs.find((l) => payouts.has(l.to)) ?? null;
    sweep = { tx: first.transactionHash, explorer: EXPLORER.base(first.transactionHash), at: sweepAt, merchant, fees: legs.filter((l) => l !== merchant) };
  }
  return finish("base", payment, sweep, checks, product, resolveDeposit);
}

export type DepositResolver = (rail: Rail, amountAtomic: string) => Promise<string | null>;

async function finish(
  rail: Rail,
  payment: Transfer,
  sweep: Receipt["sweep"],
  checks: ReceiptCheck[],
  product: Product | null,
  resolveDeposit?: DepositResolver,
): Promise<Receipt> {
  if (product?.pricing.mode === "fixed" && product.usdcPriced) {
    const covers = BigInt(payment.amount) >= BigInt(product.pricing.amount);
    checks.push({
      name: "COVERS_PRICE",
      ok: covers,
      detail: covers ? `Paid ${payment.amountUsd} against a ${formatUsd(product.pricing.amount)} price.` : `Paid ${payment.amountUsd}, less than the ${formatUsd(product.pricing.amount)} price.`,
    });
  }
  if (resolveDeposit) {
    const expected = await resolveDeposit(rail, payment.amount).catch(() => null);
    const same = expected !== null && (rail === "base" ? expected.toLowerCase() === payment.to.toLowerCase() : expected === payment.to);
    checks.push({
      name: "DEPOSIT_BOUND",
      ok: expected === null ? null : same,
      detail:
        expected === null
          ? "MoonPay Commerce did not re-issue this payer's deposit wallet for the pay link, so the binding is unconfirmed."
          : same
            ? "The receiving wallet is the deposit wallet MoonPay Commerce assigns this payer for this pay link."
            : "The receiving wallet is not this payer's deposit wallet for the pay link.",
    });
  }
  if (!sweep) {
    checks.push({ name: "MERCHANT_PAID", ok: null, detail: "The deposit wallet has not swept to the merchant yet; MoonPay Commerce sweeps within about two minutes." });
  } else if (sweep.merchant) {
    checks.push({ name: "MERCHANT_PAID", ok: true, detail: `${sweep.merchant.amountUsd} USDC reached the merchant's payout wallet listed on the pay link.` });
  } else if (
    product &&
    product.payout.length > 0 &&
    !product.payout.some((p) => p.rail === rail) &&
    checks.find((c) => c.name === "DEPOSIT_BOUND")?.ok === true
  ) {
    // The merchant is paid out on another chain; MoonPay Commerce converts the
    // funds, so the final hop cannot be traced from this chain's data.
    checks.push({
      name: "MERCHANT_PAID",
      ok: null,
      detail: `The merchant settles to ${product.payout.map((p) => p.rail).join(" or ") || "another chain"}; the converted payout is not traceable from ${rail} data.`,
    });
  } else {
    checks.push({
      name: "MERCHANT_PAID",
      ok: product ? false : null,
      detail: product ? "The sweep went to wallets not listed on this pay link." : "Pass the pay link to identify the merchant's payout wallet.",
    });
  }
  if (sweep) {
    const out = [sweep.merchant, ...sweep.fees].reduce((sum, t) => sum + (t ? BigInt(t.amount) : 0n), 0n);
    const reconciles = out === BigInt(payment.amount);
    checks.push({
      name: "AMOUNTS_RECONCILE",
      ok: reconciles,
      detail: reconciles ? `Sweep paid out exactly ${payment.amountUsd}.` : `Sweep paid out ${formatUsd(out.toString())} of ${payment.amountUsd}.`,
    });
  }
  const failed = checks.some((c) => c.ok === false);
  const bound = checks.find((c) => c.name === "DEPOSIT_BOUND")?.ok === true;
  const status = failed ? "unverified" : sweep?.merchant && bound ? "settled" : sweep ? "swept" : "awaiting_sweep";
  return { rail, status, payment, sweep, checks };
}

export async function verifyPayment(
  input: { tx: string; payer: string; product: Product | null; resolveDeposit?: DepositResolver },
  options: RpcOptions = {},
): Promise<Receipt> {
  if (isEvmTxHash(input.tx)) return verifyBase(input.tx, input.payer, input.product, options, input.resolveDeposit);
  if (isSolanaSignature(input.tx)) return verifySolana(input.tx, input.payer, input.product, options, input.resolveDeposit);
  throw new TenderError("INVALID_TX", "tx must be a Solana signature or a 0x Base transaction hash.");
}

// PayBox completes x402 payments through a gateway and does not hand the agent
// a transaction signature. Given the deposit wallet MoonPay Commerce assigns
// this payer for the pay link, the latest payment can be found on chain.
export async function findPayment(input: { rail: Rail; payer: string; deposit: string }, options: RpcOptions = {}): Promise<string | null> {
  if (input.rail === "solana") {
    const accounts = await rpc<{ value: { pubkey: string }[] }>(
      "solana",
      "getTokenAccountsByOwner",
      [input.deposit, { mint: USDC.solana }, { encoding: "jsonParsed", commitment: "confirmed" }],
      options,
    );
    for (const account of accounts.value.slice(0, 2)) {
      const history = await rpc<{ signature: string; err: unknown }[]>(
        "solana",
        "getSignaturesForAddress",
        [account.pubkey, { limit: 8, commitment: "confirmed" }],
        options,
      );
      for (const entry of history.filter((h) => h.err == null).slice(0, 4)) {
        const tx = await solTx(entry.signature, options);
        if (!tx) continue;
        const owners = usdcOwners(tx);
        if (usdcLegs(tx).some((l) => l.destination === account.pubkey && owners.get(l.source) === input.payer)) return entry.signature;
      }
    }
    return null;
  }
  const head = BigInt(await rpc<string>("base", "eth_blockNumber", [], options));
  const logs = await rpc<EvmLog[]>(
    "base",
    "eth_getLogs",
    [{
      address: USDC.base,
      topics: [TRANSFER_TOPIC, padTopic(input.payer), padTopic(input.deposit)],
      fromBlock: `0x${(head > 9000n ? head - 9000n : 0n).toString(16)}`,
      toBlock: "latest",
    }],
    options,
  );
  return logs.at(-1)?.transactionHash ?? null;
}
