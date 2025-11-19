"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "./resources/EML-PLC-Logo.png";
import { fmtDate } from "./utils/dates";

/* ------------ helpers ------------ */
const statusClass = (s) => {
  if (s === "On Going") return "badge badge--ongoing";
  if (s === "Completed") return "badge badge--completed";
  if (s === "Terminated") return "badge badge--terminated";
  return "badge";
};
const currency = (n, code = "LKR") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(n ?? 0);
const initialsOf = (nameOrEmail) =>
  (nameOrEmail || "")
    .trim()
    .split(/\s+/)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

const yearOf = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).getFullYear();
};

const clamp = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));

/* tiny fetch helpers */
async function jget(url, headers = {}) {
  const r = await fetch(url, { credentials: "include", headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jpatch(url, body) {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ------------ User menu ------------ */
function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  const initials = initialsOf(user?.name || user?.email);

  return (
    <div className="user-chip" ref={ref}>
      <button className="user-chip-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar" aria-hidden="true">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
        </span>
        <span className="user-meta">
          <span className="name">{user?.name || user?.email}</span>
          <span className="role">{(user?.role || "viewer").toUpperCase()}</span>
        </span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>

      {open && (
        <div className="dropdown" role="menu">
          <button className="dropdown-item" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------ Admin tools modal ------------ */
function AdminToolsModal({ id, onClose }) {
  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState([]);
  const [perms, setPerms] = useState([]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true);
        const [u, p] = await Promise.all([jget("/api/admin/users"), jget("/api/admin/permissions")]);
        if (!live) return;
        setUsers(u || []);
        setPerms(p || []);
        setErr("");
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const setUserRole = async (id, role) => {
    const old = users.slice();
    setUsers((us) => us.map((u) => (u._id === id ? { ...u, role } : u)));
    try {
      await jpatch(`/api/admin/users/${id}`, { role });
    } catch (e) {
      setErr(String(e.message || e));
      setUsers(old);
    }
  };

  const togglePerm = async (id, key) => {
    const target = perms.find((p) => p._id === id);
    if (!target) return;
    const next = { ...target, [key]: !target[key] };
    const old = perms.slice();
    setPerms((ps) => ps.map((p) => (p._id === id ? next : p)));
    try {
      await jpatch(`/api/admin/permissions/${id}`, { [key]: next[key] });
    } catch (e) {
      setErr(String(e.message || e));
      setPerms(old);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div id={id} className="modal" role="dialog" aria-label="Admin tools" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="tabs">
            <button className={`tab ${tab === "users" ? "is-active" : ""}`} onClick={() => setTab("users")}>
              Users
            </button>
            <button className={`tab ${tab === "permissions" ? "is-active" : ""}`} onClick={() => setTab("permissions")}>
              Permissions
            </button>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="content">
          {loading && <div className="muted">Loading…</div>}
          {err && <div className="error">{err}</div>}

          {tab === "users" && !loading && (
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="avatar sm">{u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : initialsOf(u.name || u.email)}</span>
                      {u.name || "-"}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role || "viewer"} onChange={(e) => setUserRole(u._id, e.target.value)}>
                        <option value="viewer">viewer</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "permissions" && !loading && (
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Resource</th>
                  <th>Read</th>
                  <th>Write</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <span className="badge-role">{p.role}</span>
                    </td>
                    <td>{p.resource}</td>
                    <td>
                      <input type="checkbox" checked={!!p.canRead} onChange={() => togglePerm(p._id, "canRead")} />
                    </td>
                    <td>
                      <input type="checkbox" checked={!!p.canWrite} onChange={() => togglePerm(p._id, "canWrite")} />
                    </td>
                    <td>
                      <input type="checkbox" checked={!!p.canDelete} onChange={() => togglePerm(p._id, "canDelete")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Main page
   ========================= */
export default function Page() {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [currentUserId, setCurrentUserId] = useState("");

  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // "none" | "comm_desc" | "comm_asc" | "comp_desc" | "comp_asc"
  const [yearSort, setYearSort] = useState("none");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const [draft, setDraft] = useState({
    name: "",
    commencementDate: new Date().toISOString().slice(0, 10),
    completionDate: "",
    client: "",
    location: "",
    valueAmount: "",
    valueCurrency: "LKR",
    status: "On Going",
  });

  /* ---- load session user ---- */
  useEffect(() => {
    (async () => {
      try {
        const meResp = await jget("/auth/me");
        const my = meResp?.user || null;
        setMe(my);
        setCurrentUserId(my?._id || "");
      } catch {
        setMe(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentUser = useMemo(
    () => me || users.find((u) => u._id === currentUserId) || null,
    [me, users, currentUserId]
  );

  /* -------- hydrate progress from project details when missing -------- */
  const hydrateMissingProgress = async (list) => {
    const headers = currentUserId ? { "x-user-id": currentUserId } : {};
    // candidates with missing/invalid progressPct
    const targets = list.filter(
      (p) => p.progressPct == null || Number.isNaN(Number(p.progressPct))
    );
    if (!targets.length) return list;

    const idOf = (p) => String(p._id || p.id);
    const indexById = new Map(list.map((p, i) => [idOf(p), i]));

    const details = await Promise.all(
      targets.map((p) =>
        jget(`/api/projects/${idOf(p)}`, headers)
          .then((j) => j?.item ?? j)
          .catch(() => null)
      )
    );

    const result = [...list];
    details.forEach((item, i) => {
      if (!item) return;
      const id = idOf(targets[i]);
      const idx = indexById.get(id);
      if (idx != null) {
        const pct = Number(item.progressPct ?? result[idx].progressPct ?? 0);
        result[idx] = { ...result[idx], progressPct: Number.isFinite(pct) ? pct : 0 };
      }
    });
    return result;
  };

  /* ---- projects list ---- */
  const loadProjects = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (clientFilter !== "all") qs.set("client", clientFilter);
    if (locationFilter !== "all") qs.set("location", locationFilter);
    if (statusFilter !== "all") qs.set("status", statusFilter);

    fetch("/api/projects?" + qs.toString(), {
      headers: currentUserId ? { "x-user-id": currentUserId } : {},
      credentials: "include",
    })
      .then((r) => r.json())
      .then(async (d) => {
        // normalize list
        const norm = (d.items || []).map((it) => {
          const pct = Number(it.progressPct ?? it.progress ?? 0);
          return { ...it, progressPct: Number.isFinite(pct) ? pct : 0 };
        });
        setItems(norm);

        // hydrate missing progress from details API
        const hydrated = await hydrateMissingProgress(norm);
        setItems(hydrated);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, clientFilter, locationFilter, statusFilter, currentUserId]);

  /* ---- UI permissions derived from role ---- */
  const allowAdd = !!currentUser && ["admin", "manager", "editor"].includes(currentUser.role);

  /* ---- derived filter options ---- */
  const clientOptions = useMemo(
    () => ["all", ...Array.from(new Set(items.map((p) => p.client).filter(Boolean))).sort()],
    [items]
  );
  const locationOptions = useMemo(
    () => ["all", ...Array.from(new Set(items.map((p) => p.location).filter(Boolean))).sort()],
    [items]
  );

  /* ---- rows to display (filter accidental _ping__) ---- */
  const displayItems = useMemo(
    () =>
      (items || []).filter((r) => {
        const nm = String(r?.name || "").toLowerCase();
        return nm !== "_ping__" && nm !== "__ping__";
      }),
    [items]
  );

  /* ---- apply year sort client-side ---- */
  const sortedItems = useMemo(() => {
    const list = [...displayItems];

    const commYear = (p) => yearOf(p.commencementDate);
    const compYear = (p) => yearOf(p.completionDate);

    return list.sort((a, b) => {
      switch (yearSort) {
        case "comm_desc": {
          const ay = commYear(a);
          const by = commYear(b);
          const an = ay ?? -Infinity;
          const bn = by ?? -Infinity;
          return bn - an;
        }
        case "comm_asc": {
          const ay = commYear(a);
          const by = commYear(b);
          const an = ay ?? Infinity;
          const bn = by ?? Infinity;
          return an - bn;
        }
        case "comp_desc": {
          const ay = compYear(a);
          const by = compYear(b);
          const an = ay ?? -Infinity;
          const bn = by ?? -Infinity;
          return bn - an;
        }
        case "comp_asc": {
          const ay = compYear(a);
          const by = compYear(b);
          const an = ay ?? Infinity;
          const bn = by ?? Infinity;
          return an - bn;
        }
        default:
          return 0;
      }
    });
  }, [displayItems, yearSort]);

  /* ---- add project ---- */
  const submitAdd = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(currentUserId ? { "x-user-id": currentUserId } : {}) },
      credentials: "include",
      body: JSON.stringify(
        (() => {
          const amt =
            draft.valueAmount === "" || draft.valueAmount === null || draft.valueAmount === undefined
              ? null
              : Number(draft.valueAmount);
          return {
            name: draft.name?.trim(),
            status: draft.status,
            commencementDate: draft.commencementDate || null,
            completionDate: draft.completionDate || null,
            client: draft.client?.trim() || null,
            location: draft.location?.trim() || null,
            valueAmount: amt,
            valueCurrency: draft.valueCurrency,
            description: null,
          };
        })()
      ),
    });
    if (res.ok) {
      setShowAdd(false);
      setDraft({
        name: "",
        commencementDate: new Date().toISOString().slice(0, 10),
        completionDate: "",
        client: "",
        location: "",
        valueAmount: "",
        valueCurrency: "LKR",
        status: "On Going",
      });
      loadProjects();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to add project");
    }
  };

  /* ---- sign out ---- */
  const handleSignOut = async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    window.location.reload();
  };

  return (
    <div>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <Image src={logo} alt="Logo" width={80} height={60} />
            <div className="title">Project Database</div>
          </div>

          <div className="userbar">
            {!currentUser && (
              <Link className="btn" href="/auth/signin" aria-label="Sign in">
                Sign in
              </Link>
            )}
            {currentUser && (
              <>
                <UserMenu user={currentUser} onSignOut={handleSignOut} />
                {(currentUser.role === "admin" || currentUser.role === "manager") && (
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => setAdminOpen(true)}
                    aria-haspopup="dialog"
                    aria-controls="admin-tools"
                  >
                    Admin tools
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="container">
        <div className="filters">
          <input
            className="input"
            placeholder="Search projects, clients, locations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All clients" : c}
              </option>
            ))}
          </select>
          <select className="select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            {locationOptions.map((l) => (
              <option key={l} value={l}>
                {l === "all" ? "All locations" : l}
              </option>
            ))}
          </select>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {["all", "On Going", "Completed", "Terminated"].map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>

          {/* NEW: Sort (Year) */}
          <select className="select" value={yearSort} onChange={(e) => setYearSort(e.target.value)}>
            <option value="none">Sort (Year): None</option>
            <optgroup label="Commencement">
              <option value="comm_desc">Newest → Oldest</option>
              <option value="comm_asc">Oldest → Newest</option>
            </optgroup>
            <optgroup label="Completion">
              <option value="comp_desc">Newest → Oldest</option>
              <option value="comp_asc">Oldest → Newest</option>
            </optgroup>
          </select>
        </div>

        {/* RESULTS + ADD */}
        <div className="results-row">
          <div>{loading ? "Loading..." : `${displayItems.length} result(s)`}</div>
          {allowAdd && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              Add project
            </button>
          )}
        </div>

        {/* TABLE */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Date of commencement</th>
                <th>Date of completion (tentative)</th>
                <th>Client</th>
                <th>Location</th>
                <th>Value</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((p) => {
                const pct = clamp(p.progressPct ?? p.progress ?? 0);
                return (
                  <tr key={p.id || p._id}>
                    <td>
                      <Link href={`/projects/${p._id || p.id}`} className="row-link">
                        {p.name}
                      </Link>
                    </td>
                    <td>{fmtDate(p.commencementDate)}</td>
                    <td>{fmtDate(p.completionDate)}</td>
                    <td>{p.client}</td>
                    <td>{p.location}</td>
                    <td style={{ textAlign: "right" }}>{currency(p.valueAmount, p.valueCurrency)}</td>
                    <td>
                      <span className={statusClass(p.status)}>{p.status}</span>
                    </td>
                    <td>
                      <div className="progress">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                      <div className="note">{pct}%</div>
                    </td>
                  </tr>
                );
              })}
              {!sortedItems.length && !loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                    No projects match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PROJECT MODAL */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div style={{ fontWeight: 700 }}>Add project</div>
              <button className="btn" onClick={() => setShowAdd(false)}>
                Close
              </button>
            </header>
            <div className="content">
              <form onSubmit={submitAdd} className="form">
                <label className="lbl">Project name</label>
                <input
                  className="input"
                  placeholder="Project name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <label className="lbl">Status</label>
                <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option>On Going</option>
                  <option>Completed</option>
                  <option>Terminated</option>
                </select>
                <label className="lbl">Start date</label>
                <input
                  type="date"
                  className="input"
                  value={draft.commencementDate}
                  onChange={(e) => setDraft({ ...draft, commencementDate: e.target.value })}
                />
                <label className="lbl">Completion (tentative)</label>
                <input
                  type="date"
                  className="input"
                  value={draft.completionDate}
                  onChange={(e) => setDraft({ ...draft, completionDate: e.target.value })}
                />
                <label className="lbl">Client</label>
                <input
                  className="input"
                  placeholder="Client"
                  value={draft.client}
                  onChange={(e) => setDraft({ ...draft, client: e.target.value })}
                />
                <label className="lbl">Location</label>
                <input
                  className="input"
                  placeholder="Location"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
                <label className="lbl">Project value</label>
                <div className="grid2">
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    min={0}
                    step="0.01"
                    value={draft.valueAmount}
                    onChange={(e) => setDraft({ ...draft, valueAmount: e.target.value })}
                  />
                  <select
                    className="select"
                    value={draft.valueCurrency}
                    onChange={(e) => setDraft({ ...draft, valueCurrency: e.target.value })}
                  >
                    <option value="LKR">LKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="full" style={{ display: "flex", justifyContent: "end", gap: 8, marginTop: 4 }}>
                  <button type="button" className="btn" onClick={() => setShowAdd(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MODAL */}
      {adminOpen && <AdminToolsModal id="admin-tools" onClose={() => setAdminOpen(false)} />}

      {/* Page-only styles (keep minimal; global.css owns row-link/progress/badge) */}
      <style jsx global>{`
        .userbar {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-chip {
          position: relative;
        }
        .user-chip-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface-2, #f3f6f5);
          border: 1px solid var(--border, #e5e7eb);
          padding: 6px 10px;
          border-radius: var(--radius, 14px);
          cursor: pointer;
        }
        .user-chip-btn:hover {
          box-shadow: var(--shadow, 0 8px 24px rgba(16, 24, 40, 0.06));
        }
        .avatar {
          inline-size: 34px;
          block-size: 34px;
          border-radius: 999px;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #e0ebff;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .avatar img {
          inline-size: 100%;
          block-size: 100%;
          object-fit: cover;
        }
        .avatar.sm {
          inline-size: 28px;
          block-size: 28px;
          font-size: 12px;
        }
        .user-meta {
          display: grid;
          line-height: 1.1;
        }
        .user-meta .name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text, #101828);
        }
        .user-meta .role {
          font-size: 12px;
          color: var(--muted, #667085);
        }
        .user-chip .chev {
          opacity: 0.6;
        }
        .dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          z-index: 40;
          min-inline-size: 180px;
          background: var(--surface, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: var(--radius, 14px);
          box-shadow: var(--shadow, 0 8px 24px rgba(16, 24, 40, 0.06));
          padding: 6px;
        }
        .dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: 0;
          padding: 8px 10px;
          border-radius: 8px;
          color: var(--text, #101828);
          cursor: pointer;
        }
        .dropdown-item:hover {
          background: var(--surface-2, #f3f6f5);
        }
        .admin-btn {
          border: 1px solid var(--border, #e5e7eb);
          background: var(--brand, #2e7d32);
          color: #fff;
          padding: 8px 12px;
          border-radius: var(--radius, 14px);
          font-weight: 600;
        }
        .admin-btn:hover {
          filter: brightness(0.98);
        }
        .tabs {
          display: flex;
          gap: 6px;
        }
        .tab {
          background: var(--surface-2, #f3f6f5);
          border: 1px solid var(--border, #e5e7eb);
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
        }
        .tab.is-active {
          background: #eaf7ee;
          border-color: var(--brand-700, #2b6f2f);
        }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        .table th,
        .table td {
          border-bottom: 1px solid var(--border, #e5e7eb);
          padding: 8px 10px;
          text-align: left;
        }
        .badge-role {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--surface-2, #f3f6f5);
          font-size: 12px;
        }
        @media (max-width: 720px) {
          .user-meta .name {
            font-size: 13px;
          }
          .user-meta .role {
            font-size: 11px;
          }
          .admin-btn {
            padding: 6px 10px;
          }
        }
        .lbl {
          display: block;
          font-weight: 600;
          margin: 10px 0 6px;
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 160px;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
