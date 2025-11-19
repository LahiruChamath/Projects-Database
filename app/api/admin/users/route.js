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
  const users = await db.collection("users").find({}).project({ name:1, email:1, role:1, avatarUrl:1 }).toArray();
  return NextResponse.json(users);
}
