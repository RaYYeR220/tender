import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  PAYBOX_CHAIN,
  TenderError,
  checkoutUrl,
  depositResolver,
  cleanText,
  evaluateCheckout,
  formatUsd,
  getPaylink,
  getQuote,
  hostedUrl,
  parseCheckoutRef,
  preflight,
  railFromAddress,
  toAtomic,
  usdcBalance,
  verifyPayment,
  type BlockerCode,
  type CheckoutRef,
  type Decision,
  type Finding,
  type Policy,
  type Product,
  type Quote,
  type Transfer,
} from "../../packages/core/src/index.js";
import { proposeX402 } from "./paybox.js";

const PROTOCOL_VERSION = "2026-07-28";
const VERSION = "0.1.0";
const SITE_URL = (process.env.TENDER_SITE_URL ?? "https://tender-checkout.vercel.app").replace(/\/$/, "");
const REGISTRY_URL = `${SITE_URL}/registry.json`;
// Merchant mode: the store owner lists their pay link ids in the PayBox portal.
const CATALOG = (process.env.TENDER_CATALOG ?? "").split(/[\s,]+/).map((id) => id.toLowerCase()).filter((id) => /^[a-f0-9]{24}$/.test(id));
const STORE_NAME = process.env.TENDER_STORE_NAME ? cleanText(process.env.TENDER_STORE_NAME, 60) : null;

const link = z.string().min(1).max(512).describe("A MoonPay Commerce pay link URL (moonpay.hel.io/pay/…), deposit link, or 24-character pay link id.");
const payer = z.string().min(32).max(64).describe("Public address of the PayBox wallet that will pay: a Solana address or a 0x Base address.");
const usd = z.string().regex(/^\$?(0|[1-9][0-9]{0,6})(\.[0-9]{1,6})?$/);
const rail = z.enum(["solana", "base"]);

const finding = z.object({ code: z.string(), message: z.string(), fix: z.string().optional() }).strict();
const merchant = z.object({
  name: z.string(),
  website: z.string().nullable(),
  x: z.string().nullable(),
  x_confirmed: z.boolean(),
  verified: z.boolean(),
  kyb_verified: z.boolean(),
}).strict();
const productShape = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string(),
  merchant,
  pricing: z.enum(["fixed", "dynamic"]),
  price: z.string().nullable(),
  currency: z.string(),
  rails: z.array(rail),
  required_customer_fields: z.array(z.string()),
  active: z.boolean(),
  single_use: z.boolean(),
}).strict();
const quoteShape = z.object({
  rail,
  amount_usd: z.string(),
  amount_atomic: z.string(),
  pay_to: z.string(),
}).strict();

function productView(product: Product, ref: CheckoutRef): z.infer<typeof productShape> {
  return {
    id: product.id,
    name: product.name,
    description: product.description.slice(0, 600),
    url: hostedUrl(ref),
    merchant: {
      name: product.merchant.name,
      website: product.merchant.website,
      x: product.merchant.twitter,
      x_confirmed: product.merchant.twitterConfirmed,
      verified: product.merchant.verified,
      kyb_verified: product.merchant.kybVerified,
    },
    pricing: product.pricing.mode,
    price:
      product.pricing.mode === "fixed"
        ? product.usdcPriced
          ? formatUsd(product.pricing.amount, product.pricing.currency.decimals)
          : `${product.pricing.amount} atomic ${product.pricing.currency.symbol}`
        : null,
    currency: product.pricing.currency.symbol,
    rails: product.rails,
    required_customer_fields: product.requiredFields,
    active: product.active,
    single_use: product.maxTransactions === 1,
  };
}

// Merchant text is already cleaned in core; quoting keeps it visibly separate
// from Tender's own wording when an agent reads the result.
function quoted(value: string): string {
  return JSON.stringify(value);
}

function lines(findings: Finding<string>[]): string {
  return findings.map((f) => `- ${f.code}: ${f.message}${f.fix ? ` Fix: ${f.fix}` : ""}`).join("\n");
}

function failure(error: unknown) {
  const message = error instanceof TenderError ? `${error.code}: ${error.message}` : "Tender could not complete this request. Retry explicitly.";
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

interface Gathered {
  ref: CheckoutRef;
  product: Product | null;
  early: Finding<BlockerCode>[];
  quote: Quote | null;
  balance: string | null;
}

// Pay link metadata comes first: when it already rules the checkout out, Tender
// refuses without asking MoonPay Commerce for a quote (its x402 endpoints allow
// ten requests a minute per IP). Otherwise the live quote and the payer's USDC
// balance are fetched together to stay inside the sandbox's 10-second budget.
async function gather(input: { link: string; payer?: string; amountUsd?: string; policy: Policy }): Promise<Gathered> {
  const ref = parseCheckoutRef(input.link);
  if (ref.kind === "charge") {
    throw new TenderError("UNSUPPORTED_CHECKOUT", "Charge links are browser checkouts. Ask the merchant for the pay link or an agent invoice.");
  }
  const payerRail = input.payer ? railFromAddress(input.payer) : null;
  if (input.payer && !payerRail) {
    throw new TenderError("INVALID_PAYER", "payer_address must be a Solana address or a 0x Base address.");
  }
  const amountAtomic = input.amountUsd ? toAtomic(input.amountUsd, 6) : undefined;
  const product = ref.kind === "paylink" ? await getPaylink(ref.id) : null;
  const early = preflight(product, input.amountUsd, input.policy);
  if (!input.payer || !payerRail || early.length > 0) return { ref, product, early, quote: null, balance: null };
  const [quote, balance] = await Promise.all([
    getQuote(checkoutUrl(ref, input.payer, product?.pricing.mode === "fixed" ? undefined : amountAtomic)),
    usdcBalance(payerRail, input.payer),
  ]);
  return { ref, product, early, quote, balance };
}

function createServer() {
  const server = new McpServer(
    { name: "tender", version: VERSION },
    { supportedProtocolVersions: [PROTOCOL_VERSION] },
  );

  server.registerTool(
    "find_merchants",
    {
      title: "Find MoonPay Commerce merchants",
      description:
        "Search the open Tender registry of MoonPay Commerce merchants whose checkouts accept agent payments in USDC. Returns pay links to pass to inspect_checkout or checkout. Read-only; moves no money.",
      inputSchema: z.object({
        query: z.string().max(120).optional().describe("Words to match against merchant, product, category and tags. Omit to browse."),
        limit: z.number().int().min(1).max(25).optional(),
      }).strict(),
      outputSchema: z.object({
        merchants: z.array(z.object({
          link: z.string(),
          title: z.string(),
          merchant: z.string(),
          category: z.string(),
          summary: z.string(),
          pricing: z.string(),
          rails: z.array(rail),
        }).strict()),
        registry: z.string(),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        const response = await fetch(REGISTRY_URL, { headers: { Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(4_000) });
        if (!response.ok) throw new TenderError("REGISTRY_UNAVAILABLE", "The Tender registry is unavailable. Retry explicitly.");
        const registry = registrySchema.parse(await response.json());
        const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const matches = registry.merchants
          .filter((m) => {
            const haystack = [m.title, m.merchant, m.category, m.summary, ...m.tags].join(" ").toLowerCase();
            return words.every((w) => haystack.includes(w));
          })
          .slice(0, limit ?? 10)
          .map((m) => ({
            link: `https://moonpay.hel.io/pay/${m.id}`,
            title: cleanText(m.title, 120),
            merchant: cleanText(m.merchant, 80),
            category: cleanText(m.category, 40),
            summary: cleanText(m.summary, 280),
            pricing: cleanText(m.pricing, 40),
            rails: m.rails,
          }));
        const text = matches.length
          ? matches.map((m) => `${quoted(m.title)} by ${quoted(m.merchant)} (${m.pricing}, ${m.rails.join("/")}): ${m.link}`).join("\n")
          : "No registered merchant matches. Any MoonPay Commerce pay link still works with inspect_checkout.";
        return { content: [{ type: "text", text }], structuredContent: { merchants: matches, registry: REGISTRY_URL } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "inspect_checkout",
    {
      title: "Inspect a MoonPay Commerce checkout",
      description:
        "Dry run before paying. Resolves a MoonPay Commerce pay link to the product, merchant and price, and with payer_address also fetches the live quote (fees included, chosen rail, recipient) and the payer's USDC balance, then lists every reason checkout would be refused. Moves no money and creates no payment request.",
      inputSchema: z.object({
        link,
        payer_address: payer.optional(),
        amount_usd: usd.optional().describe("For pay-what-you-want links: the amount in US dollars, e.g. \"0.25\"."),
        max_usd: usd.optional().describe("The most the user agreed to pay, in US dollars, fees included."),
      }).strict(),
      outputSchema: z.object({
        status: z.enum(["ready", "blocked", "needs_payer"]),
        product: productShape.nullable(),
        quote: quoteShape.nullable(),
        balance_usd: z.string().nullable(),
        blockers: z.array(finding),
        warnings: z.array(finding),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ link: input, payer_address, amount_usd, max_usd }) => {
      try {
        const policy: Policy = { maxUsd: max_usd ?? "1000000" };
        const g = await gather({ link: input, payer: payer_address, amountUsd: amount_usd, policy });
        const product = g.product ? productView(g.product, g.ref) : null;
        let decision: Decision | null = null;
        let blockers: Finding<string>[] = g.early;
        let warnings: Finding<string>[] = [];
        if (g.quote && payer_address) {
          decision = evaluateCheckout({ product: g.product, quote: g.quote, payer: payer_address, policy, requestedAmountUsd: amount_usd, balanceAtomic: g.balance });
          blockers = decision.ok ? [] : decision.blockers;
          warnings = decision.warnings;
        }
        const option = decision?.option ?? null;
        const status = blockers.length ? "blocked" : !payer_address ? "needs_payer" : "ready";
        const quote = option ? { rail: option.rail, amount_usd: formatUsd(option.amount), amount_atomic: option.amount, pay_to: option.payTo } : null;
        const balance = g.balance === null ? null : formatUsd(g.balance);

        const head = product
          ? [
              `Product (merchant-supplied): ${quoted(product.name)}`,
              `Merchant (merchant-supplied): ${quoted(product.merchant.name)}`,
              `MoonPay Commerce verification: ${product.merchant.verified ? "verified" : "not verified"}`,
              product.pricing === "fixed" ? `Price: ${product.price}` : "Price: pay what you want",
            ].join("\n")
          : "MoonPay Commerce deposit.";
        const body = [
          head,
          quote ? `Live quote: ${quote.amount_usd} USDC on ${quote.rail}, fees included.` : null,
          balance ? `Payer holds ${balance} USDC.` : null,
          status === "ready" ? "Ready: call checkout with the same link and a max_usd the user approved." : null,
          status === "needs_payer" ? "Pass payer_address to get the live quote." : null,
          blockers.length ? `Would be refused:\n${lines(blockers)}` : null,
          warnings.length ? `Notes:\n${lines(warnings)}` : null,
        ].filter(Boolean).join("\n");
        return { content: [{ type: "text", text: body }], structuredContent: { status, product, quote, balance_usd: balance, blockers, warnings } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "checkout",
    {
      title: "Pay a MoonPay Commerce checkout",
      description:
        "Proposes paying a MoonPay Commerce pay link or deposit in USDC on Solana or Base through PayBox's x402 flow. Tender re-fetches the live quote and refuses, with no proposal, if the total including fees exceeds max_usd, the link needs customer details, the merchant or link is inactive, the payer's chain is not offered, or the payer lacks USDC. On success PayBox shows the payment for approval, pays the merchant and returns the merchant's response; poll the PayBox request until it is terminal and never call checkout again to finish it.",
      inputSchema: z.object({
        link,
        payer_address: payer,
        max_usd: usd.describe("Required spending cap in US dollars, fees included. Tender refuses anything above it."),
        amount_usd: usd.optional().describe("Only for pay-what-you-want links and deposits: the amount in US dollars."),
        rail: rail.optional().describe("Force solana or base. Defaults to the payer address's chain."),
        require_verified_merchant: z.boolean().optional().describe("Refuse merchants that have not completed MoonPay Commerce verification."),
      }).strict(),
      outputSchema: z.object({
        order: z.object({
          product: z.string(),
          merchant: z.string(),
          amount_usd: z.string(),
          rail,
          pay_to: z.string(),
          link: z.string(),
        }).strict(),
        "io.paybox/transactionProposal": z.object({
          version: z.literal("1"),
          kind: z.literal("x402"),
          expiresAt: z.string(),
          chain: z.enum(["eip155:8453", "solana:mainnet"]),
          request: z.object({ url: z.string(), method: z.enum(["GET", "POST"]), body: z.json().optional() }).strict(),
          payment: z.object({ asset: z.string(), maxAmount: z.string() }).strict(),
        }).strict(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ link: input, payer_address, max_usd, amount_usd, rail: forced, require_verified_merchant }) => {
      try {
        const policy: Policy = { maxUsd: max_usd, rail: forced, requireVerifiedMerchant: require_verified_merchant };
        const g = await gather({ link: input, payer: payer_address, amountUsd: amount_usd, policy });
        const decision: Decision = g.quote
          ? evaluateCheckout({ product: g.product, quote: g.quote, payer: payer_address, policy, requestedAmountUsd: amount_usd, balanceAtomic: g.balance })
          : { ok: false, blockers: g.early, warnings: [], option: null };
        if (!decision.ok) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: `Refused. No payment was proposed.\n${lines(decision.blockers)}` }],
          };
        }
        const proposal = proposeX402({
          chain: PAYBOX_CHAIN[decision.option.rail],
          url: g.quote!.url,
          method: "POST",
          maxAmount: decision.amountAtomic,
        });
        const order = {
          product: g.product?.name ?? "MoonPay Commerce deposit",
          merchant: g.product?.merchant.name ?? "MoonPay Commerce merchant",
          amount_usd: decision.amountUsd,
          rail: decision.option.rail,
          pay_to: decision.option.payTo,
          link: hostedUrl(g.ref),
        };
        const notes = decision.warnings.length ? `\nNotes:\n${lines(decision.warnings)}` : "";
        return {
          content: [{
            type: "text",
            text: `Proposed ${order.amount_usd} USDC on ${order.rail} for product ${quoted(order.product)} from merchant ${quoted(order.merchant)} (names are merchant-supplied). PayBox will ask for approval; nothing is paid until then.${notes}`,
          }],
          structuredContent: { order, ...proposal.structuredContent },
        };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "list_catalog",
    {
      title: "Browse this store's catalog",
      description:
        "Lists the products of the MoonPay Commerce store this Tender install represents (configured by the store owner), with live price, rails and whether each one is payable by agents. Use checkout with a returned link to buy. Read-only.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({
        store: z.string().nullable(),
        products: z.array(z.object({
          link: z.string(),
          name: z.string(),
          merchant: z.string(),
          pricing: z.string(),
          rails: z.array(rail),
          agent_payable: z.boolean(),
          note: z.string().nullable(),
        }).strict()),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const ids = CATALOG.slice(0, 12);
        if (!ids.length) {
          return {
            content: [{ type: "text", text: "This install has no store catalog configured. Use find_merchants for the open registry, or pass any MoonPay Commerce pay link to checkout." }],
            structuredContent: { store: null, products: [] },
          };
        }
        const settled = await Promise.allSettled(ids.map((id) => getPaylink(id)));
        const products = settled.flatMap((result, i) => {
          if (result.status !== "fulfilled") return [];
          const p = result.value;
          const blocked = [...p.requiredFields.map((f) => `requires ${f}`), ...(p.active ? [] : [p.inactiveReason ?? "inactive"])];
          return [{
            link: `https://moonpay.hel.io/pay/${ids[i]}`,
            name: p.name,
            merchant: p.merchant.name,
            pricing: p.pricing.mode === "fixed" ? (p.usdcPriced ? formatUsd(p.pricing.amount) : `priced in ${p.pricing.currency.symbol}`) : "pay what you want",
            rails: p.rails,
            agent_payable: blocked.length === 0 && p.rails.length > 0,
            note: blocked.length ? blocked.join(", ") : null,
          }];
        });
        const text = products
          .map((p) => `${p.agent_payable ? "•" : "×"} ${quoted(p.name)} — ${p.pricing} on ${p.rails.join("/") || "no PayBox rail"}${p.note ? ` (${p.note})` : ""}: ${p.link}`)
          .join("\n");
        return { content: [{ type: "text", text: `${STORE_NAME ?? "Store"} catalog:\n${text}` }], structuredContent: { store: STORE_NAME, products } };
      } catch (error) {
        return failure(error);
      }
    },
  );

  const transferShape = z.object({
    tx: z.string(),
    explorer: z.string(),
    from: z.string(),
    to: z.string(),
    amount_usd: z.string(),
    at: z.string().nullable(),
  }).strict();
  const view = (t: Transfer) => ({
    tx: t.tx,
    explorer: t.explorer,
    from: t.from,
    to: t.to,
    amount_usd: t.amountUsd,
    at: t.at === null ? null : new Date(t.at * 1000).toISOString(),
  });

  server.registerTool(
    "verify_purchase",
    {
      title: "Verify a MoonPay Commerce payment on-chain",
      description:
        "Builds a receipt from chain data alone: confirms the USDC payment left payer_address, follows MoonPay Commerce's deposit wallet to the sweep, and with the pay link checks that the merchant's listed payout wallet received its share and that every unit is accounted for. Use the payment transaction from the finished PayBox request. Read-only.",
      inputSchema: z.object({
        tx: z.string().min(64).max(90).describe("Payment transaction: a Solana signature or a 0x Base transaction hash."),
        payer_address: payer,
        link: link.optional().describe("The pay link that was paid; needed to attribute the sweep to the merchant."),
      }).strict(),
      outputSchema: z.object({
        status: z.enum(["settled", "swept", "awaiting_sweep", "unverified"]),
        rail,
        payment: transferShape,
        merchant_received: transferShape.nullable(),
        fees: z.array(transferShape),
        checks: z.array(z.object({ name: z.string(), ok: z.boolean().nullable(), detail: z.string() }).strict()),
        receipt_url: z.string(),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ tx, payer_address, link: input }) => {
      try {
        if (!railFromAddress(payer_address)) throw new TenderError("INVALID_PAYER", "payer_address must be a Solana address or a 0x Base address.");
        const ref = input ? parseCheckoutRef(input) : null;
        const product = ref?.kind === "paylink" ? await getPaylink(ref.id) : null;
        const resolveDeposit = ref && ref.kind !== "charge" ? depositResolver(ref, payer_address, product) : undefined;
        const receipt = await verifyPayment({ tx, payer: payer_address, product, resolveDeposit });
        const params = new URLSearchParams({ payer: payer_address, ...(ref?.kind === "paylink" ? { link: ref.id } : {}) });
        const receiptUrl = `${SITE_URL}/r/${receipt.rail}/${tx}?${params}`;
        const marks = receipt.checks.map((c) => `${c.ok === true ? "OK" : c.ok === false ? "FAIL" : "PENDING"} ${c.name}: ${c.detail}`).join("\n");
        const text = [
          `Receipt ${receipt.status.toUpperCase()} on ${receipt.rail}: ${receipt.payment.amountUsd} USDC paid.`,
          receipt.sweep?.merchant ? `Merchant received ${receipt.sweep.merchant.amountUsd}.` : null,
          marks,
          `Shareable receipt: ${receiptUrl}`,
        ].filter(Boolean).join("\n");
        return {
          content: [{ type: "text", text }],
          structuredContent: {
            status: receipt.status,
            rail: receipt.rail,
            payment: view(receipt.payment),
            merchant_received: receipt.sweep?.merchant ? view(receipt.sweep.merchant) : null,
            fees: (receipt.sweep?.fees ?? []).map(view),
            checks: receipt.checks,
            receipt_url: receiptUrl,
          },
        };
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

const registrySchema = z.object({
  version: z.literal(1),
  merchants: z.array(z.object({
    id: z.string().regex(/^[a-f0-9]{24}$/),
    title: z.string(),
    merchant: z.string(),
    category: z.string(),
    summary: z.string(),
    pricing: z.string(),
    rails: z.array(rail),
    tags: z.array(z.string()),
  }).passthrough()),
}).passthrough();

serveStdio(createServer, { legacy: "reject" });
