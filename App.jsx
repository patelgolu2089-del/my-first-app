import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const departments = [
  { id: "general", name: "General Medicine", icon: "🩺" },
  { id: "pediatrics", name: "Pediatrics", icon: "👶" },
  { id: "orthopedics", name: "Orthopedics", icon: "🦴" },
  { id: "gynecology", name: "Gynecology", icon: "🌸" },
  { id: "cardiology", name: "Cardiology", icon: "❤️" },
  { id: "dermatology", name: "Dermatology", icon: "✨" }
];

export default function App() {
  const [view, setView] = useState("home");
  const [department, setDepartment] = useState(departments[0]);
  const [patient, setPatient] = useState({ name: "", phone: "" });
  const [token, setToken] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const currentPosition = useMemo(() => {
    if (!token) return null;
    const waiting = queue.filter(q => q.status === "waiting");
    const index = waiting.findIndex(q => q.token_number === token.token_number);
    return index >= 0 ? index + 1 : 0;
  }, [queue, token]);

  async function loadQueue(dept = department.id) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("queue_tokens")
      .select("*")
      .eq("department", dept)
      .order("created_at", { ascending: true });
    if (!error) setQueue(data || []);
  }

  useEffect(() => {
    loadQueue();
    if (!supabase) return;
    const channel = supabase
      .channel("queue-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" },
        () => loadQueue()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [department.id]);

  async function getToken(e) {
    e.preventDefault();
    setMessage("");
    if (!patient.name.trim() || !patient.phone.trim()) {
      setMessage("Please enter patient name and mobile number.");
      return;
    }
    if (!supabase) {
      setMessage("Supabase is not configured yet. Add the Vercel environment variables first.");
      return;
    }

    setLoading(true);
    try {
      const { data: last } = await supabase
        .from("queue_tokens")
        .select("token_number")
        .eq("department", department.id)
        .order("token_number", { ascending: false })
        .limit(1);

      const next = (last?.[0]?.token_number || 0) + 1;

      const { data, error } = await supabase
        .from("queue_tokens")
        .insert([{
          patient_name: patient.name.trim(),
          phone: patient.phone.trim(),
          department: department.id,
          token_number: next,
          status: "waiting"
        }])
        .select()
        .single();

      if (error) throw error;
      setToken(data);
      await loadQueue();
      setView("token");
    } catch (err) {
      setMessage(err.message || "Could not generate token.");
    } finally {
      setLoading(false);
    }
  }

  async function callNext() {
    if (!supabase) return;
    const next = queue.find(q => q.status === "waiting");
    if (!next) return;
    await supabase.from("queue_tokens").update({ status: "serving" }).eq("id", next.id);
    await loadQueue();
  }

  async function completeCurrent() {
    if (!supabase) return;
    const current = queue.find(q => q.status === "serving");
    if (!current) return;
    await supabase.from("queue_tokens").update({ status: "completed" }).eq("id", current.id);
    await loadQueue();
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")}>
          <span className="logo">+</span>
          <span>Smart Hospital</span>
        </button>
        <nav>
          <button onClick={() => setView("home")}>Patient</button>
          <button onClick={() => setView("dashboard")}>Staff Dashboard</button>
        </nav>
      </header>

      <main>
        {view === "home" && (
          <section className="hero">
            <div className="hero-copy">
              <span className="pill">DIGITAL QUEUE SYSTEM</span>
              <h1>Skip the waiting room.<br/><span>Get your token online.</span></h1>
              <p>Choose a department, enter patient details and receive a live queue token.</p>
              <button className="primary" onClick={() => setView("departments")}>Get a Token →</button>
            </div>
            <div className="hero-card">
              <div className="pulse"></div>
              <div className="big-plus">+</div>
              <h3>Live Queue</h3>
              <p>Real-time token updates</p>
            </div>
          </section>
        )}

        {view === "departments" && (
          <section className="panel">
            <button className="back" onClick={() => setView("home")}>← Back</button>
            <h2>Choose Department</h2>
            <p className="muted">Select the department you want to visit.</p>
            <div className="grid">
              {departments.map(d => (
                <button key={d.id} className="dept" onClick={() => { setDepartment(d); setView("patient"); }}>
                  <span>{d.icon}</span><strong>{d.name}</strong><small>Get queue token</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "patient" && (
          <section className="panel narrow">
            <button className="back" onClick={() => setView("departments")}>← Departments</button>
            <div className="selected">{department.icon} {department.name}</div>
            <h2>Patient Details</h2>
            <form onSubmit={getToken}>
              <label>Patient name<input value={patient.name} onChange={e => setPatient({...patient, name:e.target.value})} placeholder="Enter full name" /></label>
              <label>Mobile number<input value={patient.phone} onChange={e => setPatient({...patient, phone:e.target.value})} placeholder="10-digit mobile number" inputMode="numeric" /></label>
              {message && <div className="error">{message}</div>}
              <button className="primary full" disabled={loading}>{loading ? "Generating..." : "Generate Token"}</button>
            </form>
          </section>
        )}

        {view === "token" && token && (
          <section className="panel narrow center">
            <span className="success">TOKEN GENERATED</span>
            <h2>Your Queue Token</h2>
            <div className="token">{String(token.token_number).padStart(3, "0")}</div>
            <h3>{department.name}</h3>
            <p className="muted">Patient: {token.patient_name}</p>
            <div className="position"><strong>{currentPosition || "—"}</strong><span>people ahead</span></div>
            <button className="secondary full" onClick={() => { loadQueue(); }}>↻ Refresh Queue</button>
            <button className="linkbtn" onClick={() => setView("home")}>Back to Home</button>
          </section>
        )}

        {view === "dashboard" && (
          <section className="panel">
            <div className="dash-head">
              <div><span className="pill">STAFF</span><h2>Queue Dashboard</h2></div>
              <select value={department.id} onChange={e => setDepartment(departments.find(d => d.id === e.target.value))}>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="actions">
              <button className="primary" onClick={callNext}>Call Next Patient</button>
              <button className="secondary" onClick={completeCurrent}>Complete Current</button>
            </div>
            <div className="queue">
              {queue.length === 0 && <div className="empty">No patients in this department yet.</div>}
              {queue.map(q => (
                <div className={`queue-row ${q.status}`} key={q.id}>
                  <strong>#{String(q.token_number).padStart(3,"0")}</strong>
                  <span>{q.patient_name}</span>
                  <small>{q.status}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer>Smart Hospital Queue • Built for simple, faster patient flow</footer>
    </div>
  );
}