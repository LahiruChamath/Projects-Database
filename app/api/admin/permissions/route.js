import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { verifySession } from "@/lib/session";

export async function GET(req) {
  const token = req.cookies.get("auth")?.value;
  const payload = token ? await verifySession(token) : null;
  if (!payload || !["admin", "manager"].includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = await getDb();
  const items = await db.collection("permissions").find({}).toArray();
  return NextResponse.json(items);
}
