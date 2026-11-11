/* Client Updates: tracks when each client's website is due for an update.
   Everything is saved in this browser (localStorage). Use Settings → Download backup to keep a copy. */

// Storage name kept the same so existing saved clients are not lost.
const KEY = "nestlewood-client-updates-v1";
const DEFAULT_PLANS = [
  { id: "template", name: "Template", every: 30 },
  { id: "custom", name: "Custom", every: 14 },
];

/* ---------- Data ---------- */
let db = load();
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.clients) return d; } catch (e) {}
  return { plans: DEFAULT_PLANS.slice(), clients: [] };
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
const uid = () => Math.random().toString(36).slice(2, 10);
const plan = (id) => db.plans.find((p) => p.id === id) || { name: "No plan", every: 30 };

/* ---------- Dates (local, by day) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (s) => Math.round((parse(s) - parse(today())) / 86400000); // days from today
const nice = (s) => parse(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
function whenText(s) {
  const n = diff(s);
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} overdue`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days`;
}

/* ---------- Buckets ---------- */
function bucket(c) {
  if (c.status !== "active") return "paused";
  const n = diff(c.next);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n <= 7) return "week";
  return "later";
}
const BUCKETS = {
  overdue: { title: "Overdue", color: "red", blurb: "Past their update date" },
  today: { title: "Today", color: "orange", blurb: "Due today" },
  week: { title: "This Week", color: "blue", blurb: "Due in the next 7 days" },
};
const inBucket = (b) => db.clients.filter((c) => bucket(c) === b).sort((a, z) => a.next.localeCompare(z.next));

/* ---------- Helpers ---------- */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = document.getElementById("view");
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }
const link = (u) => (u && !/^https?:\/\//.test(u) ? "https://" + u : u);

/* ---------- Views ---------- */
function dashboard() {
  const active = db.clients.filter((c) => c.status === "active").length;
  const paused = db.clients.length - active;
  const counts = { overdue: inBucket("overdue").length, today: inBucket("today").length, week: inBucket("week").length };
  const tile = (b) => `
    <a class="tile ${b} ${counts[b] ? "" : "zero"}" href="#/due/${b}">
      <div class="text"><div class="label"><i></i>${BUCKETS[b].title}</div><div class="sub">${BUCKETS[b].blurb}</div></div>
      <div class="num">${counts[b]}</div>
      <div class="sub tile-foot">${counts[b] ? `<b>View clients →</b>` : "Nothing here"}</div>
    </a>`;
  const clear = !counts.overdue && !counts.today && active
    ? `<div class="allclear">✓ You're all caught up. Nothing overdue or due today.</div>` : "";
  view.innerHTML = `<div class="wrap">
    <div class="head"><div><p class="eyebrow">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>Website <em>updates</em></h1></div></div>
    ${db.clients.length ? `<div class="tiles">${tile("overdue")}${tile("today")}${tile("week")}</div>${clear}
      <div class="summary"><span><b>${active}</b> active client${active === 1 ? "" : "s"}</span><span><b>${paused}</b> paused</span><a href="#/clients" style="color:var(--accent-dark);font-weight:600">All clients →</a></div>`
      : `<div class="empty"><h3>No clients yet</h3><p>Add your first client and their update schedule.</p>
         <div class="btns" style="justify-content:center"><button class="btn primary" data-act="add">+ Add client</button><button class="btn" data-act="sample">Try it with sample clients</button></div></div>`}
  </div>`;
  document.querySelectorAll(".tile-foot").forEach((el) => window.innerWidth <= 760 && (el.style.display = "none"));
}

function clientRow(c) {
  const b = bucket(c);
  const pill = b === "paused" ? `<span class="pill gray">Paused</span>`
    : `<span class="pill ${BUCKETS[b] ? BUCKETS[b].color : "gray"}">${whenText(c.next)}</span>`;
  return `<div class="row ${b === "paused" ? "paused" : ""}">
    <a href="#/client/${c.id}">
      <div class="name">${esc(c.name)}</div>
      <div class="meta">${esc(plan(c.plan).name)} · every ${c.every} days · ${b === "paused" ? "paused" : nice(c.next)}</div>
      ${c.todo ? `<div class="task"><b>To do</b>${esc(c.todo)}</div>` : ""}
    </a>
    <div class="side">${pill}
      ${c.status === "active" ? `<button class="btn done sm" data-act="done" data-id="${c.id}">✓ Mark done</button>` : `<button class="btn sm" data-act="resume" data-id="${c.id}">Resume</button>`}</div>
  </div>`;
}

function dueList(b) {
  const list = inBucket(b), B = BUCKETS[b];
  view.innerHTML = `<div class="wrap">
    <div class="head"><div><a class="back" href="#/">← Dashboard</a><p class="eyebrow">${B.blurb}</p><h1>${B.title} <em>(${list.length})</em></h1></div></div>
    <div class="list">${list.length ? list.map(clientRow).join("") : `<div class="empty"><h3>Nothing here</h3><p>No clients are ${B.title.toLowerCase()}.</p></div>`}</div>
  </div>`;
}

let filter = { q: "", status: "active" };
function clients() {
  const q = filter.q.toLowerCase();
  const list = db.clients
    .filter((c) => filter.status === "all" || c.status === filter.status)
    .filter((c) => !q || [c.name, c.email, c.phone, c.website, c.todo, c.notes].join(" ").toLowerCase().includes(q))
    .sort((a, z) => (a.status === z.status ? a.next.localeCompare(z.next) : a.status === "active" ? -1 : 1));
  const n = (s) => db.clients.filter((c) => s === "all" || c.status === s).length;
  view.innerHTML = `<div class="wrap">
    <div class="head"><div><h1>Clients</h1><p>${db.clients.length} total</p></div></div>
    <div class="filters"><input id="search" placeholder="Search name, email, website, notes…" value="${esc(filter.q)}" />
      ${["active", "paused", "all"].map((s) => `<button class="chip ${filter.status === s ? "on" : ""}" data-filter="${s}">${s[0].toUpperCase() + s.slice(1)} (${n(s)})</button>`).join("")}</div>
    <div class="list">${list.length ? list.map(clientRow).join("") : `<div class="empty"><h3>No clients found</h3><p>Try a different search or filter.</p></div>`}</div>
  </div>`;
  const s = document.getElementById("search");
  s.addEventListener("input", () => { filter.q = s.value; const pos = s.selectionStart; clients(); const n2 = document.getElementById("search"); n2.focus(); n2.setSelectionRange(pos, pos); });
}

function clientPage(id) {
  const c = db.clients.find((x) => x.id === id);
  if (!c) { location.hash = "#/clients"; return; }
  const b = bucket(c);
  const color = b === "paused" ? "gray" : BUCKETS[b] ? BUCKETS[b].color : "gray";
  const contact = [
    c.phone && `<a class="btn sm" href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">Call</a><a class="btn sm" href="sms:${esc(c.phone.replace(/[^\d+]/g, ""))}">Text</a>`,
    c.email && `<a class="btn sm" href="mailto:${esc(c.email)}">Email</a>`,
    c.website && `<a class="btn sm" href="${esc(link(c.website))}" target="_blank" rel="noopener">Open website</a>`,
  ].filter(Boolean).join("");
  view.innerHTML = `<div class="wrap">
    <div class="head"><div><a class="back" href="javascript:history.back()">← Back</a><h1>${esc(c.name)}</h1><p>${esc(plan(c.plan).name)} plan · updates every ${c.every} days</p></div>
      <div class="toggle" role="group" aria-label="Status">
        <button type="button" class="${c.status === "active" ? "on active" : ""}" data-act="status" data-val="active" data-id="${c.id}">Active</button>
        <button type="button" class="${c.status === "paused" ? "on paused" : ""}" data-act="status" data-val="paused" data-id="${c.id}">Paused</button></div></div>
    <div class="detail">
      <div class="card next">
        <p class="eyebrow">Next update</p>
        ${c.status === "active" ? `<div class="when">${nice(c.next)}</div><span class="pill ${color}">${whenText(c.next)}</span>`
          : `<div class="when">Paused</div><span class="pill gray">No reminders while paused</span>`}
        <div class="todo">${c.todo ? esc(c.todo) : `<span style="color:var(--muted)">Nothing noted yet. Click Edit to add what needs to be done.</span>`}</div>
        <div class="btns">${c.status === "active" ? `<button class="btn done" data-act="done" data-id="${c.id}">✓ Mark update done</button>` : ""}
          <button class="btn" data-act="edit" data-id="${c.id}">Edit</button></div>
      </div>
      <div class="card">
        <p class="eyebrow">Contact</p>
        <div class="kv" style="margin-top:.8rem">
          ${c.phone ? `<div><span>Phone</span>${esc(c.phone)}</div>` : ""}
          ${c.email ? `<div><span>Email</span>${esc(c.email)}</div>` : ""}
          ${c.website ? `<div><span>Website</span><a href="${esc(link(c.website))}" target="_blank" rel="noopener">${esc(c.website)}</a></div>` : ""}
          ${!c.phone && !c.email && !c.website ? `<div style="color:var(--muted)">No contact info yet.</div>` : ""}
        </div>
        ${contact ? `<div class="btns" style="margin-top:1rem">${contact}</div>` : ""}
        ${c.notes ? `<p class="eyebrow" style="margin-top:1.4rem">Notes</p><p class="notes">${esc(c.notes)}</p>` : ""}
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <p class="eyebrow">Update history (${(c.log || []).length})</p>
      ${(c.log || []).length ? `<ul class="history">${c.log.slice().reverse().map((l) => `<li><b>${nice(l.date)}</b><p>${esc(l.note || "Update done")}</p></li>`).join("")}</ul>`
        : `<p style="color:var(--muted);margin:.6rem 0 0">No updates logged yet.</p>`}
    </div>
    <div class="btns" style="margin-top:1rem"><button class="btn danger sm" data-act="delete" data-id="${c.id}">Delete client</button></div>
  </div>`;
}

function settings() {
  view.innerHTML = `<div class="wrap">
    <div class="head"><div><h1>Settings</h1></div></div>
    <div class="card"><h2>Plans</h2><p class="section" style="color:var(--muted)">How often each plan gets an update. New clients start with this schedule (you can change it per client).</p>
      <div class="plans" id="plans">${db.plans.map((p) => `<div class="plan-row" data-pid="${p.id}"><input value="${esc(p.name)}" data-k="name" aria-label="Plan name" />
        <input type="number" min="1" value="${p.every}" data-k="every" aria-label="Days between updates" /><button class="btn sm danger" data-act="del-plan" data-id="${p.id}">Remove</button></div>`).join("")}</div>
      <div class="btns" style="margin-top:1rem"><button class="btn sm" data-act="add-plan">+ Add plan</button><button class="btn sm primary" data-act="save-plans">Save plans</button></div>
      <small style="color:var(--muted)">Middle box = days between updates (30 = monthly, 14 = every 2 weeks, 7 = weekly).</small>
    </div>
    <div class="card section"><h2>Calendar reminders</h2>
      <p>Download every active client's next update date as a calendar file. Open it on your iPhone or Mac and tap <b>Add All</b>, so your phone reminds you even when this app is closed. Download a fresh one after you mark updates done.</p>
      <button class="btn dark" data-act="ics">Download calendar reminders</button></div>
    <div class="card section"><h2>Backup</h2>
      <p>Your clients are saved in this browser on this device only. Download a backup regularly, and use Restore to move your list to another device.</p>
      <div class="btns"><button class="btn primary" data-act="backup">Download backup</button>
        <label class="btn">Restore from backup<input type="file" accept=".json,application/json" id="restore" hidden /></label></div></div>
  </div>`;
  document.getElementById("restore").addEventListener("change", restore);
}

/* ---------- Modals ---------- */
const modal = document.getElementById("modal"), form = document.getElementById("modal-form");
function clientForm(c) {
  const isNew = !c;
  c = c || { name: "", phone: "", email: "", website: "", plan: db.plans[0] ? db.plans[0].id : "", every: db.plans[0] ? db.plans[0].every : 30, next: addDays(today(), db.plans[0] ? db.plans[0].every : 30), todo: "", notes: "" };
  form.innerHTML = `<h2>${isNew ? "Add <em>client</em>" : "Edit <em>client</em>"}</h2>
    <div class="field"><label>Client name *</label><input name="name" required value="${esc(c.name)}" placeholder="e.g. Sarah Jones, Keller Williams" /></div>
    <div class="grid2"><div class="field"><label>Phone</label><input name="phone" type="tel" value="${esc(c.phone)}" /></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${esc(c.email)}" /></div></div>
    <div class="field"><label>Website</label><input name="website" value="${esc(c.website)}" placeholder="their website link" /></div>
    <div class="grid2"><div class="field"><label>Plan</label><select name="plan">${db.plans.map((p) => `<option value="${p.id}" ${p.id === c.plan ? "selected" : ""}>${esc(p.name)} (every ${p.every} days)</option>`).join("")}</select></div>
      <div class="field"><label>Update every (days)</label><input name="every" type="number" min="1" value="${c.every}" /></div></div>
    <div class="field"><label>Next update date</label><input name="next" type="date" value="${c.next}" /></div>
    <div class="field"><label>What needs to be done next</label><textarea name="todo" rows="3" placeholder="e.g. Add new listing photos, update sold stats">${esc(c.todo)}</textarea></div>
    <div class="field"><label>Notes</label><textarea name="notes" rows="2" placeholder="Domain, logins location, preferences…">${esc(c.notes)}</textarea></div>
    <div class="modal-btns"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn primary" value="ok">${isNew ? "Add client" : "Save"}</button></div>`;
  const sel = form.querySelector("[name=plan]"), ev = form.querySelector("[name=every]"), nx = form.querySelector("[name=next]");
  sel.addEventListener("change", () => { const p = plan(sel.value); ev.value = p.every; if (isNew) nx.value = addDays(today(), p.every); });
  modal.showModal();
  modal.onclose = () => {
    if (modal.returnValue !== "ok") return;
    const f = Object.fromEntries(new FormData(form));
    const data = { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), website: f.website.trim(), plan: f.plan, every: Math.max(1, +f.every || 30), next: f.next || today(), todo: f.todo.trim(), notes: f.notes.trim() };
    if (isNew) { const nc = { id: uid(), status: "active", log: [], created: today(), ...data }; db.clients.push(nc); save(); toast("Client added"); location.hash = "#/client/" + nc.id; }
    else { Object.assign(c, data); save(); toast("Saved"); route(); }
  };
}

function doneForm(c) {
  form.innerHTML = `<h2>Update <em>done</em></h2><p style="margin:0;color:var(--muted)">${esc(c.name)}</p>
    <div class="field"><label>What did you change?</label><textarea name="note" rows="3">${esc(c.todo)}</textarea><small>Saved to their update history.</small></div>
    <div class="grid2"><div class="field"><label>Date done</label><input name="date" type="date" value="${today()}" /></div>
      <div class="field"><label>Next update</label><input name="next" type="date" value="${addDays(today(), c.every)}" /><small>${c.every} days from today</small></div></div>
    <div class="field"><label>What needs to be done next time</label><textarea name="todo" rows="2" placeholder="Leave blank if nothing yet"></textarea></div>
    <div class="modal-btns"><button class="btn" value="cancel" formnovalidate>Cancel</button><button class="btn done" value="ok">✓ Save</button></div>`;
  modal.showModal();
  modal.onclose = () => {
    if (modal.returnValue !== "ok") return;
    const f = Object.fromEntries(new FormData(form));
    c.log = c.log || []; c.log.push({ date: f.date || today(), note: f.note.trim() });
    c.next = f.next || addDays(today(), c.every); c.todo = f.todo.trim();
    save(); toast(`Done. Next update ${nice(c.next)}`); route();
  };
}

/* ---------- Actions ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const c = db.clients.find((x) => x.id === el.dataset.id);
  const a = el.dataset.act;
  if (a === "add") clientForm();
  if (a === "edit") clientForm(c);
  if (a === "done") { e.preventDefault(); doneForm(c); }
  if (a === "status") { c.status = el.dataset.val; if (c.status === "active" && diff(c.next) < 0) c.next = today(); save(); toast(c.status === "active" ? "Active: reminders on" : "Paused: no reminders"); route(); }
  if (a === "resume") { c.status = "active"; if (diff(c.next) < 0) c.next = today(); save(); toast("Active again"); route(); }
  if (a === "delete" && confirm(`Delete ${c.name}? This can't be undone.`)) { db.clients = db.clients.filter((x) => x !== c); save(); toast("Client deleted"); location.hash = "#/clients"; }
  if (a === "sample") sample();
  if (a === "add-plan") { readPlans(); db.plans.push({ id: uid(), name: "New plan", every: 30 }); settings(); }
  if (a === "del-plan") { if (db.clients.some((x) => x.plan === el.dataset.id)) return toast("A client uses this plan. Change them first."); readPlans(); db.plans = db.plans.filter((p) => p.id !== el.dataset.id); save(); settings(); }
  if (a === "save-plans") { readPlans(); save(); toast("Plans saved"); }
  if (a === "backup") download(`client-updates-backup-${today()}.json`, JSON.stringify(db, null, 2), "application/json");
  if (a === "ics") ics();
});
document.addEventListener("click", (e) => { const f = e.target.closest("[data-filter]"); if (f) { filter.status = f.dataset.filter; clients(); } });
document.getElementById("add-btn").addEventListener("click", () => clientForm());

function readPlans() {
  document.querySelectorAll(".plan-row").forEach((r) => {
    const p = db.plans.find((x) => x.id === r.dataset.pid); if (!p) return;
    p.name = r.querySelector("[data-k=name]").value.trim() || p.name;
    p.every = Math.max(1, +r.querySelector("[data-k=every]").value || p.every);
  });
}
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function restore(e) {
  const file = e.target.files[0]; if (!file) return;
  file.text().then((t) => {
    try { const d = JSON.parse(t); if (!d.clients || !d.plans) throw 0;
      if (!confirm(`Replace your current list with this backup (${d.clients.length} clients)?`)) return;
      db = d; save(); toast("Backup restored"); location.hash = "#/";  route();
    } catch (err) { toast("That file isn't a valid backup"); }
  });
}
function ics() {
  const act = db.clients.filter((c) => c.status === "active");
  if (!act.length) return toast("No active clients to add");
  const d = (s) => s.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const clean = (s) => String(s).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const ev = act.map((c) => ["BEGIN:VEVENT", `UID:${c.id}-${c.next}@nestlewood-updates`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(c.next)}`, `DTEND;VALUE=DATE:${d(addDays(c.next, 1))}`,
    `SUMMARY:${clean("Website update: " + c.name)}`, `DESCRIPTION:${clean(c.todo || "Website update due")}`,
    "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", `DESCRIPTION:${clean("Website update: " + c.name)}`, "END:VALARM", "END:VEVENT"].join("\r\n"));
  download("client-update-reminders.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Client Updates//EN", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n"), "text/calendar");
  toast(`${act.length} reminders downloaded`);
}
function sample() {
  const mk = (name, p, every, offset, todo, extra = {}) => ({ id: uid(), name, plan: p, every, next: addDays(today(), offset), todo, status: "active", phone: "828-555-01" + pad(Math.floor(Math.random() * 90 + 10)), email: name.split(" ")[0].toLowerCase() + "@example.com", website: "", notes: "Sample client: delete anytime.", log: [{ date: addDays(today(), offset - every), note: "Initial website launch" }], created: today(), ...extra });
  db.clients.push(
    mk("Sarah Jones", "template", 30, -3, "Swap in her 2 new listings and update sold count"),
    mk("Mike Patel", "custom", 14, -1, "Replace cover video with new drone footage"),
    mk("Alicia Brooks", "template", 30, 0, "Add 3 new Zillow reviews"),
    mk("David Kim", "custom", 14, 2, "Update production numbers for Q4"),
    mk("Rachel Green", "template", 30, 5, "Change headshot and bio"),
    mk("Tom Walker", "template", 30, 18, "Monthly check: links and listings"),
    mk("Emily Chen", "custom", 14, 10, "Add open house banner", { status: "paused", notes: "Paused while on maternity leave." }),
  );
  save(); toast("Sample clients added"); route();
}

/* ---------- Router ---------- */
function route() {
  const h = location.hash || "#/";
  const [, page, arg] = h.split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", (a.dataset.nav === "home" && (!page || page === "due")) || a.dataset.nav === page || (page === "client" && a.dataset.nav === "clients")));
  if (page === "due" && BUCKETS[arg]) dueList(arg);
  else if (page === "clients") clients();
  else if (page === "client") clientPage(arg);
  else if (page === "settings") settings();
  else dashboard();
  window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();

/* Refresh the counts when the app comes back on screen (e.g. the next morning) */
document.addEventListener("visibilitychange", () => { if (!document.hidden && !modal.open) route(); });

/* Friendly pop-up while the app is open in Chrome */
if ("Notification" in window && Notification.permission === "granted") {
  const n = inBucket("overdue").length + inBucket("today").length;
  if (n) new Notification("Website updates due", { body: `${n} client${n === 1 ? "" : "s"} need an update today.`, icon: "icon.png" });
}
