import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { verifySession } from "@/lib/session";
import { ObjectId } from "mongodb";

export async function PATCH(req, { params }) {
  const token = req.cookies.get("auth")?.value;
  const payload = token ? await verifySession(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { role } = await req.json();
  if (!["viewer","manager","admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const db = await getDb();
  await db.collection("users").updateOne({ _id: new ObjectId(params.id) }, { $set: { role } });
  const doc = await db.collection("users").findOne({ _id: new ObjectId(params.id) }, { projection:{ name:1,email:1,role:1,avatarUrl:1 } });
  return NextResponse.json(doc);
}
