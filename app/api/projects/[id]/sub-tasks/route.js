// app/api/projects/[id]/sub-tasks/route.js
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const items = await db
    .collection("subTasks")
    .find({ projectId: id })
    .sort({ _id: -1 })
    .toArray();
  return NextResponse.json({ items });
}
