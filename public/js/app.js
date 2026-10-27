const TYPES = ["Designer", "Project Manager", "Marketing", "Developer", "DevOps"];
const S = { users: [], tasks: [], sessions: [], me: null, tab: null, ready: 0, isOwner: false };
let TOK = null, charts = [], dirty = false;

async function API(m, p, b) {
  const r = await fetch("/api" + p, {
    method: m,
    headers: {
      "Content-Type": "application/json",
      ...(TOK ? { Authorization: "Bearer " + TOK } : {})
    },
    body: b ? JSON.stringify(b) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && TOK) logout();
    throw { message: j.error || "Request failed" };
  }
  return j;
}

const db = {
  doc: (p) => {
    const [c, i] = p.split("/"), u = `/${c}/${i}`;
    return {
      set: (d) => API("PUT", u, d).then(load),
      update: (d) => API("PATCH", u, d).then(load),
      delete: () => API("DELETE", u).then(load)
    };
  }
};

const dl = {
  save: ({ filename, data }) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
    a.download = filename;
    a.click();
    return Promise.resolve();
  }
};

async function load() {
  if (!TOK) return;
  const j = await API("GET", "/data");
  Object.assign(S, j, { ready: 7 });
  if (!user(S.me)) return logout();
  refresh();
}

function logout() {
  TOK = null;
  S.me = null;
  S.tab = null;
  S.users = [];
  try {
    localStorage.removeItem("tc_tok");
    localStorage.removeItem("tc_me");
  } catch (e) {}
  render();
}

async function auth(p, b) {
  const j = await API("POST", p, b);
  TOK = j.token;
  S.me = j.id;
  S.tab = null;
  try {
    localStorage.setItem("tc_tok", TOK);
    localStorage.setItem("tc_me", j.id);
  } catch (e) {}
  await load();
}

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Robust ID generator: always produces an 18-character lowercase string
const uid = () => "id" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

const hrs = (ms) => (ms / 36e5).toFixed(1);
const dur = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1e3);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, "0")).join(":");
};
const fdt = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "–");
const day = (t) => {
  const d = new Date(t);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const weekStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const worked = (s) => (s.end || Date.now()) - s.start - (s.breaks || []).reduce((a, b) => a + ((b.e || s.end || Date.now()) - b.s), 0);
const user = (id) => S.users.find((u) => u.id === id);
const tname = (id) => S.tasks.find((t) => t.id === id)?.title || "–";
const active = (id) => S.sessions.find((s) => s.uid === id && !s.end);

function tstate(t) {
  if (t.status === "Done") return ["Done", "done"];
  const d = new Date(t.deadline + "T23:59:59").getTime();
  if (d < Date.now()) return ["Overdue", "over"];
  if (d - Date.now() < 864e5 * 2) return ["Due soon", "soon"];
  return ["On track", ""];
}

async function init() {
  try {
    TOK = localStorage.getItem("tc_tok");
    S.me = localStorage.getItem("tc_me");
  } catch (e) {}

  try {
    S.needsSetup = (await API("GET", "/state")).needsSetup;
  } catch (e) {
    $("#app").innerHTML = '<main><div class="card">Cannot reach the server. Check the deployment and environment variables.</div></main>';
    return;
  }

  S.ready = 7;
  if (TOK) {
    try { await load(); } catch (e) {}
  }

  render();
  setInterval(tick, 1000);
  setInterval(() => {
    if (TOK) load().catch(() => {});
  }, 5000);
}

function refresh() {
  if (S.ready < 7) return;
  const a = document.activeElement;
  if (a && /INPUT|SELECT/.test(a.tagName) && a.closest("main")) {
    dirty = true;
    return;
  }
  render();
}

document.addEventListener("focusout", () => {
  if (dirty) {
    setTimeout(() => {
      if (!/INPUT|SELECT/.test(document.activeElement.tagName)) {
        dirty = false;
        render();
      }
    }, 50);
  }
});

function tick() {
  const e = $("#tm");
  if (!e) return;
  const s = active(S.me);
  if (s) e.textContent = dur(worked(s));
}

function render() {
  dirty = false;
  charts.forEach((c) => c.destroy());
  charts = [];
  const me = user(S.me);
  if (!me) return S.needsSetup ? setupView() : loginView();

  const adm = me.role === "admin";
  if (!S.tab) S.tab = adm ? "analytics" : "track";

  $("#app").innerHTML = `
    <header>
      <div class="logo">Team<span>Clock</span></div>
      <div class="row">
        <span class="mu">${esc(me.name)} · ${adm ? "Admin / Project Manager" : esc(me.workType)}</span>
        <button id="out">Log out</button>
      </div>
    </header>
    <main>${adm ? adminView() : empView(me)}</main>
  `;

  $("#out").onclick = async () => {
    const s = active(S.me);
    if (s && !confirm("You are still clocked in. Log out anyway? (Your time keeps running until you clock out.)")) return;
    logout();
  };

  bind(me);
  if (adm && S.tab === "analytics") drawCharts();
}

function loginView() {
  $("#app").innerHTML = `
    <div class="login card">
      <div class="logo" style="margin-bottom:10px">Team<span>Clock</span></div>
      <label>Username</label><input id="lu" autocomplete="username">
      <label>Password</label><input id="lp" type="password" autocomplete="current-password">
      <div class="err" id="le"></div>
      <button class="p" id="lb" style="width:100%">Log in &amp; start day</button>
    </div>
  `;
  const go = async () => {
    try {
      await auth("/login", { username: $("#lu").value.trim().toLowerCase(), password: $("#lp").value });
    } catch (e) {
      $("#le").textContent = e.message;
    }
  };
  $("#lb").onclick = go;
  $("#lp").onkeydown = (e) => e.key === "Enter" && go();
}

function setupView() {
  $("#app").innerHTML = `
    <div class="login card">
      <h2>First-time setup</h2>
      <p class="mu">Create the Project Manager (admin) account.</p>
      <label>Full name</label><input id="sn">
      <label>Username</label><input id="su">
      <label>Password</label><input id="sp" type="password">
      <div class="err" id="se"></div>
      <button class="p" id="sb" style="width:100%">Create admin</button>
    </div>
  `;
  $("#sb").onclick = async () => {
    const n = $("#sn").value.trim(), u = $("#su").value.trim().toLowerCase(), p = $("#sp").value;
    if (!n || !u || p.length < 4) {
      $("#se").textContent = "Fill all fields (password 4+ characters).";
      return;
    }
    try {
      await auth("/setup", { name: n, username: u, password: p });
    } catch (e) {
      $("#se").textContent = e.message;
    }
  };
}

function empView(me) {
  const s = active(me.id), b = s && (s.breaks || []).find((x) => !x.e);
  const mine = S.tasks.filter((t) => t.assignee === me.id).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const opts = mine.filter((t) => t.status !== "Done").map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join("");
  const ws = weekStart(), logs = S.sessions.filter((x) => x.uid === me.id && x.end).sort((a, b) => b.start - a.start);
  const wk = logs.filter((x) => x.start >= ws).reduce((a, x) => a + worked(x), 0) + (s ? worked(s) : 0);

  const clock = s
    ? `<div class="mu">Clocked in as <b>${esc(s.type)}</b> since ${fdt(s.start)}${s.taskId ? " · " + esc(tname(s.taskId)) : ""}</div>
       <div class="timer" id="tm">${dur(worked(s))}</div>
       <div class="row">
         ${b ? `<button class="w" id="bk">Resume work</button>` : `<button id="bk">Start break</button>`}
         <button class="d" id="co">Clock out</button>
       </div>${b ? '<p class="mu">On break – timer is paused.</p>' : ""}`
    : `<div class="mu">You are not clocked in.</div>
       <label>Work type</label>
       <select id="wt">${TYPES.map((t) => `<option ${t === me.workType ? "selected" : ""}>${t}</option>`).join("")}</select>
       <label>Working on (optional)</label>
       <select id="wk"><option value="">– No specific task –</option>${opts}</select>
       <div style="margin-top:12px"><button class="p" id="ci">Clock in</button></div>`;

  const tabs = `
    <div class="tabs">
      <button data-t="track" class="${S.tab === "track" ? "on" : ""}">Time tracking</button>
      <button data-t="tasks" class="${S.tab === "tasks" ? "on" : ""}">My tasks (${mine.filter((t) => t.status !== "Done").length})</button>
      <button data-t="sheet" class="${S.tab === "sheet" ? "on" : ""}">Weekly timesheet</button>
    </div>
  `;

  let body = "";
  if (S.tab === "track") body = `<div class="grid"><div class="card"><h2>Work session</h2>${clock}</div><div class="card"><h2>This week</h2><div class="timer">${hrs(wk)} h</div><div class="mu">Break time is not counted.</div></div></div>`;
  if (S.tab === "tasks") body = `<div class="card scroll"><h2>My tasks</h2>${mine.length ? `<table><tr><th>Task</th><th>Deadline</th><th>State</th><th>Status</th></tr>${mine.map((t) => { const [l, c] = tstate(t); return `<tr><td>${esc(t.title)}</td><td>${t.deadline}</td><td><span class="tag ${c}">${l}</span></td><td><select data-st="${t.id}" style="width:auto">${["To do", "In progress", "Done"].map((x) => `<option ${x === t.status ? "selected" : ""}>${x}</option>`).join("")}</select></td></tr>`; }).join("")}</table>` : '<p class="mu">No tasks assigned yet.</p>'}</div>`;
  if (S.tab === "sheet") body = sheetCard(logs.filter((x) => x.start >= ws), "My timesheet – this week");

  return tabs + body;
}

function sheetCard(rows, title, showUser) {
  return `
    <div class="card scroll">
      <div class="row" style="justify-content:space-between">
        <h2>${title}</h2>
        <button id="csv">Export CSV</button>
      </div>
      ${rows.length ? `<table><tr>${showUser ? "<th>Employee</th>" : ""}<th>Date</th><th>Work type</th><th>Task</th><th>In</th><th>Out</th><th>Break (min)</th><th>Hours</th></tr>${rows.map((x) => `<tr>${showUser ? `<td>${esc(user(x.uid)?.name)}</td>` : ""}<td>${day(x.start)}</td><td>${esc(x.type)}</td><td>${esc(tname(x.taskId))}</td><td>${new Date(x.start).toLocaleTimeString([], { timeStyle: "short" })}</td><td>${x.end ? new Date(x.end).toLocaleTimeString([], { timeStyle: "short" }) : "active"}</td><td>${Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4)}</td><td>${hrs(worked(x))}</td></tr>`).join("")}</table>` : '<p class="mu">No records.</p>'}
    </div>
  `;
}

function adminView() {
  const T = [["analytics", "Analytics"], ["tasks", "Tasks"], ["team", "Team"], ["logs", "Time logs"]];
  const tabs = `<div class="tabs">${T.map(([k, l]) => `<button data-t="${k}" class="${S.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const emps = S.users.filter((u) => u.role !== "admin");

  if (S.tab === "analytics") {
    const ws = weekStart(), wkS = S.sessions.filter((x) => (x.end || Date.now()) >= ws);
    const total = wkS.reduce((a, x) => a + worked(x), 0), on = S.sessions.filter((x) => !x.end);
    const od = S.tasks.filter((t) => tstate(t)[1] === "over").length, dn = S.tasks.filter((t) => t.status === "Done").length;
    return tabs + `
      <div class="kpis">
        <div class="kpi"><b>${hrs(total)}</b><small>Hours this week</small></div>
        <div class="kpi"><b>${on.length}</b><small>Clocked in now</small></div>
        <div class="kpi"><b>${S.tasks.length ? Math.round((dn / S.tasks.length) * 100) : 0}%</b><small>Tasks completed</small></div>
        <div class="kpi"><b style="color:var(--er)">${od}</b><small>Overdue tasks</small></div>
      </div>
      <div class="card">
        <h2>Who is working now</h2>
        ${on.length ? on.map((x) => `<span class="tag done" style="margin:2px">${esc(user(x.uid)?.name)} · ${esc(x.type)}${(x.breaks || []).some((b) => !b.e) ? " (break)" : ""}</span>`).join("") : '<span class="mu">Nobody is clocked in.</span>'}
      </div>
      <div class="grid">
        <div class="card"><h2>Hours per employee (this week)</h2><div class="ch"><canvas id="c1"></canvas></div></div>
        <div class="card"><h2>Hours by work type (this week)</h2><div class="ch"><canvas id="c2"></canvas></div></div>
        <div class="card"><h2>Daily hours – last 7 days</h2><div class="ch"><canvas id="c3"></canvas></div></div>
        <div class="card"><h2>Task status</h2><div class="ch"><canvas id="c4"></canvas></div></div>
      </div>
    `;
  }

  if (S.tab === "tasks") {
    const ts = [...S.tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
    return tabs + `
      <div class="card">
        <h2>Create task</h2>
        <div class="grid">
          <div><label>Title</label><input id="nt"></div>
          <div><label>Assign to</label><select id="na">${emps.map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.workType)})</option>`).join("")}</select></div>
          <div><label>Deadline</label><input id="nd" type="date"></div>
        </div>
        <div style="margin-top:12px">
          <button class="p" id="ac">Add task</button>
          <span class="err" id="te"></span>
        </div>
      </div>
      <div class="card scroll">
        <h2>All tasks</h2>
        ${ts.length ? `<table><tr><th>Task</th><th>Assignee</th><th>Deadline</th><th>State</th><th>Status</th><th></th></tr>${ts.map((t) => { const [l, c] = tstate(t); return `<tr><td>${esc(t.title)}</td><td>${esc(user(t.assignee)?.name)}</td><td><input type="date" data-dl="${t.id}" value="${t.deadline}" style="width:auto"></td><td><span class="tag ${c}">${l}</span></td><td>${esc(t.status)}</td><td><button class="d" data-dt="${t.id}">Delete</button></td></tr>`; }).join("")}</table>` : '<p class="mu">No tasks yet.</p>'}
      </div>
    `;
  }

  if (S.tab === "team") {
    return tabs + `
      <div class="card">
        <h2>Create employee login</h2>
        <div class="grid">
          <div><label>Full name</label><input id="en"></div>
          <div><label>Username</label><input id="eu"></div>
          <div><label>Password</label><input id="ep" type="text"></div>
          <div><label>Work type / role</label><select id="et">${TYPES.map((t) => `<option>${t}</option>`).join("")}</select></div>
        </div>
        <div style="margin-top:12px">
          <button class="p" id="ae">Create employee</button>
          <span class="err" id="ee"></span>
        </div>
      </div>
      <div class="card scroll">
        <h2>Team (${emps.length})</h2>
        ${emps.length ? `<table><tr><th>Name</th><th>Username</th><th>Work type</th><th>Status</th><th></th></tr>${emps.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.workType)}</td><td>${active(u.id) ? '<span class="tag done">Clocked in</span>' : '<span class="tag">Offline</span>'}</td><td><button data-rp="${u.id}">Reset password</button> <button class="d" data-du="${u.id}">Remove</button></td></tr>`).join("")}</table>` : '<p class="mu">No employees yet.</p>'}
      </div>
    `;
  }

  return tabs + sheetCard([...S.sessions].sort((a, b) => b.start - a.start), "All time logs", true);
}

function drawCharts() {
  const emps = S.users.filter((u) => u.role !== "admin"), ws = weekStart(), C = ["#4f46e5", "#0ea5e9", "#16a34a", "#d97706", "#dc2626", "#9333ea"];
  const tx = getComputedStyle(document.documentElement).getPropertyValue("--tx").trim() || "#888";
  Chart.defaults.color = tx;

  const wk = S.sessions.filter((x) => (x.end || Date.now()) >= ws);
  const mk = (id, cfg) => charts.push(new Chart($(id), { ...cfg, options: { responsive: true, maintainAspectRatio: false, ...cfg.options } }));

  mk("#c1", {
    type: "bar",
    data: {
      labels: emps.map((u) => u.name),
      datasets: [{ label: "Hours", data: emps.map((u) => +hrs(wk.filter((x) => x.uid === u.id).reduce((a, x) => a + worked(x), 0))), backgroundColor: C[0] }]
    },
    options: { plugins: { legend: { display: false } } }
  });

  mk("#c2", {
    type: "doughnut",
    data: {
      labels: TYPES,
      datasets: [{ data: TYPES.map((t) => +hrs(wk.filter((x) => x.type === t).reduce((a, x) => a + worked(x), 0))), backgroundColor: C }]
    }
  });

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return day(d);
  });

  mk("#c3", {
    type: "line",
    data: {
      labels: days.map((d) => d.slice(5)),
      datasets: [{ label: "Hours", data: days.map((d) => +hrs(S.sessions.filter((x) => day(x.start) === d).reduce((a, x) => a + worked(x), 0))), borderColor: C[1], backgroundColor: C[1] + "33", fill: true, tension: 0.3 }]
    },
    options: { plugins: { legend: { display: false } } }
  });

  const st = ["To do", "In progress", "Done"], od = S.tasks.filter((t) => tstate(t)[1] === "over").length;
  mk("#c4", {
    type: "doughnut",
    data: {
      labels: [...st, "Overdue"],
      datasets: [{ data: [...st.map((s) => S.tasks.filter((t) => t.status === s && tstate(t)[1] !== "over").length), od], backgroundColor: ["#94a3b8", "#0ea5e9", "#16a34a", "#dc2626"] }]
    }
  });
}

function bind(me) {
  document.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.t; render(); }));
  const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };

  on("#ci", async () => {
    try {
      await db.doc("sessions/" + uid()).set({ uid: me.id, type: $("#wt").value, taskId: $("#wk").value, start: Date.now(), end: null, breaks: [] });
    } catch (err) {
      alert("Clock-in failed: " + err.message);
    }
  });

  on("#co", async () => {
    const s = active(me.id);
    if (!s) return;
    const br = (s.breaks || []).map((b) => (b.e ? b : { ...b, e: Date.now() }));
    try {
      await db.doc("sessions/" + s.id).update({ end: Date.now(), breaks: br });
    } catch (err) {
      alert("Clock-out failed: " + err.message);
    }
  });

  on("#bk", async () => {
    const s = active(me.id);
    if (!s) return;
    const br = [...(s.breaks || [])], o = br.find((x) => !x.e);
    if (o) o.e = Date.now();
    else br.push({ s: Date.now(), e: null });
    try {
      await db.doc("sessions/" + s.id).update({ breaks: br.map((x) => ({ ...x })) });
    } catch (err) {
      alert("Break update failed: " + err.message);
    }
  });

  document.querySelectorAll("[data-st]").forEach((s) => (s.onchange = () => s.value && db.doc("tasks/" + s.dataset.st).update({ status: s.value }).catch((e) => alert(e.message))));
  document.querySelectorAll("[data-dl]").forEach((s) => (s.onchange = () => s.value && db.doc("tasks/" + s.dataset.dl).update({ deadline: s.value }).catch((e) => alert(e.message))));
  document.querySelectorAll("[data-dt]").forEach((b) => (b.onclick = () => confirm("Delete this task?") && db.doc("tasks/" + b.dataset.dt).delete().catch((e) => alert(e.message))));
  document.querySelectorAll("[data-du]").forEach((b) => (b.onclick = () => confirm("Remove this employee?") && db.doc("users/" + b.dataset.du).delete().catch((e) => alert(e.message))));

  document.querySelectorAll("[data-rp]").forEach((b) => (b.onclick = async () => {
    const p = prompt("New password (4+ characters):");
    if (!p || p.length < 4) return;
    const u = user(b.dataset.rp);
    try {
      await db.doc("users/" + u.id).update({ password: p });
      alert("Password updated successfully");
    } catch (err) {
      alert("Password reset failed: " + err.message);
    }
  }));

  on("#ac", async () => {
    const t = $("#nt").value.trim(), a = $("#na").value, d = $("#nd").value;
    if (!t || !a || !d) {
      $("#te").textContent = "Title, assignee and deadline are required.";
      return;
    }
    $("#te").textContent = "";
    try {
      await db.doc("tasks/" + uid()).set({ title: t, assignee: a, deadline: d, status: "To do", created: Date.now() });
      $("#nt").value = "";
    } catch (err) {
      $("#te").textContent = err.message || "Failed to create task";
    }
  });

  // Fixed employee creation with inline feedback
  on("#ae", async () => {
    const n = $("#en").value.trim(), u = $("#eu").value.trim().toLowerCase(), p = $("#ep").value;
    if (!n || !u || p.length < 4) {
      $("#ee").textContent = "Fill all fields (password 4+ characters).";
      return;
    }
    if (S.users.some((x) => x.username === u)) {
      $("#ee").textContent = "Username already exists.";
      return;
    }

    $("#ee").textContent = "Creating employee...";
    try {
      await db.doc("users/" + uid()).set({
        name: n,
        username: u,
        password: p,
        role: "employee",
        workType: $("#et").value
      });
      $("#ee").textContent = "";
      alert("Employee created successfully.\nUsername: " + u + "\nPassword: " + p);
      $("#en").value = "";
      $("#eu").value = "";
      $("#ep").value = "";
    } catch (err) {
      $("#ee").textContent = err.message || "Failed to create employee";
    }
  });

  on("#csv", () => {
    const adm = me.role === "admin";
    const rows = (adm ? S.sessions : S.sessions.filter((x) => x.uid === me.id && x.start >= weekStart())).sort((a, b) => b.start - a.start);
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = [
      "Employee,Date,Work type,Task,Clock in,Clock out,Break minutes,Hours",
      ...rows.map((x) => [
        user(x.uid)?.name,
        day(x.start),
        x.type,
        tname(x.taskId),
        fdt(x.start),
        fdt(x.end),
        Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4),
        hrs(worked(x))
      ].map(q).join(","))
    ].join("\n");

    if (dl) dl.save({ filename: "timesheet.csv", data: csv }).catch(() => {});
    else alert("Download is not available here.");
  });
}

init();