/* Client side: pre-interview presentation (slides) and the interview chat. */
(function () {
  "use strict";
  var el = V.el, icon = V.icon, api = V.api;
  var T = {
    ru: {
      ai: "Interviewer", you: "Your answer", start: "Начать интервью", send: "Отправить", finish: "Завершить интервью",
      coverage: "Что уже обсудили?", copy: "Скопировать ответы", copied: "Ответы скопированы", brief: "Бриф",
      placeholder: "Напишите или надиктуйте ответ…", saved: "Ответы сохраняются автоматически. Ctrl/⌘ + Enter — отправить.",
      done: "Спасибо! Интервью завершено, ответы уже у команды Velor. Страницу можно закрыть.",
      err: "Не получилось получить ответ. Попробуйте ещё раз через минуту.", retry: "Повторить",
      micStart: "Диктовать", micStop: "Остановить диктовку",
      confirmFinish: "Завершить интервью? Продолжить потом будет нельзя.", yes: "Да, завершить", no: "Продолжить", finishing: "Сохраняю…",
      missing: "Интервью по этой ссылке не найдено. Проверьте ссылку или попросите новую.", closed: "Это интервью закрыто.",
      startIntro: "Это подготовительное интервью для сценария вашего видео. Я задаю по одному короткому вопросу и выбираю следующий по вашему ответу. Отвечайте как удобно, неровные формулировки нормальны. Обычно это 15–20 минут.",
      resume: "Можно закрыть страницу и вернуться позже по той же ссылке в этом браузере.",
      kicker: "Бриф перед интервью", for: "Для", client: "Клиент", by: "Подготовил",
      coverLead: function (n) { return "Короткое чтение перед интервью. " + n + ": что это за видео, видение, первый драфт хука" + "{mid}" + ", финальный CTA и что нам нужно от вас. Последний раздел запускает интервью на 15–20 минут."; },
      sections: { concept: "Концепция видео", vision: "Видение", hook: "Хук · первый драфт", midroll: "CTA в середине · опционально", endcta: "Финальный CTA", next: "Что дальше" },
      titles: { vision: "Видение", hook: "Хук", midroll: "CTA в середине", endcta: "Финальный CTA", next: "Что дальше" },
      audience: "Для кого", reference: "Референс", whyRef: "Почему этот референс", feel: "Ощущение",
      draftHook: "Драфт хука", approach: "Подход", option: "Вариант", good: "Что уже ясно", need: "Что нужно от вас", covers: "Интервью охватит",
      tipK: "Совет", tip: "Надиктовывайте, а не печатайте: так быстрее и живее. В поле ответа есть кнопка микрофона. Ещё вариант — встроенная диктовка: дважды Fn на Mac, Win + H на Windows.",
      startNote: "15–20 минут · ответы сохраняются автоматически",
      preview: "Предпросмотр: в этом режиме интервью не запускается.", progress: "Интервью пройдено", progressDone: "Интервью завершено", prev: "Назад", next: "Дальше", nSec: function (n) { return n === 5 ? "Пять разделов" : "Шесть разделов"; }
    },
    en: {
      ai: "Interviewer", you: "Your answer", start: "Start interview", send: "Send", finish: "End interview",
      coverage: "What have we covered?", copy: "Copy my answers", copied: "Answers copied", brief: "Brief",
      placeholder: "Type or dictate your answer…", saved: "Answers save automatically. Ctrl/⌘ + Enter to send.",
      done: "Thank you! The interview is complete and your answers are with the Velor team. You can close this page.",
      err: "Couldn't get a reply. Please try again in a minute.", retry: "Retry",
      micStart: "Dictate", micStop: "Stop dictation",
      confirmFinish: "End the interview? You won't be able to continue later.", yes: "Yes, end it", no: "Keep going", finishing: "Saving…",
      missing: "No interview was found at this link. Check the link or ask for a new one.", closed: "This interview is closed.",
      startIntro: "This is a preparation interview for your video's script. I ask one short question at a time and choose the next one from your answer. Answer however is easiest; rough wording is fine. It usually takes 15–20 minutes.",
      resume: "You can close this page and come back later via the same link in this browser.",
      kicker: "Research brief", for: "For", client: "Client", by: "Written by",
      coverLead: function (n) { return "A short read before your interview. " + n + ": what the video is, the vision for it, a first draft of the hook" + "{mid}" + ", the end-CTA, and what we still need from you. The final section kicks you into a 15–20 minute interview."; },
      sections: { concept: "Video concept", vision: "Vision", hook: "The hook · first draft", midroll: "Mid-roll CTA · optional", endcta: "The end-CTA", next: "What's next" },
      titles: { vision: "Vision", hook: "The hook", midroll: "The mid-roll", endcta: "The end-CTA", next: "What's next" },
      audience: "For", reference: "Reference", whyRef: "Why this reference", feel: "Feel",
      draftHook: "Hook draft", approach: "Approach", option: "Option", good: "What we're good on", need: "What we need you for", covers: "The interview covers",
      tipK: "Pro tip", tip: "Dictate, don't type: it's faster and sounds more like you. There's a mic button in the answer box, or use built-in dictation: Fn twice on Mac, Win + H on Windows.",
      startNote: "15–20 minutes · answers save automatically",
      preview: "Preview: the interview does not start in this mode.", progress: "Interview progress", progressDone: "Interview complete", prev: "Back", next: "Next", nSec: function (n) { return n === 5 ? "Five sections" : "Six sections"; }
    }
  };

  var app = document.getElementById("app");
  var path = location.pathname.replace(/\/+$/, "");
  var m = path.match(/^\/(?:i\/)?([a-z0-9-]{2,64})$/);
  var hashId = (location.hash || "").replace(/^#/, "");
  var briefId = m ? m[1] : (/^[a-z0-9-]{2,64}$/.test(hashId) ? hashId : "");
  var preview = /[?&]preview=1/.test(location.search);
  var L = T.ru, brief = null, sid = "", session = { messages: [], status: "new" }, busy = false;
  var slides = [], slideIdx = 0;

  function header(opts) {
    opts = opts || {};
    var acts = el("div", { class: "acts" });
    if (opts.briefBtn) acts.append(el("button", { class: "btn sm pill", type: "button", onclick: showDeck }, L.brief));
    acts.append(V.themeToggle());
    if (opts.finishBtn) acts.append(el("button", { class: "btn sm pill", type: "button", id: "finishBtn", onclick: confirmFinish }, L.finish));
    return el("header", { class: "top" }, V.logo("Interview"), el("div", { class: "title", text: brief ? brief.title : "" }), acts);
  }
  function page(content, opts) { app.replaceChildren(header(opts), content); window.scrollTo(0, 0); }
  function message(text) { page(el("main", { class: "chat" }, el("div", { class: "panel" }, el("p", { text: text })))); }

  async function init() {
    if (!briefId) {
      app.replaceChildren(header(), el("main", { class: "chat" }, el("div", { class: "panel" }, el("h1", { text: "Velor Interview" }),
        el("p", { class: "muted", text: "Откройте персональную ссылку на интервью, которую прислала команда Velor. / Open the personal interview link the Velor team sent you." }))));
      return;
    }
    try { brief = await api("/api/brief?id=" + encodeURIComponent(briefId)); }
    catch (e) { app.replaceChildren(header(), el("main", { class: "chat" }, el("div", { class: "panel" }, el("p", { text: T.ru.missing + " / " + T.en.missing })))); return; }
    L = T[brief.lang === "en" ? "en" : "ru"];
    document.documentElement.lang = brief.lang === "en" ? "en" : "ru";
    document.title = brief.title + " · Velor";
    if (!brief.active && !preview) { message(L.closed); return; }
    buildSlides();
    if (preview) { showDeck(); return; }
    sid = V.lsGet("velor-sid-" + briefId); if (!sid) { sid = V.rid(); V.lsSet("velor-sid-" + briefId, sid); }
    try { session = await api("/api/session?b=" + briefId + "&s=" + sid); } catch (e) { session = { messages: [], status: "new" }; }
    if (session.status === "done" || (session.messages || []).length) showChat();
    else if (slides.length) showDeck();
    else showStart();
  }

  /* ---------- slides ---------- */
  function buildSlides() {
    slides = [];
    var p = brief.presentation; if (!p) return;
    var hasMid = p.midroll && p.midroll.enabled;
    var n = 0, num = function () { n++; return (n < 10 ? "0" : "") + n + " — "; };
    var sec = L.sections, tt = L.titles;
    var lead = L.coverLead(L.nSec(hasMid ? 6 : 5)).replace("{mid}", hasMid ? (brief.lang === "en" ? ", an optional mid-roll CTA" : ", CTA в середине видео") : "");
    var metaItems = [[L.for, brief.speaker], [L.client, brief.client], [L.by, brief.writtenBy]].filter(function (x) { return x[1]; });
    slides.push(function () {
      return [el("div", { class: "eyebrow", text: L.kicker }), el("h1", { text: brief.title }),
        metaItems.length ? el("div", { class: "meta" }, metaItems.map(function (x) { return el("div", null, el("span", { class: "k", text: x[0] }), el("span", { class: "v", text: x[1] })); })) : null,
        el("p", { class: "lead", text: brief.intro || lead })];
    });
    if (p.concept && (p.concept.summary || p.concept.title)) slides.push(function () {
      var r = brief.reference;
      return [el("div", { class: "eyebrow", text: num() + sec.concept }), el("h2", { text: p.concept.title || brief.title }),
        para(p.concept.summary),
        p.concept.audience ? el("div", { class: "row2" }, el("div", { class: "k", text: L.audience }), el("div", null, para(p.concept.audience))) : null,
        r && r.url ? [el("div", { class: "eyebrow", style: "margin-top:44px;color:var(--faint)", text: L.reference }),
          el("div", { class: "ref" },
            el("a", { class: "thumb", href: r.url, target: "_blank", rel: "noopener" }, el("img", { src: ytThumb(r), alt: r.title || "Reference video", loading: "lazy" })),
            el("div", null, el("p", { class: "rt", text: r.title || r.url }), r.channel ? el("div", { class: "rc", text: r.channel }) : null,
              r.note ? [el("div", { class: "eyebrow", style: "color:var(--faint);margin:10px 0 8px;font-size:11px", text: L.whyRef }), el("p", { style: "font-size:17px", text: r.note })] : null))] : null];
    });
    if (p.vision && p.vision.text) slides.push(function () {
      return [el("div", { class: "eyebrow", text: num() + sec.vision }), el("h2", { text: tt.vision }), para(p.vision.text),
        p.vision.feel ? el("div", { class: "row2" }, el("div", { class: "k", text: L.feel }), el("div", null, para(p.vision.feel))) : null];
    });
    if (p.hook && (p.hook.draft || p.hook.note)) slides.push(function () {
      return [el("div", { class: "eyebrow", text: num() + sec.hook }), el("h2", { text: tt.hook }),
        p.hook.note ? el("p", { class: "note", text: p.hook.note }) : null,
        p.hook.draft ? el("div", { class: "box gold" }, el("div", { class: "k", text: L.draftHook }), el("div", { class: "spoken", text: p.hook.draft })) : null];
    });
    if (hasMid) slides.push(function () {
      return [el("div", { class: "eyebrow", text: num() + sec.midroll }), el("h2", { text: tt.midroll }), para(p.midroll.note),
        p.midroll.approach ? el("div", { class: "box" }, el("div", { class: "k", text: L.approach }), el("p", { style: "margin:0", text: p.midroll.approach })) : null,
        p.midroll.confirm ? el("p", { class: "note", text: p.midroll.confirm }) : null];
    });
    if (p.endcta && ((p.endcta.options || []).length || p.endcta.note)) slides.push(function () {
      return [el("div", { class: "eyebrow", text: num() + sec.endcta }), el("h2", { text: tt.endcta }),
        p.endcta.note ? el("p", { class: "note", text: p.endcta.note }) : null,
        (p.endcta.options || []).map(function (o, i) {
          return el("div", { class: "box" + (i === 0 ? " gold" : "") }, el("div", { class: "k", text: o.label || (L.option + " " + "ABCD"[i]) }), el("div", { class: "spoken", text: o.text }));
        })];
    });
    slides.push(function () {
      var nx = p.next || {};
      return [el("div", { class: "eyebrow", text: num() + sec.next }), el("h2", { text: tt.next }),
        nx.good ? [el("div", { class: "eyebrow", style: "color:var(--faint);margin-top:10px", text: L.good }), para(nx.good)] : null,
        nx.need ? [el("div", { class: "eyebrow", style: "color:var(--faint);margin-top:34px", text: L.need }), para(nx.need)] : null,
        (nx.covers || []).length ? [el("div", { class: "eyebrow", style: "color:var(--faint);margin-top:34px", text: L.covers }),
          el("ul", { class: "covers" }, nx.covers.map(function (c) { return el("li", { text: c }); }))] : null,
        el("div", { class: "tip" }, el("div", { class: "k", text: L.tipK }), el("p", { text: L.tip })),
        el("div", { class: "startbar" },
          el("button", { class: "btn gold", type: "button", onclick: startFromDeck }, L.start, icon("arrow")),
          el("span", { class: "muted", text: preview ? L.preview : L.startNote }))];
    });
  }
  function para(t) { return t ? String(t).split(/\n{2,}/).map(function (x) { return el("p", { text: x }); }) : null; }
  function ytThumb(r) {
    var mm = String(r.url).match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return mm ? "https://i.ytimg.com/vi/" + mm[1] + "/hqdefault.jpg" : (r.thumb || "/favicon.png");
  }
  function showDeck() {
    if (!slides.length) return;
    slideIdx = Math.min(V.lsGet("velor-slide-" + briefId) || 0, slides.length - 1);
    var stage = el("div", { class: "slide" });
    var count = el("div", { class: "count" });
    var prev = el("button", { class: "navbtn prev", type: "button", "aria-label": L.prev, onclick: function () { go(-1); } }, icon("left"));
    var next = el("button", { class: "navbtn next", type: "button", "aria-label": L.next, onclick: function () { go(1); } }, icon("right"));
    var deck = el("main", { class: "deck" }, count, stage);
    function draw() {
      stage.replaceChildren.apply(stage, [].concat(slides[slideIdx]()).flat(3).filter(Boolean));
      stage.style.animation = "none"; void stage.offsetWidth; stage.style.animation = "";
      count.replaceChildren(el("b", { text: pad(slideIdx + 1) }), " / " + pad(slides.length));
      prev.disabled = slideIdx === 0; next.disabled = slideIdx === slides.length - 1;
      next.classList.toggle("pulse", slideIdx === 0);
      V.lsSet("velor-slide-" + briefId, slideIdx); window.scrollTo({ top: 0 });
    }
    function go(d) { var i = slideIdx + d; if (i < 0 || i >= slides.length) return; slideIdx = i; draw(); }
    document.onkeydown = function (e) {
      if (!document.body.contains(deck) || /INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
      if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1);
    };
    page(el("div", null, deck, prev, next));
    draw();
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function startFromDeck() {
    if (preview) { V.toast(L.preview); return; }
    document.onkeydown = null;
    if (session.status === "done" || (session.messages || []).length) { showChat(); return; }
    showChat(); askNext({});
  }
  function showStart() {
    var btn = el("button", { class: "btn gold", type: "button", onclick: function () { btn.disabled = true; showChat(); askNext({}); } }, L.start, icon("arrow"));
    page(el("main", { class: "chat" }, el("div", { class: "panel" },
      el("div", { class: "eyebrow", text: brief.speaker || "Velor Media" }), el("h1", { text: brief.title }),
      el("p", { class: "muted", text: brief.intro || L.startIntro }),
      el("div", { class: "startbar", style: "border:none;margin-top:10px;padding-top:6px" }, btn, el("span", { class: "muted", text: L.resume })))));
  }

  /* ---------- chat ---------- */
  var feed, input, sendBtn, micBtn, composer, retryEl, progEl;
  function setProgress(v) {
    if (!progEl) return; v = Math.max(0, Math.min(100, Math.round(v || 0)));
    progEl.querySelector("i").style.width = v + "%";
    progEl.querySelector(".pl").textContent = (v >= 100 ? L.progressDone : L.progress) + " · " + v + "%";
    progEl.setAttribute("role", "progressbar"); progEl.setAttribute("aria-valuenow", String(v)); progEl.setAttribute("aria-valuemin", "0"); progEl.setAttribute("aria-valuemax", "100");
  }
  function showChat() {
    document.onkeydown = null;
    feed = el("div", { "aria-live": "polite" });
    var main = el("main", { class: "chat" }, feed);
    var done = session.status === "done";
    page(main, { briefBtn: slides.length > 0, finishBtn: !done });
    progEl = el("div", { class: "progress" }, el("div", { class: "bar" }, el("i")), el("span", { class: "pl" }));
    app.querySelector(".top").append(progEl); setProgress(done ? 100 : session.progress || 0);
    (session.messages || []).forEach(function (mm) { addTurn(mm.role, mm.content); });
    if (done) { renderDone(); return; }
    buildComposer();
    var ms = session.messages || [];
    if (ms.length && ms[ms.length - 1].role === "user") showRetry();
    setTimeout(function () { window.scrollTo(0, document.body.scrollHeight); }, 30);
  }
  function addTurn(role, text) {
    var t = el("div", { class: "turn " + (role === "assistant" ? "ai" : "me") },
      el("div", { class: "who", text: role === "assistant" ? L.ai : L.you }), el("div", { class: "txt", text: text }));
    feed.append(t); return t;
  }
  function buildComposer() {
    input = el("textarea", { placeholder: L.placeholder, rows: "1", "aria-label": L.placeholder });
    var autosize = function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 240) + "px"; };
    input.addEventListener("input", function () { autosize(); V.lsSet("velor-draft-" + briefId, input.value); syncSend(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } });
    var draft = V.lsGet("velor-draft-" + briefId); if (typeof draft === "string") input.value = draft;
    sendBtn = el("button", { class: "round send", type: "button", "aria-label": L.send, onclick: submit }, icon("send"));
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    micBtn = SR ? el("button", { class: "round mic", type: "button", "aria-label": L.micStart, title: L.micStart, onclick: toggleMic }, icon("mic")) : null;
    composer = el("div", { class: "composer" },
      el("div", { class: "in-wrap" }, input, micBtn, sendBtn),
      el("div", { class: "under" }, el("span", { text: L.saved }),
        el("span", { class: "l" },
          el("button", { class: "btn link", type: "button", onclick: function () { input.value = L.coverage; submit(); } }, L.coverage),
          el("button", { class: "btn link", type: "button", onclick: function () { V.copyText(V.transcriptText(session.messages, L), L.copied); } }, L.copy))));
    app.append(composer); autosize(); syncSend();
    setTimeout(function () { input.focus(); }, 50);
  }
  function syncSend() { if (sendBtn) sendBtn.disabled = busy || !(input && input.value.trim()); }
  var rec = null, listening = false;
  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (listening && rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = brief.lang === "en" ? "en-US" : "ru-RU"; rec.continuous = true; rec.interimResults = true;
    var finalText = input.value ? input.value.replace(/\s*$/, " ") : "";
    rec.onresult = function (ev) {
      var interim = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) { var r = ev.results[i]; if (r.isFinal) finalText += r[0].transcript + " "; else interim += r[0].transcript; }
      input.value = finalText + interim; input.dispatchEvent(new Event("input"));
    };
    rec.onstart = function () { listening = true; micBtn.classList.add("on"); micBtn.title = L.micStop; };
    rec.onend = function () { listening = false; micBtn.classList.remove("on"); micBtn.title = L.micStart; };
    rec.onerror = function () {};
    try { rec.start(); } catch (e) {}
  }
  async function submit() {
    if (busy || !input) return; var text = (input.value || "").trim(); if (!text) return;
    if (listening && rec) { try { rec.stop(); } catch (e) {} }
    addTurn("user", text); input.value = ""; input.dispatchEvent(new Event("input")); V.lsSet("velor-draft-" + briefId, "");
    session.messages = (session.messages || []).concat([{ role: "user", content: text }]);
    await askNext({ text: text });
  }
  function showRetry() {
    if (retryEl) retryEl.remove();
    retryEl = el("div", { class: "retry" }, el("span", { text: L.err }),
      el("button", { class: "btn sm", type: "button", onclick: function () { retryEl.remove(); retryEl = null; askNext({}); } }, L.retry));
    feed.after(retryEl);
  }
  async function askNext(payload) {
    busy = true; syncSend();
    var tip = el("div", { class: "turn ai" }, el("div", { class: "who", text: L.ai }), el("div", { class: "txt" }, el("span", { class: "cursor" })));
    feed.append(tip); tip.scrollIntoView({ behavior: "smooth", block: "end" });
    var ok = false;
    try {
      var r = await api("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ b: briefId, s: sid }, payload)) });
      tip.querySelector(".txt").textContent = r.reply; session.messages = r.messages; ok = true; if (r.progress != null) { session.progress = r.progress; setProgress(r.progress); }
      tip.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { tip.remove(); showRetry(); }
    busy = false; syncSend(); if (input) input.focus();
    return ok;
  }
  function confirmFinish() {
    if (busy || !composer) return;
    var old = document.getElementById("confirmBar"); if (old) { old.remove(); return; }
    var bar = el("div", { class: "panel", id: "confirmBar" }, el("p", { style: "margin-top:0", text: L.confirmFinish }),
      el("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
        el("button", { class: "btn gold", type: "button", onclick: async function (ev) { ev.currentTarget.disabled = true; ev.currentTarget.textContent = L.finishing; await finish(); } }, L.yes),
        el("button", { class: "btn", type: "button", onclick: function () { bar.remove(); } }, L.no)));
    feed.after(bar); bar.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function finish() {
    busy = true;
    try { await api("/api/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ b: briefId, s: sid }) }); } catch (e) {}
    session.status = "done"; busy = false; showChat();
  }
  function renderDone() {
    feed.after(el("div", { class: "panel" }, el("div", { class: "eyebrow", text: brief.lang === "en" ? "Done" : "Готово" }),
      el("p", { style: "font-size:19px", text: L.done }),
      el("button", { class: "btn", type: "button", onclick: function () { V.copyText(V.transcriptText(session.messages, L), L.copied); } }, icon("copy"), L.copy)));
  }

  init();
})();
