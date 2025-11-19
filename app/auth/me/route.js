import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { getDb } from "@/lib/mongo";
import { ObjectId } from "mongodb";

export async function GET(req) {
  const token = req.cookies.get("auth")?.value;
  if (!token) return NextResponse.json({ user: null });
  const payload = await verifySession(token);
  if (!payload?.uid) return NextResponse.json({ user: null });

  const db = await getDb();
  const u = await db.collection("users").findOne({ _id: new ObjectId(payload.uid) });
  if (!u) return NextResponse.json({ user: null });

  return NextResponse.json({ user: { _id: u._id.toString(), name: u.name, email: u.email, role: u.role || "viewer" } });
}
