import { loadReceipt } from "@/lib/receipt";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tx = params.get("tx");
  const payer = params.get("payer");
  if (!tx || !payer) return Response.json({ error: "Pass ?tx= and ?payer= (and optionally ?link=)." }, { status: 400 });
  const result = await loadReceipt(tx, payer, params.get("link"));
  return Response.json(result, { status: result.ok ? 200 : 422, headers: { "Cache-Control": "no-store" } });
}
