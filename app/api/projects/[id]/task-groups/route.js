// app/api/projects/[id]/task-groups/route.js
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// List containers (both main and sub)
export async function GET(_req, { params }) {
  const { id } = await params;
  const db = await getDb();
  const items = await db.collection("taskGroups")
    .find({ projectId: id })
    .sort({ order: 1, _id: 1 })
    .toArray();
  return NextResponse.json({ items });
}

// Create a container: type = "main" or "sub" (sub requires parentGroupId)
export async function POST(req, { params }) {
  const { id } = await params;
  const me = await getUserFromRequest(req);
  if (!me || !["admin", "editor"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const type = (String(body.type || "main").toLowerCase() === "sub") ? "sub" : "main";
  const parentGroupId = body.parentGroupId ? String(body.parentGroupId) : null;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (type === "sub" && !parentGroupId) {
    return NextResponse.json({ error: "parentGroupId is required for sub tasks" }, { status: 400 });
  }

  const db = await getDb();

  if (type === "sub") {
    const exists = await db.collection("taskGroups")
      .findOne({ _id: new ObjectId(parentGroupId), projectId: id, type: "main" });
    if (!exists) return NextResponse.json({ error: "Invalid parentGroupId" }, { status: 400 });
  }

  const last = await db.collection("taskGroups")
    .find({ projectId: id, type })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  const order = (last[0]?.order || 0) + 1;

  const doc = {
    projectId: id,
    name,
    type,                 // "main" | "sub"
    parentGroupId,        // null for main
    order,
    createdAt: new Date().toISOString(),
    createdBy: me._id?.toString?.() || "",
  };

  const res = await db.collection("taskGroups").insertOne(doc);
  doc._id = res.insertedId;
  return NextResponse.json(doc, { status: 201 });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
}
