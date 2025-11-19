"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) r.push("/");
    else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Failed to sign in");
    }
  };

  return (
    <div className="center">
      <div className="card-auth">
        <h1>Sign In</h1>
        <form onSubmit={submit}>
          <div className="field">
            <label>email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com"/>
          </div>
          <div className="field">
            <label>password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••"/>
          </div>
          <div className="row">
            <button className="btn btn-primary">Sign in</button>
          </div>
          {err && <div className="small" style={{color:"#b91c1c"}}>{err}</div>}
        </form>
        <div className="small">
          No account? <a className="link" href="/auth/signup">Create one</a>
        </div>
      </div>
    </div>
  );
}
