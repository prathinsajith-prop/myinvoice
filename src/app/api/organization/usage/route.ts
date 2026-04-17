import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { resolveApiContext } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/errors";
import { getUsageStats } from "@/lib/plans.server";

// GET /api/organization/usage — return plan limits vs current usage
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveApiContext(req);
    const stats = await getUsageStats(ctx.organizationId);
    if (!stats) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    return NextResponse.json(stats);
  } catch (error) {
    return toErrorResponse(error);
  }
}
