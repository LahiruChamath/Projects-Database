import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

// List app users for assignment, avatars, etc.
export async function GET(req) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({})
    .project({ name: 1, email: 1, role: 1, avatarUrl: 1 })
    .toArray();

  return NextResponse.json({ items: users });
}
