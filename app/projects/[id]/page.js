"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fmtDate } from "../../utils/dates";
import BackButton from "../../components/BackButton";


const allowedEditors = new Set(["admin", "editor"]);
const statusClass = (s) =>
  s === "Completed" ? "badge badge--completed" :
  s === "Terminated" ? "badge badge--terminated" :
  "badge badge--ongoing";

const currency = (n, code="LKR") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format((n ?? 0));

async function jget(url, uid) {
  const r = await fetch(url, { credentials: "include", headers: uid ? { "x-user-id": uid } : {} });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jpost(url, body, uid) {
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json", ...(uid?{"x-user-id":uid}:{}) }, credentials:"include", body:JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jpatch(url, body, uid) {
  const r = await fetch(url, { method:"PATCH", headers:{ "Content-Type":"application/json", ...(uid?{"x-user-id":uid}:{}) }, credentials:"include", body:JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jdel(url, uid) {
  const r = await fetch(url, { method:"DELETE", credentials:"include", headers: uid?{"x-user-id":uid}:{}} );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ---------- small rows ---------- */
function SubTaskRow({ row, canEdit, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(row);
  useEffect(()=>setV(row),[row]);

  const save = async () => { await onSave(v); setEdit(false); };

  return (
    <tr>
      <td>{edit ? <input className="input" value={v.title||""} onChange={e=>setV({...v,title:e.target.value})}/> : (row.title||"-")}</td>
      <td>{edit ? <input type="date" className="input" value={v.startDate?.slice(0,10)||""} onChange={e=>setV({...v,startDate:e.target.value})}/> : fmtDate(row.startDate)}</td>
      <td>{edit ? <input type="date" className="input" value={v.endDate?.slice(0,10)||""} onChange={e=>setV({...v,endDate:e.target.value})}/> : fmtDate(row.endDate)}</td>
      <td>{edit ? <input className="input" value={v.handler||""} onChange={e=>setV({...v,handler:e.target.value})}/> : (row.handler||"-")}</td>
      <td>{edit ? (
        <select className="select" value={v.status||"On Going"} onChange={e=>setV({...v,status:e.target.value})}>
          <option>On Going</option><option>Completed</option><option>Terminated</option>
        </select>
      ) : <span className={statusClass(row.status)}>{row.status||"On Going"}</span>}</td>
      <td style={{minWidth:160}}>
        {edit ? <input type="number" min={0} max={100} className="input" value={v.progress ?? 0} onChange={e=>setV({...v,progress:Number(e.target.value)})}/> : <>
          <div className="progress"><div style={{ width: `${Math.min(Math.max(row.progress||0,0),100)}%` }} /></div>
          <div className="note">{row.progress||0}%</div>
        </>}
      </td>
      <td style={{whiteSpace:"nowrap"}}>
        {canEdit && !edit && (<><button className="btn" onClick={()=>setEdit(true)}>Edit</button>{" "}<button className="btn btn-danger" onClick={()=>onDelete(row)}>Delete</button></>)}
        {canEdit && edit && (<><button className="btn btn-primary" onClick={save}>Save</button>{" "}<button className="btn" onClick={()=>{setV(row); setEdit(false);}}>Cancel</button></>)}
      </td>
    </tr>
  );
}

function clamp(n){ return Math.min(Math.max(Math.round(n),0),100); }
function pctOfSub(sub){ return sub.status==="Completed" ? 100 : clamp(Number(sub.progress||0)); }

export default function ProjectDetailsPage(props) {
  const { id } = useParams();
  const router = useRouter();

  const [me,setMe] = useState(null);
  const [project,setProject] = useState(null);
  const [mainTasks,setMainTasks] = useState([]);
  const [subTasks,setSubTasks] = useState([]);
  const [apiOverall,setApiOverall] = useState(0);

  // edit project state
  const [isEditing, setIsEditing] = useState(false);
  const [projForm, setProjForm] = useState({
    name: "", client: "", location: "",
    valueAmount: "", valueCurrency: "LKR",
    status: "On Going", startDate: "", endDate: ""
  });

  const uid = me?._id?.toString();
  const canEdit = !!me && allowedEditors.has(me.role);

  const iso = (d) => (d ? new Date(d).toISOString().slice(0,10) : "");

  // group sub tasks by main id
  const subsByMain = useMemo(()=>{
    const m = new Map();
    for(const s of subTasks){
      const k = s.mainTaskId || "__none";
      if(!m.has(k)) m.set(k,[]);
      m.get(k).push(s);
    }
    return m;
  },[subTasks]);

  // compute main progress from its sub list
  const mainPct = (mid) => {
    const list = subsByMain.get(String(mid)) || [];
    if(!list.length) return 0;
    const avg = list.reduce((a,b)=>a+pctOfSub(b),0)/list.length;
    return clamp(avg);
  };

  // overall = avg of all sub tasks (or API fallback)
  const overallPct = useMemo(()=>{
    if(!subTasks.length) return apiOverall;
    const avg = subTasks.reduce((a,b)=>a+pctOfSub(b),0)/subTasks.length;
    return clamp(avg);
  },[subTasks,apiOverall]);

  useEffect(()=>{
    let live=true;
    (async()=>{
      const meDoc = await jget("/auth/me").catch(()=>({user:null}));
      setMe(meDoc?.user || null);
      const uidLocal = meDoc?.user?._id?.toString();

      const [pRaw, mains, subs] = await Promise.all([
        jget(`/api/projects/${id}`, uidLocal),
        jget(`/api/projects/${id}/main-tasks`, uidLocal),
        jget(`/api/projects/${id}/sub-tasks`, uidLocal),
      ]);

      if(!live) return;
      const p = pRaw?.item ?? pRaw;
      setProject(p || null);
      setApiOverall(Number(pRaw?.progressPct||0));
      setMainTasks(mains.items || []);
      setSubTasks(subs.items || []);
    })();
    return ()=>{ live=false; };
  },[id]);

  /* ---------- Edit/Delete Project ---------- */
  const beginEdit = () => {
    if (!project) return;
    setProjForm({
      name: project.name || "",
      client: project.client || "",
      location: project.location || "",
      valueAmount: project.valueAmount ?? "",
      valueCurrency: project.valueCurrency || "LKR",
      status: project.status || "On Going",
      startDate: iso(project.startDate ?? project.commencementDate),
      endDate: iso(project.endDate ?? project.completionDate),
    });
    setIsEditing(true);
  };

  const saveProject = async (e) => {
    e?.preventDefault?.();
    if (!project) return;
    const startKey = ("commencementDate" in project) ? "commencementDate" : "startDate";
    const endKey = ("completionDate" in project) ? "completionDate" : "endDate";

    const body = {
      name: (projForm.name || "").trim(),
      client: (projForm.client || "").trim(),
      location: (projForm.location || "").trim(),
      valueAmount: projForm.valueAmount === "" ? null : Number(projForm.valueAmount),
      valueCurrency: projForm.valueCurrency || "LKR",
      status: projForm.status || "On Going",
      [startKey]: projForm.startDate || null,
      [endKey]: projForm.endDate || null,
    };

    const res = await jpatch(`/api/projects/${id}`, body, uid);
    const updated = res?.item ?? res;
    setProject(updated);
    setIsEditing(false);
  };

  const deleteProject = async () => {
    if (!canEdit) return;
    if (!confirm("Delete this project permanently? This action cannot be undone.")) return;
    await jdel(`/api/projects/${id}`, uid);
    router.push("/projects");
  };

  /* ---------- CRUD: Main tasks ---------- */
  const addMain = async () => {
    const name = prompt("Main task name");
    if(!name) return;
    const res = await jpost(`/api/projects/${id}/main-tasks`, { name }, uid);
    setMainTasks(ms => [res, ...ms]);
  };
  const saveMain = async (row) => {
    const res = await jpatch(`/api/projects/${id}/main-tasks/${row._id}`, row, uid);
    setMainTasks(ms => ms.map(m => m._id===row._id ? res : m));
  };
  const delMain = async (row) => {
    if(!confirm("Delete main task and all its sub tasks?")) return;
    await jdel(`/api/projects/${id}/main-tasks/${row._id}`, uid);
    setMainTasks(ms => ms.filter(m => m._id!==row._id));
    setSubTasks(ss => ss.filter(s => s.mainTaskId !== row._id));
  };

  /* ---------- CRUD: Sub tasks ---------- */
  const addSub = async (mainId) => {
    const title = prompt("Sub task title");
    if(!title) return;
    const res = await jpost(`/api/projects/${id}/main-tasks/${mainId}/sub-tasks`, { title }, uid);
    setSubTasks(ss => [res, ...ss]);
  };
  const saveSub = async (row) => {
    const res = await jpatch(`/api/projects/${id}/main-tasks/${row.mainTaskId}/sub-tasks/${row._id}`, row, uid);
    setSubTasks(ss => ss.map(s => s._id===row._id ? res : s));
  };
  const delSub = async (row) => {
    await jdel(`/api/projects/${id}/main-tasks/${row.mainTaskId}/sub-tasks/${row._id}`, uid);
    setSubTasks(ss => ss.filter(s => s._id!==row._id));
  };

  if(!project) return <div className="container" style={{ padding: 24 }}>Loading…</div>;

  return (
    <div className="container pd-wrap">
      {/* Back button (only on this details page) */}
      <div className="page-back">
        <BackButton fallback="/projects" className="btn btn--ghost">← Back</BackButton>
      </div>

      {/* Page actions */}
      {canEdit && (
        <div className="page-actions">
          <button className="btn" onClick={beginEdit}>Edit project</button>
          <button className="btn btn-danger" onClick={deleteProject}>Delete</button>
        </div>
      )}

      {/* Edit form (inline, same layout style as add form) */}
      {isEditing && (
        <section className="edit-card">
          <div className="section-head">
            <div className="section-title">Edit project</div>
          </div>
          <form onSubmit={saveProject} className="form-grid">
            <label className="field">
              <div className="label">Project Name</div>
              <input className="input" value={projForm.name} onChange={e=>setProjForm(f=>({...f,name:e.target.value}))} required />
            </label>

            <label className="field">
              <div className="label">Client</div>
              <input className="input" value={projForm.client} onChange={e=>setProjForm(f=>({...f,client:e.target.value}))} />
            </label>

            <div className="field">
              <div className="label">Project Value</div>
              <div className="inline-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input"
                  placeholder="Amount"
                  value={projForm.valueAmount}
                  onChange={e=>setProjForm(f=>({...f,valueAmount:e.target.value}))}
                />
                <select
                  className="select"
                  value={projForm.valueCurrency}
                  onChange={e=>setProjForm(f=>({...f,valueCurrency:e.target.value}))}
                >
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <label className="field">
              <div className="label">Location</div>
              <input className="input" value={projForm.location} onChange={e=>setProjForm(f=>({...f,location:e.target.value}))} />
            </label>

            <div className="field">
              <div className="label">Dates</div>
              <div className="inline-2">
                <label className="subfield">
                  <div className="sublabel">Start date</div>
                  <input type="date" className="input" value={projForm.startDate} onChange={e=>setProjForm(f=>({...f,startDate:e.target.value}))}/>
                </label>
                <label className="subfield">
                  <div className="sublabel">End date</div>
                  <input type="date" className="input" value={projForm.endDate} onChange={e=>setProjForm(f=>({...f,endDate:e.target.value}))}/>
                </label>
              </div>
            </div>

            <label className="field">
              <div className="label">Status</div>
              <select className="select" value={projForm.status} onChange={e=>setProjForm(f=>({...f,status:e.target.value}))}>
                <option>On Going</option>
                <option>Completed</option>
                <option>Terminated</option>
              </select>
            </label>

            <div className="muted" style={{ fontSize:12 }}>
              Note: Overall progress is calculated from completed sub-tasks, not edited here.
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save changes</button>
              <button type="button" className="btn" onClick={()=>setIsEditing(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <div className="pd-header">
        <div className="title">{project.name}</div>
        <div className="meta-pills">
          <div className="pill"><div className="pill-title">Project details</div>
            <div className="pill-body">
              <span className="chip"><b>Client:</b> {project.client || "-"}</span>
              <span className="chip"><b>Amount:</b> {currency(project.valueAmount, project.valueCurrency || "LKR")}</span>
              <span className="chip"><b>Location:</b> {project.location || "-"}</span>
            </div>
          </div>
          



          
        </div>
      </div>

      <div className="pd-sections">
        <section className="section">
          <div className="section-head">
            <div className="section-title">Main tasks / Sub tasks</div>
            {canEdit && <div className="toolbar"><button className="btn btn-primary" onClick={addMain}>Add Main task</button></div>}
          </div>

          {/* list all main tasks */}
          {mainTasks.map(m => {
            const list = subsByMain.get(String(m._id)) || [];
            const pct = mainPct(m._id);

            return (
              <div className="group" key={m._id}>
                {/* MAIN HEADER with inline edit */}
                <MainHeader
                  row={m}
                  pct={pct}
                  canEdit={canEdit}
                  onSave={saveMain}
                  onDelete={delMain}
                  onAddSub={()=>addSub(String(m._id))}
                />

                {/* SUB TABLE */}
                <div className="table-scroll group-body">
                  <table className="tasks-table">
                    <thead>
                      <tr>
                        <th style={{minWidth:220}}>Sub task</th><th>Start date</th><th>End date</th><th>Handler</th><th>Status</th><th style={{minWidth:160}}>Progress</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(s => (
                        <SubTaskRow key={s._id} row={s} canEdit={canEdit} onSave={saveSub} onDelete={delSub} />
                      ))}
                      {!list.length && <tr><td colSpan={7} style={{textAlign:"center", color:"var(--muted)", padding:"12px"}}>No sub tasks yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {!mainTasks.length && (
            <div className="muted" style={{padding:"8px 4px"}}>No main tasks yet.</div>
          )}
        </section>
      </div>

      <style jsx global>{`
        .pd-wrap{padding:20px 0 36px}
        .page-back{margin-bottom:8px}
        .page-actions{display:flex;gap:8px;margin-bottom:10px}
        .btn--ghost{background:transparent;border:1px solid var(--border,#e5e7eb)}
        .btn--ghost:hover{background:var(--surface-2,#f3f6f5)}

        .edit-card{border:1px solid var(--border,#e5e7eb);background:var(--surface,#fff);border-radius:18px;padding:14px;margin-bottom:12px}
        .form-grid{display:grid;gap:12px}
        .inline-2{display:grid;grid-template-columns:1fr 160px;gap:8px}
        .field .label{font-size:12px;color:var(--muted,#667085);margin-bottom:6px}
        .subfield .sublabel{font-size:12px;color:var(--muted,#667085);margin-bottom:6px}
        .form-actions{display:flex;gap:8px;justify-content:flex-end}

        .pd-header{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-bottom:18px}
        .pd-header .title{font-size:24px;font-weight:700}
        
        .chip{background:#f1f5f9;border:1px solid var(--border,#e5e7eb);padding:4px 8px;border-radius:999px;font-size:12px}
        .pd-sections{border:1px solid var(--border,#e5e7eb);border-radius:18px;background:var(--surface,#fff);padding:14px}
        .section{padding:8px 6px 18px}
        .section+.section{border-top:1px solid var(--border,#e5e7eb)}
        .section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .section-title{font-weight:700}
        .toolbar{display:flex;gap:8px}
        .table-scroll{overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:12px}
        .tasks-table{width:100%;min-width:860px;border-collapse:collapse}
        .tasks-table th,.tasks-table td{border-bottom:1px solid #f1f5f9;padding:10px 12px;text-align:left}

        .group{border:1px dashed var(--border,#e5e7eb); border-radius:12px; margin:12px 0;}
        .group-body{ padding: 8px; }

        .progress{height:8px;background:#f1f5f9;border-radius:99px;overflow:hidden}
        .progress>div{height:100%;background:#16a34a}
      `}
      </style>
    </div>
  );
}

/* ---------- Main header with inline edit + gauge ---------- */
function MainHeader({ row, pct, canEdit, onSave, onDelete, onAddSub }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(row);
  useEffect(()=>setV(row),[row]);

  const save = async () => { await onSave(v); setEdit(false); };

  return (
    <div className="group-head" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div className="group-title" style={{display:"grid",gridTemplateColumns:"auto auto",gap:10,alignItems:"center"}}>
        <div style={{fontWeight:700}}>
          {edit
            ? <input className="input" value={v.name||""} onChange={e=>setV({...v,name:e.target.value})}/>
            : <>Main task: {row.name}</>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span className="progress" style={{inlineSize:120, blockSize:10}}><div style={{ width: `${pct}%` }} /></span>
          <span className="note">{pct}%</span>
        </div>
      </div>

      <div className="toolbar" style={{display:"flex",gap:8}}>
        {canEdit && <button className="btn" onClick={onAddSub}>Add Sub task</button>}
        {!edit && canEdit && (
          <>
            <button className="btn" onClick={()=>setEdit(true)}>Edit</button>
            <button className="btn btn-danger" onClick={()=>onDelete(row)}>Delete</button>
          </>
        )}
        {edit && canEdit && (
          <>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={()=>{setV(row); setEdit(false);}}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
