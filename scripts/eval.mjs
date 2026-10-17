// Guard scorecard: runs the built plugin against live MoonPay Commerce checkouts
// and checks that every scenario ends the way it must. A proposal where a refusal
// was expected is a hard failure. Usage: node scripts/eval.mjs [--json]
import { call } from "./call.mjs";

const SOL = "7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts";
const EVM = "0xb391F395d54dbfCe10ac75C321F97Cdc348aB8c3";
const TIP = "6ad323579a3d621ed01812b8";
const FIELDS = "6ad323588eb58f1259a0ae16";
const FIXED = "6ad323565c71e316b383ea8a";
const UNVERIFIED = "695cb05415de374626355640";

const scenarios = [
  { name: "pay-what-you-want within cap", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "0.50", amount_usd: "0.25" }, expect: "proposal" },
  { name: "hosted pay link URL form", tool: "checkout", args: { link: `https://moonpay.hel.io/pay/${TIP}`, payer_address: SOL, max_usd: "0.30", amount_usd: "0.25" }, expect: "proposal" },
  { name: "exactly at the cap", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "0.25", amount_usd: "0.25" }, expect: "proposal" },
  { name: "one cent over the cap", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "0.24", amount_usd: "0.25" }, expect: "OVER_BUDGET" },
  { name: "cap far below price", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "0.01", amount_usd: "0.25" }, expect: "OVER_BUDGET" },
  { name: "more than the wallet holds", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "50", amount_usd: "40" }, expect: "INSUFFICIENT_FUNDS" },
  { name: "requires email, name, address", tool: "checkout", args: { link: FIELDS, payer_address: SOL, max_usd: "100" }, expect: "REQUIRES_CUSTOMER_DETAILS" },
  { name: "pay-what-you-want without amount", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "1" }, expect: "AMOUNT_REQUIRED" },
  { name: "fixed price with an amount", tool: "checkout", args: { link: FIXED, payer_address: SOL, max_usd: "5", amount_usd: "0.10" }, expect: "AMOUNT_NOT_ADJUSTABLE" },
  { name: "Base wallet on a Solana-only checkout", tool: "checkout", args: { link: TIP, payer_address: EVM, max_usd: "1", amount_usd: "0.25" }, expect: "RAIL_UNAVAILABLE" },
  { name: "forced rail disagrees with payer", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "1", amount_usd: "0.25", rail: "base" }, expect: "RAIL_UNAVAILABLE|INVALID_PAYER" },
  { name: "verified merchant passes strict policy", tool: "checkout", args: { link: FIXED, payer_address: SOL, max_usd: "0.50", require_verified_merchant: true }, expect: "proposal" },
  { name: "unverified merchant under strict policy", tool: "checkout", args: { link: UNVERIFIED, payer_address: SOL, max_usd: "1", amount_usd: "0.25", require_verified_merchant: true }, expect: "MERCHANT_UNVERIFIED" },
  { name: "amount below network fee floor", tool: "checkout", args: { link: TIP, payer_address: SOL, max_usd: "1", amount_usd: "0.01" }, expect: "NETWORK_FEES_TOO_HIGH|AMOUNT_TOO_SMALL" },
  { name: "unknown pay link", tool: "checkout", args: { link: "0123456789abcdef01234567", payer_address: SOL, max_usd: "1" }, expect: "LINK_NOT_FOUND" },
  { name: "foreign host", offline: true, tool: "checkout", args: { link: `https://evil.example/pay/${TIP}`, payer_address: SOL, max_usd: "1", amount_usd: "0.25" }, expect: "INVALID_REFERENCE" },
  { name: "path traversal attempt", offline: true, tool: "checkout", args: { link: "https://moonpay.hel.io/pay/../charge/api-key", payer_address: SOL, max_usd: "1" }, expect: "INVALID_REFERENCE" },
  { name: "malformed payer", offline: true, tool: "checkout", args: { link: TIP, payer_address: "0x" + "z".repeat(40), max_usd: "1", amount_usd: "0.25" }, expect: "INVALID_PAYER" },
  { name: "charge link (browser checkout)", offline: true, tool: "checkout", args: { link: "https://moonpay.hel.io/charge/2ac13665-9cfe-4466-b294-05069d57b0a2", payer_address: SOL, max_usd: "1" }, expect: "UNSUPPORTED_CHECKOUT" },
  { name: "missing cap is a schema error", offline: true, tool: "checkout", args: { link: TIP, payer_address: SOL, amount_usd: "0.25" }, expect: "schema" },
  { name: "dry run reports ready", tool: "inspect_checkout", args: { link: TIP, payer_address: SOL, amount_usd: "0.25", max_usd: "0.50" }, expect: "ready" },
  { name: "dry run reports blocked", tool: "inspect_checkout", args: { link: FIELDS, payer_address: SOL, max_usd: "100" }, expect: "blocked" },
];

function outcome(message) {
  if (message.error) return { kind: "schema", detail: message.error.message };
  const r = message.result;
  const proposal = r?.structuredContent?.["io.paybox/transactionProposal"];
  if (proposal) return { kind: "proposal", detail: `${proposal.payment.maxAmount} atomic USDC on ${proposal.chain}` };
  if (r?.structuredContent?.status === "refused") return { kind: r.structuredContent.blockers.map((b) => b.code).join(","), detail: r.content?.[0]?.text?.split("\n")[1] ?? "" };
  if (r?.structuredContent?.status) return { kind: r.structuredContent.status, detail: (r.structuredContent.blockers ?? []).map((b) => b.code).join(",") };
  const text = r?.content?.[0]?.text ?? "";
  if (r?.isError && /^Input validation error|Invalid arguments|validation/i.test(text)) return { kind: "schema", detail: text.slice(0, 80) };
  const codes = [...text.matchAll(/(?:^|- )([A-Z][A-Z_]{3,}):/gm)].map((m) => m[1]);
  return { kind: codes.join(",") || "error", detail: text.split("\n")[0].slice(0, 100) };
}

const rows = [];
for (const s of scenarios) {
  const started = Date.now();
  const o = outcome(await call(s.tool, s.args));
  const expected = new RegExp(`^(${s.expect})$|(^|,)(${s.expect})(,|$)`);
  const pass = expected.test(o.kind);
  const falseProposal = o.kind === "proposal" && s.expect !== "proposal";
  rows.push({ ...s, got: o.kind, detail: o.detail, pass, falseProposal, ms: Date.now() - started });
  // MoonPay Commerce allows ten x402 requests a minute per IP.
  await new Promise((r) => setTimeout(r, s.offline ? 100 : 6500));
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows.map(({ args, ...r }) => r), null, 2));
} else {
  for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(40)} expected ${r.expect.padEnd(36)} got ${r.got}  (${r.ms} ms)`);
  const refusals = rows.filter((r) => r.expect !== "proposal" && r.expect !== "ready");
  console.log(`\n${rows.filter((r) => r.pass).length}/${rows.length} scenarios as expected · ${rows.filter((r) => r.falseProposal).length} proposals where a refusal was due · ${refusals.filter((r) => r.pass).length}/${refusals.length} refusals held`);
}
process.exit(rows.every((r) => r.pass) ? 0 : 1);
