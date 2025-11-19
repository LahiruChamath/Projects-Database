// app/api/projects/[id]/main-tasks/[mainId]/sub-tasks/route.js
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req, ctx) {
  const { id, mainId } = await ctx.params;
  const db = await getDb();
  const items = await db
    .collection("subTasks")
    .find({ projectId: id, mainTaskId: mainId })
    .sort({ _id: -1 })
    .toArray();
  return NextResponse.json({ items });
}

export async function POST(req, ctx) {
  const { id, mainId } = await ctx.params;
  const me = await getUserFromRequest(req);
  if (!me || !["admin", "editor"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const doc = {
    projectId: id,
    mainTaskId: mainId,
    title: String(body.title || "Sub task"),
    startDate: String(body.startDate || ""),
    endDate: String(body.endDate || ""),
    handler: String(body.handler || ""),
    status: String(body.status || "On Going"),
    progress: Number(body.progress ?? 0),
    createdBy: me._id?.toString?.() || "",
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();
  const res = await db.collection("subTasks").insertOne(doc);
  doc._id = res.insertedId;
  return NextResponse.json(doc, { status: 201 });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
}
