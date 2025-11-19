import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import bcrypt from "bcryptjs";
import { signSession } from "@/lib/session";

export async function POST(req) {
  const { name, email, password } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = await getDb();
  const users = db.collection("users");
  const exists = await users.findOne({ email: String(email).toLowerCase() });
  if (exists) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const doc = { name, email: String(email).toLowerCase(), role: "viewer", passwordHash };
  const ins = await users.insertOne(doc);

  const token = await signSession({ uid: ins.insertedId.toString(), role: "viewer" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 7
  });
  return res;
}
