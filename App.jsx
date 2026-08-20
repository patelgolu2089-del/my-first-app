import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const departments = [
  {id:"general",name:"General Medicine",icon:"🩺"},
  {id:"pediatrics",name:"Pediatrics",icon:"👶"},
  {id:"orthopedics",name:"Orthopedics",icon:"🦴"},
  {id:"gynecology",name:"Gynecology",icon:"🌸"},
  {id:"cardiology",name:"Cardiology",icon:"❤️"},
  {id:"dermatology",name:"Dermatology",icon:"✨"}
];

function AdminDashboard({onLogout}) {
  const [rows,setRows]=useState([]);
  useEffect(()=>{
    let live=true;
    async function load(){
      const {data,error}=await supabase.from("queue_tokens").select("*").order("created_at",{ascending:false}).limit(500);
      if(live && !error) setRows(data||[]);
    }
    load();
    return ()=>{live=false};
  },[]);
  return <section className="panel">
    <div className="dash-head">
      <div><span className="pill">ADMIN</span><h2>Admin Dashboard</h2><p className="muted">Hospital-wide queue overview</p></div>
      <button className="secondary" onClick={onLogout}>Sign out</button>
    </div>
    <div className="admin-grid">
      {departments.map(d=>{
        const r=rows.filter(x=>x.department===d.id);
        return <div className="admin-card" key={d.id}>
          <div className="admin-title"><span>{d.icon}</span><strong>{d.name}</strong></div>
          <div className="admin-counts">
            <span><b>{r.filter(x=>x.status==="waiting").length}</b>Waiting</span>
            <span><b>{r.filter(x=>x.status==="serving").length}</b>Serving</span>
            <span><b>{r.filter(x=>x.status==="completed").length}</b>Done</span>
          </div>
        </div>
      })}
    </div>
  </section>;
}

export default function App(){
  const [view,setView]=useState("home");
  const [dept,setDept]=useState(departments[0]);
  const [session,setSession]=useState(null);
  const [loginMode,setLoginMode]=useState("staff");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loginError,setLoginError]=useState("");
  const [patient,setPatient]=useState({name:"",phone:""});
  const [token,setToken]=useState(null);
  const [queue,setQueue]=useState([]);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  async function loadQueue(){
    const {data}=await supabase.from("queue_tokens").select("*").eq("department",dept.id).order("created_at",{ascending:true});
    setQueue(data||[]);
  }
  useEffect(()=>{loadQueue()},[dept.id]);

  const serving=queue.find(x=>x.status==="serving");
  const waiting=queue.filter(x=>x.status==="waiting");
  const completed=queue.filter(x=>x.status==="completed");

  async function login(e){
    e.preventDefault(); setLoginError(""); setLoading(true);
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error){setLoginError(error.message);}
    else{setPassword("");setView(loginMode==="admin"?"admin":"dashboard");}
    setLoading(false);
  }
  async function logout(){await supabase.auth.signOut();setView("home");}
  async function generateToken(e){
    e.preventDefault();setMessage("");setLoading(true);
    const {data:last}=await supabase.from("queue_tokens").select("token_number").eq("department",dept.id).order("token_number",{ascending:false}).limit(1);
    const next=(last?.[0]?.token_number||0)+1;
    const {data,error}=await supabase.from("queue_tokens").insert([{
      patient_name:patient.name.trim(),phone:patient.phone.trim(),department:dept.id,
      token_number:next,status:"waiting"
    }]).select().single();
    if(error)setMessage(error.message);
    else{setToken(data);setView("token");await loadQueue();}
    setLoading(false);
  }
  async function callNext(){
    if(serving)await supabase.from("queue_tokens").update({status:"completed"}).eq("id",serving.id);
    const next=queue.find(x=>x.status==="waiting");
    if(next)await supabase.from("queue_tokens").update({status:"serving"}).eq("id",next.id);
    await loadQueue();
  }
  async function complete(){
    if(serving)await supabase.from("queue_tokens").update({status:"completed"}).eq("id",serving.id);
    await loadQueue();
  }

  return <div className="app">
    <header className="topbar">
      <button className="brand" onClick={()=>setView("home")}><span className="logo">+</span>Smart Hospital</button>
      <nav>
        <button onClick={()=>setView("home")}>Patient</button>
        <button onClick={()=>{setLoginMode("staff");setView(session?"dashboard":"login")}}>Staff</button>
        <button onClick={()=>setView("display")}>Display</button>
        <button onClick={()=>{setLoginMode("admin");setView("login")}}>Admin</button>
      </nav>
    </header>
    <main>
      {view==="home" && <section className="hero"><div><span className="pill">DIGITAL QUEUE SYSTEM</span><h1>Skip the waiting room.<br/><span>Get your token online.</span></h1><p>Smart Hospital – Naighari digital queue.</p><button className="primary" onClick={()=>setView("departments")}>Get a Token →</button></div></section>}

      {view==="login" && <section className="panel narrow">
        <button className="back" onClick={()=>setView("home")}>← Back</button>
        <span className="pill">{loginMode==="admin"?"ADMIN ACCESS":"STAFF ACCESS"}</span>
        <h2>{loginMode==="admin"?"Admin Login":"Staff Login"}</h2>
        <p className="muted">Sign in to continue.</p>
        <form onSubmit={login}>
          <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/></label>
          <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/></label>
          {loginError&&<div className="error">{loginError}</div>}
          <button className="primary full" disabled={loading}>{loading?"Signing in...":"Sign in"}</button>
        </form>
      </section>}

      {view==="departments" && <section className="panel"><h2>Choose Department</h2><div className="grid">{departments.map(d=>
        <button className="dept" key={d.id} onClick={()=>{setDept(d);setView("patient")}}><span>{d.icon}</span><strong>{d.name}</strong><small>Get queue token</small></button>)}</div></section>}

      {view==="patient" && <section className="panel narrow"><button className="back" onClick={()=>setView("departments")}>← Departments</button><h2>Patient Details</h2>
        <form onSubmit={generateToken}>
          <label>Name<input required value={patient.name} onChange={e=>setPatient({...patient,name:e.target.value})}/></label>
          <label>Mobile<input required value={patient.phone} onChange={e=>setPatient({...patient,phone:e.target.value})}/></label>
          {message&&<div className="error">{message}</div>}
          <button className="primary full" disabled={loading}>{loading?"Generating...":"Generate Token"}</button>
        </form>
      </section>}

      {view==="token" && token && <section className="panel narrow center"><span className="success">TOKEN GENERATED</span><h2>Your Queue Token</h2><div className="token">{String(token.token_number).padStart(2,"0")}</div><h3>{dept.name}</h3><p className="muted">{token.patient_name}</p><button className="secondary full" onClick={loadQueue}>↻ Refresh Queue</button></section>}

      {view==="dashboard" && session && <section className="panel">
        <div className="dash-head"><div><span className="pill">STAFF</span><h2>Queue Dashboard</h2></div><div><select value={dept.id} onChange={e=>setDept(departments.find(d=>d.id===e.target.value))}>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="secondary" onClick={logout}>Sign out</button></div></div>
        <div className="stats"><div><b>{waiting.length}</b><span>Waiting</span></div><div><b>{serving?1:0}</b><span>Serving</span></div><div><b>{completed.length}</b><span>Completed</span></div></div>
        <div className="now"><small>NOW SERVING</small><strong>{serving?String(serving.token_number).padStart(2,"0"):"—"}</strong><span>{serving?.patient_name||"No patient currently serving"}</span></div>
        <div className="actions"><button className="primary" onClick={callNext}>Call Next Patient</button><button className="secondary" onClick={complete}>Complete Current</button></div>
        {queue.map(q=><div className={"queue-row "+q.status} key={q.id}><strong>#{String(q.token_number).padStart(2,"0")}</strong><span>{q.patient_name}</span><small>{q.status}</small></div>)}
      </section>}

      {view==="admin" && session && <AdminDashboard onLogout={logout}/>}

      {view==="display" && <section className="display-page"><div className="display-top"><span>SMART HOSPITAL – NAIGHARI</span><button onClick={()=>setView(session?"dashboard":"login")}>{session?"Staff Dashboard":"Staff Login"}</button></div><select value={dept.id} onChange={e=>setDept(departments.find(d=>d.id===e.target.value))}>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><p className="display-label">NOW SERVING</p><div className="display-token">{serving?String(serving.token_number).padStart(2,"0"):"—"}</div><h2>{dept.name}</h2><div className="next-box"><span>WAITING</span><strong>{waiting.slice(0,5).map(q=>String(q.token_number).padStart(2,"0")).join(" • ")||"No waiting patients"}</strong></div></section>}
    </main>
    <footer>Smart Hospital Queue • Naighari</footer>
  </div>;
}
