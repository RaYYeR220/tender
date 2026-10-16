import registry from "../../../registry/merchants.json";

export const dynamic = "force-static";

export function GET() {
  return Response.json(registry, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
