import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

// GET one project
export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const doc = await db.collection("projects").findOne({ _id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

// PATCH project (admin/editor only)
export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user || !["admin", "editor"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const set = {};
  ["name","client","valueAmount","valueCurrency","location","status","description","commencementDate","completionDate"]
    .forEach((k) => {
      if (body[k] !== undefined) set[k] = body[k];
    });
  if (!Object.keys(set).length) return NextResponse.json({ error: "No changes" }, { status: 400 });

  const db = await getDb();
  await db.collection("projects").updateOne({ _id: new ObjectId(id) }, { $set: set });
  const doc = await db.collection("projects").findOne({ _id: new ObjectId(id) });
  return NextResponse.json(doc);
}
