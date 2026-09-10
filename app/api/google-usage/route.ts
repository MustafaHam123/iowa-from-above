import { getGoogleQuotaSnapshot } from "../googleQuota";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getGoogleQuotaSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
