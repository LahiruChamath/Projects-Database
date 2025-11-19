"use client";

import React, { useEffect, useMemo, useState } from "react";

const statusClass = (s) => {
  if (s === "Completed") return "badge badge--completed";
  if (s === "Terminated") return "badge badge--terminated";
  return "badge badge--ongoing";
};

const fmtDate = (iso) => (iso ? new Date(iso).toISOString().slice(0,10) : "");

export default function ClientView({ projectId }) {
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [openFormFor, setOpenFormFor] = useState(null); // groupId or 'ungrouped'

  const reload = async () => {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([
        fetch(`/api/projects/${projectId}/task-groups`, { credentials: "include" }).then(r => r.ok ? r.json() : { items: [] }),
        fetch(`/api/projects/${projectId}/tasks`, { credentials: "include" }).then(r => r.json()),
      ]);
      setGroups(g.items || []);
      setTasks(t.items || []);
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [projectId]);

  const grouped = useMemo(() => {
    const by = new Map();
    for (const t of tasks) {
      const key = t.groupId || "ungrouped";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(t);
    }
    return by;
  }, [tasks]);

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) return;
    const r = await fetch(`/api/projects/${projectId}/task-groups`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name })
    });
    if (!r.ok) { alert((await r.json().catch(()=>({}))).error || "Failed"); return; }
    setGroupName(""); setAddingGroup(false);
    await reload();
  };

  const createTask = async (groupId, data) => {
    const r = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ...data, groupId })
    });
    if (!r.ok) { alert((await r.json().catch(()=>({}))).error || "Failed"); return; }
    setOpenFormFor(null);
    await reload();
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div className="row between">
        <h2 className="h2">Tasks</h2>
        {!addingGroup ? (
          <button className="btn btn-primary" onClick={() => setAddingGroup(true)}>Add container</button>
        ) : (
          <div className="add-group">
            <input className="input" autoFocus placeholder="Container name" value={groupName} onChange={(e)=>setGroupName(e.target.value)} />
            <button className="btn btn-primary" onClick={createGroup}>Create</button>
            <button className="btn" onClick={()=>{ setAddingGroup(false); setGroupName(""); }}>Cancel</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : err ? (
        <div className="card" style={{ color:"crimson" }}>{err}</div>
      ) : (
        <div className="groups">
          {/* Ungrouped */}
          <GroupSection
            title="Ungrouped"
            items={grouped.get("ungrouped") || []}
            onAddClick={() => setOpenFormFor("ungrouped")}
            showForm={openFormFor === "ungrouped"}
            onCancel={() => setOpenFormFor(null)}
            onCreate={(task) => createTask(null, task)}
          />
          {/* Named groups */}
          {groups.map((g) => (
            <GroupSection
              key={g._id}
              title={g.name}
              items={grouped.get(String(g._id)) || []}
              onAddClick={() => setOpenFormFor(String(g._id))}
              showForm={openFormFor === String(g._id)}
              onCancel={() => setOpenFormFor(null)}
              onCreate={(task) => createTask(String(g._id), task)}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .row.between{ display:flex; align-items:center; justify-content:space-between; margin:10px 0; }
        .h2{ font-size:18px; margin:0; }
        .btn{ border:1px solid var(--border,#e5e7eb); background:#fff; color:var(--text,#101828); padding:8px 12px; border-radius:12px; }
        .btn-primary{ background: var(--brand,#2e7d32); color:#fff; border-color: transparent; }
        .input, .select{ border:1px solid var(--border,#e5e7eb); background:#fff; padding:8px 10px; border-radius:10px; width:100%; }
        .add-group{ display:flex; gap:8px; align-items:center; }
        .groups{ display:grid; gap:12px; }
        .card{ border:1px solid var(--border,#e5e7eb); background:var(--surface,#fff); border-radius:14px; padding:12px; box-shadow:var(--shadow,0 8px 24px rgba(16,24,40,.06)); }
        .badge{ display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid var(--border,#e5e7eb); font-size:12px; }
        .badge--ongoing{ background:#ecfeff; border-color:#a5f3fc; color:#0369a1; }
        .badge--completed{ background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
        .badge--terminated{ background:#fef2f2; border-color:#fecaca; color:#7f1d1d; }
      `}</style>
    </div>
  );
}

function GroupSection({ title, items, onAddClick, showForm, onCancel, onCreate }) {
  return (
    <section className="group">
      <header className="group-head">
        <h3>{title}</h3>
        <button className="btn" onClick={onAddClick}>Add task</button>
      </header>
      <div className="group-body">
        <TasksTable items={items} />
        {showForm && <NewTaskForm onCancel={onCancel} onCreate={onCreate} />}
      </div>
      <style jsx>{`
        .group{ border:1px dashed var(--border,#e5e7eb); border-radius:14px; }
        .group-head{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--surface-2,#f3f6f5); border-radius:14px 14px 0 0; }
        .group-head h3{ margin:0; font-size:16px; }
        .group-body{ padding:12px; }
      `}</style>
    </section>
  );
}

function TasksTable({ items }) {
  return (
    <div className="table-wrap">
      <table className="tasks">
        <thead>
          <tr>
            <th>Task</th>
            <th>Start date</th>
            <th>End date</th>
            <th>Handler</th>
            <th>Status</th>
            <th style={{width:200}}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((t) => {
            const pct = Math.max(0, Math.min(100, Number(t.progress) || 0));
            return (
              <tr key={t._id}>
                <td>{t.title}</td>
                <td>{fmtDate(t.startDate)}</td>
                <td>{fmtDate(t.endDate)}</td>
                <td>{t.handler || "—"}</td>
                <td><span className={statusClass(t.status)}>{t.status || "On Going"}</span></td>
                <td>
                  <div className="pb">
                    <div className="pb__track"><div className="pb__bar" style={{ width: `${pct}%` }} /></div>
                    <span className="pb__label">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
          {(!items || !items.length) && (
            <tr><td colSpan={6} style={{ color:"var(--muted,#667085)", textAlign:"center", padding:"12px" }}>No tasks yet</td></tr>
          )}
        </tbody>
      </table>

      <style jsx>{`
        table.tasks{ width:100%; border-collapse:collapse; }
        table.tasks th, table.tasks td{ border-bottom:1px solid var(--border,#e5e7eb); padding:8px 10px; text-align:left; }
        table.tasks th{ font-size:12px; color:var(--muted,#667085); text-transform:uppercase; letter-spacing:.02em; }
        .pb{ display:flex; align-items:center; gap:10px; }
        .pb__track{ position:relative; height:10px; flex:1; background:var(--surface-2,#f3f6f5);
          border:1px solid var(--border,#e5e7eb); border-radius:999px; overflow:hidden; }
        .pb__bar{ position:absolute; inset:0; width:0%; background:linear-gradient(90deg,#2e7d32,#34a853); }
        .pb__label{ min-width:38px; text-align:right; font-size:12px; color:var(--muted,#667085); }
      `}</style>
    </div>
  );
}

function NewTaskForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState("");
  const [handler, setHandler] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [status, setStatus] = useState("On Going");

  const submit = async (e) => {
    e.preventDefault();
    await onCreate({ title, handler, startDate, endDate, status, progress: 0 });
    setTitle(""); setHandler(""); setStart(""); setEnd(""); setStatus("On Going");
  };

  return (
    <form className="taskform" onSubmit={submit}>
      <input className="input" placeholder="Task name" value={title} onChange={(e)=>setTitle(e.target.value)} required />
      <input className="input" placeholder="Handler" value={handler} onChange={(e)=>setHandler(e.target.value)} />
      <input type="date" className="input" value={startDate} onChange={(e)=>setStart(e.target.value)} />
      <input type="date" className="input" value={endDate} onChange={(e)=>setEnd(e.target.value)} />
      <select className="select" value={status} onChange={(e)=>setStatus(e.target.value)}>
        <option>On Going</option><option>Completed</option><option>Terminated</option>
      </select>
      <div className="actions">
        <button className="btn btn-primary">Add</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
      <style jsx>{`
        .taskform{ display:grid; grid-template-columns:1.2fr 1fr 150px 150px 150px auto; gap:8px; align-items:center; margin-top:8px; }
        .actions{ display:flex; gap:8px; justify-content:flex-end; }
        @media (max-width: 900px){ .taskform{ grid-template-columns:1fr; } .actions{ justify-content:flex-start; } }
      `}</style>
    </form>
  );
}
