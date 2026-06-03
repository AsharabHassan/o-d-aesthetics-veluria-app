import { NextResponse } from "next/server";
import { validateLead } from "@/lib/validation";
import { pushLeadToGhl, type GhlMeta } from "@/lib/ghl";

export const runtime = "nodejs";

function parseMeta(input: unknown, req: Request): GhlMeta {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const ipHeader =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  return {
    event_id: str(o.event_id),
    event_name: str(o.event_name) || "Lead",
    event_source_url: str(o.event_source_url),
    fbp: str(o.fbp),
    fbc: str(o.fbc),
    fbclid: str(o.fbclid),
    client_user_agent: req.headers.get("user-agent") ?? "",
    client_ip_address: ipHeader.split(",")[0]?.trim() ?? "",
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = validateLead(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const meta = parseMeta((body as { meta?: unknown })?.meta, req);

  try {
    await pushLeadToGhl(result.lead, meta);
  } catch (err) {
    console.error("[lead] GHL push failed:", err);
    return NextResponse.json(
      { error: "We couldn't submit your details. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
