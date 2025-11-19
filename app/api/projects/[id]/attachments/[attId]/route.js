import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";

export async function DELETE(_req, ctx) {
  const { id, attId } = await ctx.params;
  const db = await getDb();
  await db.collection("attachments").deleteOne({ _id: new ObjectId(attId), projectId: id });
  return NextResponse.json({ ok: true });
}
