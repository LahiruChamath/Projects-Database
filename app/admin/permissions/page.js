"use client";
import React, { useEffect, useState } from "react";

export default function PermissionsPage() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [rows, setRows] = useState([]);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/users").then(r=>r.json()).then(d=>{
      setUsers(d.items||[]);
      if ((d.items||[]).length) setCurrentUserId(d.items[0]._id);
    });
  }, []);

  const load = () => {
    if (!currentUserId) return;
    fetch("/api/permissions", { headers:{ "x-user-id": currentUserId } })
      .then(res => {
        if (res.status===403) { setForbidden(true); return { items:[] }; }
        return res.json();
      })
      .then(d => setRows(d.items||[]));
  };

  useEffect(() => { load(); }, [currentUserId]);

  const setPerms = async (userId, perms) => {
    const res = await fetch("/api/permissions", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-user-id": currentUserId },
      body: JSON.stringify({ userId, ...perms })
    });
    if (res.ok) load();
    else alert("Failed");
  };

  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Permissions</h1>
          <select className="border border-slate-200 rounded-xl px-3 py-2" value={currentUserId} onChange={e=>{ setForbidden(false); setCurrentUserId(e.target.value); }}>
            {users.map(u=><option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-700">Forbidden. Switch to an admin user.</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Permissions</h1>
        <select className="border border-slate-200 rounded-xl px-3 py-2" value={currentUserId} onChange={e=>setCurrentUserId(e.target.value)}>
          {users.map(u=><option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
        </select>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3">UserId</th>
              <th className="text-left px-4 py-3">canAddProject</th>
              <th className="text-left px-4 py-3">canManagePermissions</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=>{
              const p = rows.find(r=>r.userId===u._id) || { canAddProject:false, canManagePermissions:false };
              return (
                <tr key={u._id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{u.name} ({u.role})</td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={!!p.canAddProject} onChange={e=>setPerms(u._id, { canAddProject:e.target.checked, canManagePermissions: p.canManagePermissions })}/>
                  </td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={!!p.canManagePermissions} onChange={e=>setPerms(u._id, { canAddProject: p.canAddProject, canManagePermissions: e.target.checked })}/>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              );
            })}
            {!users.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No users</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">Only admin can change permissions.</p>
    </div>
  );
}