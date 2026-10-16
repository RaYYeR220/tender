import {
  TenderError,
  depositResolver,
  getPaylink,
  parseCheckoutRef,
  railFromAddress,
  verifyPayment,
  type Product,
  type Receipt,
} from "@tender/core";

export type ReceiptResult =
  | { ok: true; receipt: Receipt; product: Product | null; payer: string; link: string | null }
  | { ok: false; code: string; message: string };

export async function loadReceipt(tx: string, payer: string, link: string | null): Promise<ReceiptResult> {
  try {
    if (!railFromAddress(payer)) throw new TenderError("INVALID_PAYER", "payer must be a Solana address or a 0x Base address.");
    const ref = link ? parseCheckoutRef(link) : null;
    const product = ref?.kind === "paylink" ? await getPaylink(ref.id) : null;
    const resolveDeposit = ref && ref.kind !== "charge" ? depositResolver(ref, payer, product) : undefined;
    const receipt = await verifyPayment({ tx, payer, product, resolveDeposit });
    return { ok: true, receipt, product, payer, link: ref?.kind === "paylink" ? ref.id : null };
  } catch (error) {
    if (error instanceof TenderError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "UNAVAILABLE", message: "Chain data could not be read right now. Reload to retry." };
  }
}
