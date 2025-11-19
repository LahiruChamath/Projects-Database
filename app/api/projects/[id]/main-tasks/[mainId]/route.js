// app/api/projects/[id]/main-tasks/[mainId]/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req, ctx) {
  const { id, mainId } = await ctx.params;
  const me = await getUserFromRequest(req);
  if (!me || !["admin", "editor"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const set = {};
  ["name","startDate","endDate","handler","status"].forEach(k => {
    if (body[k] !== undefined) set[k] = String(body[k]);
  });
  if (body.progress !== undefined) set.progress = Number(body.progress);

  if (!Object.keys(set).length) return NextResponse.json({ error: "No changes" }, { status: 400 });

  const db = await getDb();
  await db.collection("mainTasks").updateOne({ _id: new ObjectId(mainId), projectId: id }, { $set: set });
  const out = await db.collection("mainTasks").findOne({ _id: new ObjectId(mainId) });
  return NextResponse.json(out);
}

export async function DELETE(_req, ctx) {
  const { id, mainId } = await ctx.params;
  const db = await getDb();
  await db.collection("subTasks").deleteMany({ projectId: id, mainTaskId: mainId }); // cascade delete
  await db.collection("mainTasks").deleteOne({ _id: new ObjectId(mainId), projectId: id });
  return NextResponse.json({ ok: true });
}
