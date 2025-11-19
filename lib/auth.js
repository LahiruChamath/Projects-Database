import { ObjectId } from "mongodb";
import { getDb } from "./mongo";

export async function getUserFromRequest(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return null;
  const db = await getDb();
  const users = db.collection("users");
  const u = await users.findOne({ _id: new ObjectId(userId) });
  if (!u) return null;
  const permissions = await db.collection("permissions").findOne({ userId: u._id.toString() });
  const merged = {
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role, // "admin" | "editor" | "viewer"
    permissions: {
      canAddProject: !!(permissions && permissions.canAddProject),
      canManagePermissions: !!(permissions && permissions.canManagePermissions)
    }
  };
  return merged;
}

export function requireAdmin(user) {
  return user && user.role === "admin";
}

export function canAddProject(user) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "editor") return true;
  return !!(user.permissions && user.permissions.canAddProject);
}
