import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

export async function PATCH(req, ctx) {
  const { id, taskId } = await ctx.params;
  const me = await getUserFromRequest(req);
  if (!me || !["admin","editor"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const set = {};
  ["title","startDate","endDate","handlerId","handler","status","progress"].forEach(k => {
    if (body[k] !== undefined) set[k] = body[k];
  });
  if (!Object.keys(set).length) return NextResponse.json({ error: "No changes" }, { status: 400 });

  const db = await getDb();
  await db.collection("tasks").updateOne({ _id: new ObjectId(taskId), projectId: id }, { $set: set });
  const doc = await db.collection("tasks").findOne({ _id: new ObjectId(taskId) });
  return NextResponse.json(doc);
}

export async function DELETE(_req, ctx) {
  const { id, taskId } = await ctx.params;
  const db = await getDb();
  await db.collection("tasks").deleteOne({ _id: new ObjectId(taskId), projectId: id });
  return NextResponse.json({ ok: true });
}
