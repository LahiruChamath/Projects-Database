// app/api/projects/[id]/route.js
import { NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ---------- DB ---------- */
const URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!URI) throw new Error("Missing MONGO_URI / MONGODB_URI env");

let client;
async function db() {
  if (!client) client = new MongoClient(URI, { ignoreUndefined: true });
  if (!client.topology?.isConnected?.()) await client.connect();
  return client.db(process.env.MONGO_DB || undefined);
}

/* Helpers */
const asOid = (s) => { try { return new ObjectId(String(s)); } catch { return null; } };
const idFilter = (id) => {
  const oid = asOid(id);
  return oid ? { $or: [{ _id: oid }, { _id: String(id) }] } : { _id: String(id) };
};
const toDateOrNull = (v) => (v ? new Date(v) : null);

/* ---------- GET /api/projects/[id] ---------- */
export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const filter = idFilter(id);

  const dbc = await db();
  const item = await dbc.collection("projects").findOne(filter);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const progressPct = item.progressPct ?? 0;
  return NextResponse.json({ item, progressPct });
}

/* ---------- PATCH /api/projects/[id] ---------- */
export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const filter = idFilter(id);

  const body = await req.json().catch(() => ({}));

  // Whitelist & normalize (aligns with your add form)
  const clean = {};
  const pick = (k) => { if (k in body) clean[k] = body[k]; };
  pick("name");
  pick("client");
  pick("location");
  pick("status"); // "On Going" | "Completed" | "Terminated"

  if ("valueAmount" in body) {
    clean.valueAmount =
      body.valueAmount === "" || body.valueAmount == null ? null : Number(body.valueAmount);
  }
  if ("valueCurrency" in body) clean.valueCurrency = body.valueCurrency || "LKR";

  if ("startDate" in body) clean.startDate = toDateOrNull(body.startDate);
  if ("endDate" in body) clean.endDate = toDateOrNull(body.endDate);
  if ("commencementDate" in body) clean.commencementDate = toDateOrNull(body.commencementDate);
  if ("completionDate" in body) clean.completionDate = toDateOrNull(body.completionDate);

  const dbc = await db();

  // Confirm it exists first (clear 404 vs update-options issues)
  const exists = await dbc.collection("projects").findOne(filter);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update = { $currentDate: { updatedAt: true } };
  update.$set = clean; // {} is fine; becomes a no-op

  await dbc.collection("projects").updateOne(filter, update);

  const updated = await dbc.collection("projects").findOne(filter);
  return NextResponse.json({ item: updated });
}

/* ---------- DELETE /api/projects/[id] ---------- */
export async function DELETE(_req, ctx) {
  const { id } = await ctx.params;
  const filter = idFilter(id);

  const dbc = await db();

  const del = await dbc.collection("projects").deleteOne(filter);
  if (del.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort cascade for both string/ObjectId projectId
  const orProject = (() => {
    const oid = asOid(id);
    const s = String(id);
    return oid ? [{ projectId: String(oid) }, { projectId: oid }, { projectId: s }] : [{ projectId: s }];
  })();

  try { await dbc.collection("main_tasks").deleteMany({ $or: orProject }); } catch {}
  try { await dbc.collection("sub_tasks").deleteMany({ $or: orProject }); } catch {}
  try { await dbc.collection("attachments").deleteMany({ $or: orProject }); } catch {}

  return NextResponse.json({ ok: true, deletedId: String(id) });
}

/* ---------- OPTIONS ---------- */
export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
