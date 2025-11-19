// app/api/projects/[id]/main-tasks/[mainId]/sub-tasks/[subId]/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req, ctx) {
  const { id, mainId, subId } = await ctx.params;
  const me = await getUserFromRequest(req);
  if (!me || !["admin", "editor"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const set = {};
  ["title","startDate","endDate","handler","status"].forEach(k => {
    if (body[k] !== undefined) set[k] = String(body[k]);
  });
  if (body.progress !== undefined) set.progress = Number(body.progress);

  if (!Object.keys(set).length) return NextResponse.json({ error: "No changes" }, { status: 400 });

  const db = await getDb();
  await db.collection("subTasks").updateOne(
    { _id: new ObjectId(subId), projectId: id, mainTaskId: mainId },
    { $set: set }
  );
  const out = await db.collection("subTasks").findOne({ _id: new ObjectId(subId) });
  return NextResponse.json(out);
}

export async function DELETE(_req, ctx) {
  const { id, mainId, subId } = await ctx.params;
  const db = await getDb();
  await db.collection("subTasks").deleteOne({ _id: new ObjectId(subId), projectId: id, mainTaskId: mainId });
  return NextResponse.json({ ok: true });
}
