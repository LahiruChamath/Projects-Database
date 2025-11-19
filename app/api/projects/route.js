// Source/app/api/projects/route.js
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

// Ensure no stale caching for this route
export const dynamic = "force-dynamic";

/** Utility: safely read search params from NextRequest or plain Request */
function getSearchParams(req) {
  // NextRequest has .nextUrl, plain Request needs new URL
  const sp = req?.nextUrl?.searchParams ?? new URL(req.url).searchParams;
  return {
    q: (sp.get("q") || "").trim(),
    client: sp.get("client"),
    location: sp.get("location"),
    status: sp.get("status"),
  };
}

/** GET /api/projects
 * Query: q, client, location, status
 * Returns: { items: [ { ...doc, progressPct } ] }
 */
export async function GET(req) {
  const { q, client, location, status } = getSearchParams(req);

  const db = await getDb();
  const filter = {};

  if (q) {
    // escape regex specials
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { client: rx }, { location: rx }];
  }
  if (client && client !== "all") filter.client = client;
  if (location && location !== "all") filter.location = location;
  if (status && status !== "all") filter.status = status;

  const projects = await db
    .collection("projects")
    .find(filter)
    .sort({ _id: -1 })
    .toArray();

  // compute progress from tasks: done / total * 100
  const ids = projects.map((p) => p._id.toString());
  const tasksAgg = await db
    .collection("tasks")
    .aggregate([
      { $match: { projectId: { $in: ids } } },
      {
        $group: {
          _id: "$projectId",
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const byPid = Object.fromEntries(tasksAgg.map((t) => [t._id, t]));

  const items = projects.map((p) => {
    const t = byPid[p._id.toString()] || { total: 0, done: 0 };
    const progressPct = t.total ? Math.round((t.done * 100) / t.total) : 0;

    // normalize legacy value -> valueAmount, default currency
    const normalized = { ...p };
    if (normalized.value !== undefined && normalized.valueAmount === undefined) {
      normalized.valueAmount = normalized.value;
      delete normalized.value;
    }
    if (!normalized.valueCurrency) normalized.valueCurrency = "LKR";

    return { ...normalized, progressPct };
  });

  return NextResponse.json({ items }, { status: 200 });
}

/** POST /api/projects
 * Body: { name, client?, location?, status?, commencementDate?, completionDate?, valueAmount?, valueCurrency?, description? }
 * Auth: admin/editor (adjust if you want to allow open inserts)
 * NOTE: Only `name` is required now.
 */
export async function POST(req) {
  // ----- Auth (keep or relax as you prefer) -----
  let me = null;
  try {
    me = await getUserFromRequest(req);
  } catch {
    // ignore parsing issues; me stays null
  }
  if (!me || !["admin", "editor"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ----- Payload -----
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.name || String(body.name).trim() === "") {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  // allow only name to be required; everything else optional with sane defaults
  const safeNumber = (v, def = 0) =>
    v === "" || v === null || v === undefined ? def : Number(v);

  const doc = {
    name: String(body.name).trim(),
    client: body.client ? String(body.client).trim() : "",
    location: body.location ? String(body.location).trim() : "",
    status: body.status ? String(body.status).trim() : "On Going",
    description: body.description ? String(body.description) : "",
    commencementDate: body.commencementDate ? String(body.commencementDate) : "",
    completionDate: body.completionDate ? String(body.completionDate) : "",
    // keep 0 as a valid value
    valueAmount: safeNumber(body.valueAmount, 0),
    valueCurrency: body.valueCurrency || "LKR",
    createdAt: new Date().toISOString(),
    createdBy: me?._id?.toString?.() || "",
  };

  const db = await getDb();
  const res = await db.collection("projects").insertOne(doc);
  doc._id = res.insertedId;

  return NextResponse.json(doc, { status: 201 });
}

/** OPTIONS for CORS/preflight & nicer "Allow" header */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}
