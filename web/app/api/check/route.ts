import { scan } from "@/lib/readiness";

export async function GET(request: Request) {
  const link = new URL(request.url).searchParams.get("link");
  if (!link) return Response.json({ error: "Pass ?link= with a MoonPay Commerce pay link." }, { status: 400 });
  return Response.json(await scan(link), { headers: { "Cache-Control": "no-store" } });
}
