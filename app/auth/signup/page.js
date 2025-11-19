"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (res.ok) r.push("/");
    else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Failed to sign up");
    }
  };

  return (
    <div className="center">
      <div className="card-auth">
        <h1>Sign Up</h1>
        <form onSubmit={submit}>
          <div className="field">
            <label>name</label>
            <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Full name"/>
          </div>
          <div className="field">
            <label>email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com"/>
          </div>
          <div className="field">
            <label>password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Create a password"/>
          </div>
          <div className="row">
            <button className="btn btn-primary">Create account</button>
          </div>
          {err && <div className="small" style={{color:"#b91c1c"}}>{err}</div>}
        </form>
        <div className="small">
          Already have an account? <a className="link" href="/auth/signin">Sign in</a>
        </div>
      </div>
    </div>
  );
}
