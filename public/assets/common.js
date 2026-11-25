/* Shared helpers for the client page and the studio. */
(function (w) {
  "use strict";
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  async function api(path, opts) {
    var r = await fetch(path, opts); var j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var e = new Error(j.error || ("http_" + r.status)); e.status = r.status; throw e; }
    return j;
  }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function rid() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
  var toastT;
  function toast(msg) {
    var t = document.querySelector(".toast"); if (!t) { t = el("div", { class: "toast" }); document.body.append(t); }
    t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.add("hidden"); }, 2200);
  }
  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || "Copied"); }
    catch (e) { toast("Copy failed"); }
  }
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    chat: '<path d="M4 5h16v11H8l-4 4z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    out: '<path d="M7 17L17 7M8 7h9v9"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M4 4v4h4M20 20v-4h-4"/>',
    book: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'
  };
  function icon(name, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.7"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("class", "icon " + (cls || "")); s.setAttribute("aria-hidden", "true"); s.innerHTML = ICONS[name] || ""; return s;
  }
  function themeToggle(labels) {
    labels = labels || { light: "Light", dark: "Dark" };
    var root = document.documentElement;
    var lb = el("button", { type: "button", "aria-label": labels.light }, icon("sun"), el("span", { text: labels.light }));
    var db = el("button", { type: "button", "aria-label": labels.dark }, icon("moon"), el("span", { text: labels.dark }));
    function sync() { var d = root.getAttribute("data-theme") !== "light"; db.classList.toggle("on", d); lb.classList.toggle("on", !d); }
    function set(t) { root.setAttribute("data-theme", t); try { localStorage.setItem("velor-theme", t); } catch (e) {} sync(); }
    lb.onclick = function () { set("light"); }; db.onclick = function () { set("dark"); };
    sync(); return el("div", { class: "seg" }, lb, db);
  }
  function logo(sub, href) {
    return el(href ? "a" : "div", { class: "brand", href: href || null },
      el("img", { src: "/assets/velor-logo.png", alt: "Velor" }), sub ? el("span", { class: "eyebrow", text: sub }) : null);
  }
  function fmtDate(iso, lang) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "short", day: "numeric" }); } catch (e) { return ""; }
  }
  function transcriptText(msgs, L) {
    var n = 0;
    return (msgs || []).map(function (m) { return m.role === "assistant" ? (L ? L.ai : "Q") + ": " + m.content : (L ? L.you + " " : "A") + (++n) + ": " + m.content; }).join("\n\n");
  }
  w.V = { el: el, api: api, lsGet: lsGet, lsSet: lsSet, rid: rid, toast: toast, copyText: copyText, icon: icon, themeToggle: themeToggle, logo: logo, fmtDate: fmtDate, transcriptText: transcriptText };
})(window);
