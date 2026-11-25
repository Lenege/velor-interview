/* Velor Interview Studio: interviews, pre-interview presentations, responses and the client knowledge base. */
(function () {
  "use strict";
  var el = V.el, icon = V.icon;
  var app = document.getElementById("app");
  var key = V.lsGet("velor-admin") || "";
  var state = { briefs: [], clients: [], ai: null, usage: null, showRemoved: false, q: "" };
  var STATUS = { waiting: ["Waiting for answers", ""], progress: ["In progress", "gold"], done: ["Completed", "green"], script: ["Script ready", "green"] };

  function api(path, opts) {
    opts = opts || {}; opts.headers = Object.assign({ "Content-Type": "application/json", "x-admin-key": key }, opts.headers || {});
    return V.api(path, opts).catch(function (e) { if (e.status === 401) { V.lsSet("velor-admin", ""); key = ""; login(); } throw e; });
  }
  var post = function (body) { return api("/api/admin", { method: "POST", body: JSON.stringify(body) }); };
  var origin = location.origin;

  /* ---------- login ---------- */
  function login(err) {
    var pw = el("input", { class: "in", type: "password", id: "pw", autocomplete: "current-password" });
    var msg = el("p", { class: "hint", text: err || "" });
    var go = async function () {
      key = pw.value; try { await V.api("/api/admin?op=ping", { headers: { "x-admin-key": key } }); V.lsSet("velor-admin", key); route(); }
      catch (e) { msg.textContent = e.status === 401 ? "Wrong password." : "Could not sign in: " + e.message; }
    };
    pw.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    app.replaceChildren(el("div", { class: "login" },
      el("img", { src: "/assets/velor-logo.png", alt: "Velor" }), el("div", { class: "eyebrow", style: "margin:10px 0 40px;letter-spacing:.3em", text: "Interview Studio" }),
      el("label", { class: "f", for: "pw" }, "Password"), pw, el("div", { style: "margin-top:16px" }, el("button", { class: "btn gold", type: "button", onclick: go }, "Sign in")), msg));
    setTimeout(function () { pw.focus(); }, 30);
  }

  /* ---------- shell ---------- */
  function shell(crumbs, content, navOn) {
    var nav = el("nav", { class: "nav" },
      el("a", { href: "#/", class: navOn === "i" ? "on" : "" }, icon("chat"), "Interviews", el("span", { class: "n", text: String(state.briefs.filter(function (b) { return !b.removed; }).length || "") })),
      el("a", { href: "#/clients", class: navOn === "c" ? "on" : "" }, icon("users"), "Knowledge base", el("span", { class: "n", text: String(state.clients.length || "") })),
      el("a", { href: "#/new", class: navOn === "n" ? "on" : "" }, icon("plus"), "New interview"));
    var side = el("aside", { class: "side" },
      el("a", { class: "logo", href: "#/", style: "text-decoration:none" }, el("img", { src: "/assets/velor-logo.png", alt: "Velor" }), el("span", { class: "eyebrow", text: "Interview Studio" })),
      el("div", { class: "grp", text: "WORKSPACE" }), nav,
      el("div", { class: "foot" }, el("div", { class: "avatar", text: "VM" }), el("div", { style: "flex:1" }, el("div", { text: "Velor Media" }),
        el("button", { class: "btn link", type: "button", style: "padding:0", onclick: function () { V.lsSet("velor-admin", ""); key = ""; login(); } }, "Sign out"))));
    var ai = el("span", { class: "ai-dot " + (state.ai === true ? "ok" : state.ai === false ? "bad" : "") }, el("i"), state.ai === false ? "AI key error" : state.ai === true ? "AI connected" : "Checking AI…");
    var head = el("div", { class: "mhead" },
      el("div", { class: "crumbs" }, crumbs.map(function (c, i) {
        return [i ? icon("right") : null, c[1] ? el("a", { href: c[1], text: c[0] }) : el("span", { class: i === crumbs.length - 1 ? "cur" : "", text: c[0] })];
      })),
      el("div", { style: "display:flex;align-items:center;gap:22px" }, V.themeToggle(), ai));
    app.replaceChildren(el("div", { class: "studio" }, side, el("div", { class: "main" }, head, el("div", { class: "wrap" }, content))));
    window.scrollTo(0, 0);
  }

  async function loadAll() {
    var r = await Promise.all([api("/api/admin?op=briefs"), api("/api/admin?op=clients")]);
    state.briefs = r[0].briefs; state.clients = r[1].clients;
  }
  function pingAI() {
    if (state.ai !== null) return;
    api("/api/admin?op=ping").then(function (r) { state.ai = !!r.ai; var d = document.querySelector(".ai-dot"); if (d) { d.className = "ai-dot " + (r.ai ? "ok" : "bad"); d.lastChild.textContent = r.ai ? "AI connected" : "AI key error"; } }).catch(function () {});
  }

  /* ---------- router ---------- */
  async function route() {
    if (!key) { login(); return; }
    var h = (location.hash || "#/").slice(1);
    try {
      if (h === "/" || h === "") return await home();
      if (h === "/new") return await editForm(null);
      if (h === "/clients") return await clientsView();
      var m;
      if ((m = h.match(/^\/i\/([a-z0-9-]+)\/edit$/))) return await editForm(m[1]);
      if ((m = h.match(/^\/i\/([a-z0-9-]+)$/))) return await detail(m[1]);
      if ((m = h.match(/^\/c\/([a-z0-9-]+)$/))) return await clientView(m[1]);
      location.hash = "#/";
    } catch (e) { if (e.status !== 401) shell([["Studio"]], el("div", { class: "empty", text: "Something went wrong: " + e.message })); }
    finally { pingAI(); }
  }
  window.addEventListener("hashchange", route);

  /* ---------- home ---------- */
  async function home() {
    await loadAll();
    if (!state.usage) api("/api/admin?op=usage").then(function (u) { state.usage = u; var n = document.getElementById("usageBig"); if (n) fillUsage(); }).catch(function () {});
    var live = state.briefs.filter(function (b) { return !b.removed; });
    var stat = function (k, v) { return el("div", { class: "stat" }, el("div", { class: "k", text: k }), el("div", { class: "v", text: pad(v) })); };
    var grid = el("div", { class: "cards" });
    var search = el("input", { type: "search", placeholder: "Search interviews…", value: state.q, oninput: function () { state.q = search.value; drawCards(); } });
    var remBtn = el("button", { class: "btn", type: "button", onclick: function () { state.showRemoved = !state.showRemoved; remBtn.textContent = state.showRemoved ? "Hide removed interviews" : "Show removed interviews"; drawCards(); } }, state.showRemoved ? "Hide removed interviews" : "Show removed interviews");
    var countB = el("span", { class: "count-badge" });
    function drawCards() {
      var q = state.q.trim().toLowerCase();
      var list = state.briefs.filter(function (b) { return (state.showRemoved || !b.removed) && (!q || [b.title, b.client, b.speaker, b.summary].join(" ").toLowerCase().indexOf(q) >= 0); });
      countB.textContent = String(list.length);
      grid.replaceChildren.apply(grid, list.length ? list.map(card) : [el("div", { class: "empty", style: "grid-column:1/-1" }, q ? "Nothing found." : "No interviews yet. Create the first one.")]);
    }
    var content = [
      el("div", { class: "hero" },
        el("div", null, el("div", { class: "eyebrow", text: "From idea to expertise" }),
          el("h1", null, "A great script", el("span", { text: "starts with a conversation." })),
          el("p", { text: "Everything your speaker needs, and everything you need to hear." })),
        el("div", { class: "acts" }, el("a", { class: "btn gold", href: "#/new" }, icon("plus"), "Create interview"))),
      el("div", { class: "stats" },
        stat("Total interviews", live.length),
        stat("In progress", live.filter(function (b) { return b.status === "progress"; }).length),
        stat("Completed", live.filter(function (b) { return b.status === "done" || b.status === "script"; }).length),
        el("div", { class: "stat tipc" }, icon("book"), el("div", null, "One question at a time.", el("br"), "Each question follows the answer. Known answers are never asked twice."))),
      el("div", { class: "usage" },
        el("div", null, el("div", { class: "eyebrow", text: "Claude API · this month (UTC)" }), el("div", { class: "big", id: "usageBig", text: "…" }), el("div", { class: "sub", id: "usageSub", text: "Tokens used by interviews, presentations and handoffs." })),
        el("a", { class: "btn", href: "https://platform.claude.com/", target: "_blank", rel: "noopener" }, "Open Claude Console", icon("out"))),
      el("div", { class: "listhead" }, el("h2", null, "Your interviews", countB), el("div", { class: "sp" }), remBtn,
        el("label", { class: "search" }, icon("search"), search),
        el("button", { class: "btn", type: "button", "aria-label": "Refresh", onclick: function () { route(); } }, icon("refresh"))),
      grid];
    shell([["Studio", "#/"], ["Interviews"]], content, "i");
    drawCards(); if (state.usage) fillUsage();
  }
  function fillUsage() {
    var u = state.usage, n = document.getElementById("usageBig"); if (!n || !u) return;
    n.textContent = fmtNum(u.input + u.output) + " tokens";
    document.getElementById("usageSub").textContent = fmtNum(u.input) + " in · " + fmtNum(u.output) + " out · " + u.calls + " requests in " + u.month;
  }
  function card(b) {
    var st = STATUS[b.status] || STATUS.waiting;
    return el("a", { class: "icard" + (b.removed ? " removed" : ""), href: "#/i/" + b.id },
      el("div", { class: "cl", text: b.client || b.speaker || "No client" }),
      el("div", { class: "st" }, el("span", { class: "chip " + st[1], text: b.removed ? "Removed" : !b.active ? "Closed" : st[0] }), b.hasPresentation ? null : el("span", { class: "chip", style: "margin-left:8px", text: "No presentation" })),
      el("h3", { text: b.title }), el("p", { text: b.summary || (b.speaker ? "Interview with " + b.speaker : "") }),
      el("div", { class: "ft" }, icon("chat"), el("span", { text: plural(b.answers, "answer") }), el("span", { class: "sp" }), el("span", { text: V.fmtDate(b.updatedAt || b.createdAt, "en") }), icon("out")));
  }

  /* ---------- create / edit ---------- */
  async function editForm(id) {
    if (!state.clients.length) await loadAll();
    var b = id ? (await api("/api/admin?op=brief&id=" + id)).brief : { lang: "ru", writtenBy: "Velor Media" };
    var f = {};
    var inp = function (name, val, ph) { f[name] = el("input", { class: "in", id: "f_" + name, value: val || "", placeholder: ph || "" }); return f[name]; };
    var area = function (name, val, ph, rows) { f[name] = el("textarea", { class: "in", id: "f_" + name, rows: String(rows || 4), placeholder: ph || "" }); f[name].value = val || ""; return f[name]; };
    var lab = function (forName, t) { return el("label", { class: "f", for: "f_" + forName, text: t }); };
    var dl = el("datalist", { id: "clientList" }, state.clients.map(function (c) { return el("option", { value: c.name }); }));
    f.lang = el("select", { class: "in", id: "f_lang" }, el("option", { value: "ru", text: "Русский" }), el("option", { value: "en", text: "English" })); f.lang.value = b.lang || "ru";
    var ref = b.reference || {};
    var msg = el("span", { class: "hint" });
    var save = el("button", { class: "btn gold", type: "button", onclick: async function () {
      var body = { title: f.title.value, speaker: f.speaker.value, client: f.client.value, writtenBy: f.writtenBy.value, lang: f.lang.value,
        context: f.context.value, intro: f.intro.value, reference: { url: f.refUrl.value, note: f.refNote.value, title: f.refTitle.value } };
      if (!body.title.trim() || !body.context.trim()) { msg.textContent = "Video title and the brief are required."; return; }
      save.disabled = true; msg.textContent = "Saving…";
      try {
        if (id) { await post(Object.assign({ op: "update", id: id }, body)); location.hash = "#/i/" + id; }
        else { if (f.slug.value.trim()) body.id = f.slug.value.trim(); var r = await post(Object.assign({ op: "create" }, body)); location.hash = "#/i/" + r.id; }
      } catch (e) { msg.textContent = "Could not save: " + e.message; save.disabled = false; }
    } }, id ? "Save changes" : "Create interview");
    var content = [
      el("div", { class: "dhead" }, el("div", null, el("div", { class: "eyebrow", text: id ? "Edit interview" : "New interview" }), el("h1", { text: id ? b.title : "Create interview" }),
        el("p", { class: "muted", style: "margin:0", text: "The speaker's name goes here, so the client is never asked for it. After saving, generate the pre-interview presentation." }))),
      el("div", { class: "sect" }, el("div", { class: "h" }, el("h2", { text: "Who and what" })),
        el("div", { class: "grid2" },
          el("div", null, lab("title", "Video title"), inp("title", b.title, "e.g. How we got 40 clients from one YouTube video")),
          el("div", null, lab("speaker", "Speaker (the person interviewed)"), inp("speaker", b.speaker, "e.g. Даниэль")),
          el("div", null, lab("client", "Client / company"), (function () { var i = inp("client", b.client, "e.g. Velor Media"); i.setAttribute("list", "clientList"); return i; })(), dl,
            el("div", { class: "hint", text: "Answers from all interviews of the same client go to one knowledge base." })),
          el("div", null, lab("writtenBy", "Written by"), inp("writtenBy", b.writtenBy, "Velor Media")),
          el("div", null, lab("lang", "Interview language"), f.lang),
          id ? el("div") : el("div", null, lab("slug", "Link (optional)"), inp("slug", "", "daniel-video-2"), el("div", { class: "hint", text: origin + "/<link>" })))),
      el("div", { class: "sect" }, el("div", { class: "h" }, el("h2", { text: "Reference video" })),
        el("div", { class: "grid2" },
          el("div", null, lab("refUrl", "YouTube link"), inp("refUrl", ref.url, "https://www.youtube.com/watch?v=…")),
          el("div", null, lab("refTitle", "Title (filled automatically if empty)"), inp("refTitle", ref.title, ""))),
        lab("refNote", "Why this reference"), area("refNote", ref.note, "What we take from it: structure, pacing, the way the hook works…", 3)),
      el("div", { class: "sect" }, el("div", { class: "h" }, el("h2", { text: "Brief for the interviewer" })),
        lab("context", "Idea, notes, research, what we already know (private, the client never sees it)"),
        area("context", b.context, "Topic and promise of the video, audience, offer, what must be covered, what to avoid…", 12),
        lab("intro", "Short intro on the cover slide (optional)"), area("intro", b.intro, "Leave empty to use the default intro.", 2)),
      el("div", { style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap" }, save, el("a", { class: "btn", href: id ? "#/i/" + id : "#/" }, "Cancel"), msg)];
    shell([["Studio", "#/"], ["Interviews", "#/"], [id ? "Edit" : "New interview"]], content, id ? "i" : "n");
  }

  /* ---------- interview detail ---------- */
  async function detail(id) {
    var r = await api("/api/admin?op=brief&id=" + id); var b = r.brief, sm = r.summary;
    if (!state.briefs.length) await loadAll();
    var link = origin + "/" + id;
    var st = STATUS[sm.status] || STATUS.waiting;
    var toggle = el("button", { class: "btn sm", type: "button", onclick: async function () { await post({ op: "update", id: id, active: !(b.active !== false) }); route(); } }, b.active !== false ? "Close interview" : "Open interview");
    var rem = el("button", { class: "btn sm danger", type: "button", onclick: async function () {
      if (!b.removed && !confirm("Remove this interview? The link stops working. You can restore it later.")) return;
      await post({ op: b.removed ? "restore" : "remove", id: id }); route(); } }, b.removed ? "Restore" : "Remove");
    var presBox = el("div");
    var sessBox = el("div", null, el("p", { class: "muted", text: "Loading responses…" }));
    var content = [
      el("div", { class: "dhead" },
        el("div", { style: "min-width:0;flex:1" },
          el("div", { class: "eyebrow", text: [b.client, b.speaker].filter(Boolean).join(" · ") || "Interview" }),
          el("h1", { text: b.title }),
          el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, el("span", { class: "chip " + st[1], text: st[0] }),
            b.active === false ? el("span", { class: "chip red", text: "Closed" }) : null, b.removed ? el("span", { class: "chip red", text: "Removed" }) : null,
            el("span", { class: "chip", text: plural(sm.answers, "answer") + " · " + plural(sm.sessions, "session") }), el("span", { class: "chip", text: b.lang === "en" ? "English" : "Русский" })),
          el("div", { class: "linkbox" }, el("code", { text: link }),
            el("button", { class: "btn sm", type: "button", onclick: function () { V.copyText(link, "Link copied"); } }, icon("copy"), "Copy"),
            el("a", { class: "btn sm", href: "/" + id + "?preview=1", target: "_blank", rel: "noopener" }, "Preview", icon("out")))),
        el("div", { class: "acts" }, el("a", { class: "btn sm", href: "#/i/" + id + "/edit" }, "Edit details"), toggle, rem)),
      el("div", { class: "sect" }, el("div", { class: "h" }, el("h2", { text: "Pre-interview presentation" })),
        el("p", { class: "muted", style: "margin-top:0", text: "The client reads these slides before the interview starts: the concept, the reference, a first hook draft, CTAs and what we need from them. The interviewer uses them as the agenda." }), presBox),
      el("div", { class: "sect" }, el("div", { class: "h" }, el("h2", { text: "Responses" }),
        b.clientId ? el("a", { class: "btn sm", href: "#/c/" + b.clientId }, icon("users"), "Knowledge base: " + b.client) : el("span", { class: "hint", text: "Add a client in Edit details to build a knowledge base." })), sessBox)];
    shell([["Studio", "#/"], ["Interviews", "#/"], [b.title]], content, "i");
    drawPresentation(presBox, b);
    loadSessions(sessBox, b);
  }

  function emptyPres() { return { concept: {}, vision: {}, hook: {}, midroll: { enabled: false }, endcta: { options: [{}, {}] }, next: { covers: [] } }; }
  function drawPresentation(box, b) {
    var p = b.presentation;
    var gen = el("button", { class: "btn gold sm", type: "button", onclick: async function () {
      if (p && !confirm("Replace the current presentation with a new AI draft? (Nothing is saved until you press Save.)")) return;
      gen.disabled = true; gen.textContent = "Drafting… (about 30 s)";
      try { var r = await post({ op: "present", id: b.id }); editor(box, b, r.presentation, true); }
      catch (e) { V.toast("Could not draft: " + e.message); gen.disabled = false; gen.textContent = "Draft with AI"; }
    } }, icon("spark"), p ? "Redraft with AI" : "Draft with AI");
    if (!p) {
      box.replaceChildren(el("div", { class: "empty", style: "padding:34px" },
        el("p", { style: "margin-top:0", text: "No presentation yet. Without it the client goes straight to the chat." }),
        el("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap" }, gen,
          el("button", { class: "btn sm", type: "button", onclick: function () { editor(box, b, emptyPres(), true); } }, "Write manually"))));
      return;
    }
    var c = p.concept || {};
    box.replaceChildren(
      el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px" },
        el("button", { class: "btn sm", type: "button", onclick: function () { editor(box, b, JSON.parse(JSON.stringify(p)), false); } }, "Edit slides"), gen,
        el("a", { class: "btn sm", href: "/" + b.id + "?preview=1", target: "_blank", rel: "noopener" }, "Open as client", icon("out")),
        el("button", { class: "btn sm danger", type: "button", onclick: async function () { if (!confirm("Delete the presentation?")) return; await post({ op: "update", id: b.id, presentation: null }); route(); } }, "Delete")),
      el("div", { class: "eyebrow", style: "color:var(--faint)", text: "Concept" }), el("h3", { style: "font-size:22px;margin:8px 0", text: c.title || b.title }),
      el("p", { class: "muted", style: "margin:0", text: c.summary || "" }),
      el("p", { class: "hint", text: [p.hook && p.hook.draft ? "Hook draft" : null, p.midroll && p.midroll.enabled ? "Mid-roll CTA" : null, (p.endcta && p.endcta.options || []).length ? (p.endcta.options.length + " end-CTA options") : null, (p.next && p.next.covers || []).length ? (p.next.covers.length + " interview topics") : null].filter(Boolean).join(" · ") }));
  }

  function editor(box, b, p, isNew) {
    p = Object.assign(emptyPres(), p || {});
    var fields = [];
    var bind = function (obj, prop, label, rows, ph) {
      var n = rows ? el("textarea", { class: "in", rows: String(rows), placeholder: ph || "" }) : el("input", { class: "in", placeholder: ph || "" });
      n.value = obj[prop] || ""; fields.push(function () { obj[prop] = n.value; });
      return [el("label", { class: "f", text: label }), n];
    };
    var covers = el("textarea", { class: "in", rows: "6" }); covers.value = (p.next.covers || []).join("\n");
    fields.push(function () { p.next.covers = covers.value.split("\n").map(function (s) { return s.replace(/^[-•\s]+/, "").trim(); }).filter(Boolean); });
    var midOn = el("input", { type: "checkbox" }); midOn.checked = !!p.midroll.enabled; fields.push(function () { p.midroll.enabled = midOn.checked; });
    var optsBox = el("div");
    function drawOpts() {
      optsBox.replaceChildren.apply(optsBox, p.endcta.options.map(function (o, i) {
        return el("div", { class: "opt" }, bind(o, "label", "Option " + "ABCD"[i] + " label", 0, "Option A, companion deep-dive on …"), bind(o, "text", "Spoken draft", 4),
          el("button", { class: "btn link", type: "button", onclick: function () { collect(); p.endcta.options.splice(i, 1); fields.length = 0; editor(box, b, p, isNew); } }, "Remove option"));
      }));
    }
    var msg = el("span", { class: "hint" });
    function collect() { fields.forEach(function (fn) { fn(); }); }
    var saveBtn = el("button", { class: "btn gold", type: "button", onclick: async function () {
      collect(); saveBtn.disabled = true; msg.textContent = "Saving…";
      try { await post({ op: "update", id: b.id, presentation: p }); V.toast("Presentation saved"); route(); }
      catch (e) { msg.textContent = "Could not save: " + e.message; saveBtn.disabled = false; }
    } }, "Save presentation");
    box.replaceChildren(el("div", { class: "pres-ed" },
      isNew ? el("p", { class: "chip gold", style: "margin:0 0 6px", text: "Draft: review and edit, then save. The client sees it only after saving." }) : null,
      el("h3", { text: "01 — Video concept" }), bind(p.concept, "title", "Working title"), bind(p.concept, "summary", "What the video is", 4), bind(p.concept, "audience", "Who it is for", 3),
      el("h3", { text: "02 — Vision" }), bind(p.vision, "text", "Vision", 4), bind(p.vision, "feel", "Feel (tone and visuals)", 2),
      el("h3", { text: "03 — Hook" }), bind(p.hook, "note", "Logic of the opening / what to confirm", 3), bind(p.hook, "draft", "Hook draft (spoken)", 5),
      el("h3", { text: "04 — Mid-roll CTA" }), el("label", { class: "f", style: "display:flex;gap:10px;align-items:center;color:var(--text)" }, midOn, "Show the mid-roll slide"),
      bind(p.midroll, "note", "Why and what", 3), bind(p.midroll, "approach", "Approach", 3), bind(p.midroll, "confirm", "What to confirm in the interview", 2),
      el("h3", { text: "05 — End-CTA" }), bind(p.endcta, "note", "Note", 2), optsBox,
      el("button", { class: "btn sm", type: "button", style: "margin-top:12px", onclick: function () { collect(); p.endcta.options.push({ label: "", text: "" }); fields.length = 0; editor(box, b, p, isNew); } }, icon("plus"), "Add option"),
      el("h3", { text: "06 — What's next" }), bind(p.next, "good", "What we're good on", 3), bind(p.next, "need", "What we need from the speaker", 3),
      el("label", { class: "f", text: "The interview covers (one per line)" }), covers,
      el("div", { style: "display:flex;gap:12px;align-items:center;margin-top:24px;flex-wrap:wrap" }, saveBtn,
        el("button", { class: "btn", type: "button", onclick: function () { route(); } }, "Cancel"), msg)));
    drawOpts();
  }

  async function loadSessions(box, b) {
    var r = await api("/api/admin?op=sessions&b=" + b.id);
    if (!r.sessions.length) { box.replaceChildren(el("p", { class: "muted", text: "No one has started this interview yet. Send the link above." })); return; }
    box.replaceChildren.apply(box, r.sessions.map(function (s) {
      var st = STATUS[s.state] || STATUS.waiting;
      var body = el("div", { class: "hidden" });
      var handoff = el("pre", { class: s.handoff ? "" : "hidden", text: s.handoff || "" });
      var hBtn = el("button", { class: "btn sm gold", type: "button", onclick: async function () {
        hBtn.disabled = true; hBtn.textContent = "Generating… (up to a minute)";
        try { var x = await post({ op: "handoff", b: b.id, s: s.sid }); handoff.textContent = x.handoff; handoff.classList.remove("hidden"); hBtn.textContent = "Regenerate script handoff"; }
        catch (e) { hBtn.textContent = "Failed, try again"; V.toast(e.message); }
        hBtn.disabled = false;
      } }, s.handoff ? "Regenerate script handoff" : "Generate script handoff");
      var fBtn = el("button", { class: "btn sm", type: "button", onclick: async function () {
        if (!b.clientId) { V.toast("Add a client in Edit details first."); return; }
        fBtn.disabled = true; fBtn.textContent = "Saving facts…";
        try { var x = await post({ op: "facts", b: b.id, s: s.sid }); fBtn.textContent = x.added + " facts saved to knowledge base"; }
        catch (e) { fBtn.textContent = "Failed, try again"; fBtn.disabled = false; }
      } }, s.factsAt ? "Update knowledge base (" + (s.factsCount || 0) + " facts)" : "Save answers to knowledge base");
      body.append(el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:14px" }, hBtn, fBtn,
        el("button", { class: "btn sm", type: "button", onclick: function () { V.copyText(s.transcript, "Transcript copied"); } }, icon("copy"), "Copy transcript"),
        el("button", { class: "btn sm", type: "button", onclick: function () { V.copyText(handoff.textContent, "Handoff copied"); } }, icon("copy"), "Copy handoff")),
        s.handoffError ? el("p", { class: "hint", style: "color:var(--red)", text: "Last handoff attempt failed: " + s.handoffError }) : null,
        handoff, el("pre", { text: s.transcript || "(empty)" }));
      return el("div", { class: "sess" },
        el("div", { class: "sh", onclick: function () { body.classList.toggle("hidden"); } },
          el("b", { text: s.name || "Anonymous" }), el("span", { class: "chip " + st[1], text: st[0] }), el("span", { class: "muted", text: plural(s.answers, "answer") + " · " + (s.status === "done" ? 100 : (s.progress || 0)) + "%" }),
          el("span", { class: "sp" }), el("span", { class: "muted", text: V.fmtDate(s.updatedAt, "en") }), icon("right")), body);
    }));
  }

  /* ---------- knowledge base ---------- */
  async function clientsView() {
    await loadAll();
    var grid = el("div", { class: "cards" }, state.clients.length ? state.clients.map(function (c) {
      return el("a", { class: "icard", href: "#/c/" + c.id, style: "min-height:0" },
        el("div", { class: "cl", text: "Client" }), el("h3", { text: c.name, style: "margin-top:10px" }),
        el("p", { text: c.facts ? c.facts + " saved answers. The interviewer will not ask these again." : "No saved answers yet." }),
        el("div", { class: "ft" }, icon("chat"), el("span", { text: plural(c.interviews, "interview") }), el("span", { class: "sp" }), icon("out")));
    }) : el("div", { class: "empty", style: "grid-column:1/-1", text: "Clients appear here when you add a client to an interview." }));
    shell([["Studio", "#/"], ["Knowledge base"]], [
      el("div", { class: "dhead" }, el("div", null, el("div", { class: "eyebrow", text: "Knowledge base" }), el("h1", { text: "What clients already told us" }),
        el("p", { class: "muted", style: "margin:0;max-width:760px", text: "After every finished interview the answers are saved here per client. In the next interview the AI sees them and skips questions that are already answered." }))),
      grid], "c");
  }
  async function clientView(id) {
    var c = (await api("/api/admin?op=client&id=" + id)).client;
    if (!state.clients.length) await loadAll();
    var facts = (c.facts || []).map(function (f) { return Object.assign({}, f); });
    var list = el("div");
    var msg = el("span", { class: "hint" });
    function draw() {
      list.replaceChildren.apply(list, facts.length ? facts.map(function (f, i) {
        var t = el("input", { class: "in", value: f.topic }); t.oninput = function () { f.topic = t.value; };
        var a = el("textarea", { class: "in", rows: "2" }); a.value = f.answer; a.oninput = function () { f.answer = a.value; };
        var src = f.source && f.source.title ? "From: " + f.source.title : f.source && f.source.manual ? "Added manually" : "";
        return el("div", { class: "fact" }, el("div", null, t, el("div", { class: "src", text: [src, V.fmtDate(f.at, "en")].filter(Boolean).join(" · ") })), a,
          el("button", { class: "btn sm danger", type: "button", onclick: function () { facts.splice(i, 1); draw(); } }, "Delete"));
      }) : [el("p", { class: "muted", text: "No saved answers yet. They appear after a finished interview, or add them by hand." })]);
    }
    draw();
    var saveBtn = el("button", { class: "btn gold", type: "button", onclick: async function () {
      saveBtn.disabled = true; msg.textContent = "Saving…";
      try { await post({ op: "client-save", id: id, facts: facts }); msg.textContent = "Saved."; V.toast("Knowledge base saved"); }
      catch (e) { msg.textContent = "Could not save: " + e.message; }
      saveBtn.disabled = false;
    } }, "Save changes");
    shell([["Studio", "#/"], ["Knowledge base", "#/clients"], [c.name]], [
      el("div", { class: "dhead" }, el("div", null, el("div", { class: "eyebrow", text: "Client" }), el("h1", { text: c.name }),
        el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, el("span", { class: "chip", text: facts.length + " saved answers" }),
          (c.interviews || []).map(function (x) { return el("a", { class: "chip", href: "#/i/" + x.id, style: "text-decoration:none", text: x.title }); })))),
      el("div", { class: "sect" }, el("div", { class: "h" }, el("h2", { text: "Saved answers" }),
        el("button", { class: "btn sm", type: "button", onclick: function () { facts.unshift({ topic: "", answer: "", source: { manual: true }, at: new Date().toISOString() }); draw(); } }, icon("plus"), "Add answer")),
        el("p", { class: "muted", style: "margin-top:0", text: "Topic on the left, the client's answer on the right. Edit anything that is outdated." }), list,
        el("div", { style: "display:flex;gap:12px;align-items:center;margin-top:20px" }, saveBtn, msg))], "c");
  }

  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtNum(n) { n = n || 0; return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(n); }

  route();
})();
