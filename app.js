
(() => {
  "use strict";

  const ADMIN_NAME = "Keagan Wayne Appel";
  const ADMIN_PASSWORD = "31415";
  const ADMIN_AUTH_KEY = "scls-sotm-admin-unlocked";
  const LOCAL_KEY = "scls-sotm-state-v1";
  const TEACHER_KEY = "scls-sotm-current-teacher";
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const supabaseConfig = window.SCLS_SUPABASE_CONFIG || {};
  const seed = structuredClone(window.SCLS_SEED_DATA || {});
  let usingSupabase = Boolean(
    window.supabase &&
    supabaseConfig.url &&
    supabaseConfig.anonKey &&
    !supabaseConfig.url.includes("YOUR_") &&
    !supabaseConfig.anonKey.includes("YOUR_")
  );
  const sb = usingSupabase ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;

  const state = {
    ready: false,
    route: "home",
    currentTeacher: localStorage.getItem(TEACHER_KEY) || "",
    adminUnlocked: sessionStorage.getItem(ADMIN_AUTH_KEY) === "yes",
    students: [],
    teachers: [],
    winners: [],
    nominations: [],
    reasons: [],
    reactions: [],
    alerts: [],
    settings: []
  };

  const $ = (selector) => document.querySelector(selector);
  const app = $("#app");

  init();

  async function init() {
    window.addEventListener("hashchange", () => {
      state.route = cleanRoute();
      draw();
    });

    $("#brandHome").addEventListener("click", () => go("home"));
    $("#teacherPill").addEventListener("click", () => {
      localStorage.removeItem(TEACHER_KEY);
      state.currentTeacher = "";
      go("home");
      draw();
    });

    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("submit", handleSubmit);

    state.route = cleanRoute();
    await loadAll();
    state.ready = true;
    draw();
    tickCountdown();
    setInterval(tickCountdown, 1000);
  }

  function cleanRoute() {
    const raw = (location.hash || "#home").replace("#", "").trim();
    return ["home", "vote", "hall", "admin"].includes(raw) ? raw : "home";
  }

  function go(route) {
    location.hash = route;
    state.route = route;
  }

  function uid(prefix) {
    if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cloneSeed() {
    return structuredClone(seed);
  }

  async function loadAll() {
    if (!usingSupabase) {
      const saved = localStorage.getItem(LOCAL_KEY);
      const data = saved ? JSON.parse(saved) : cloneSeed();
      Object.assign(state, data);
      saveLocal();
      return;
    }

    try {
      const [
        students, teachers, winners, nominations, reasons, reactions, alerts, settings
      ] = await Promise.all([
        sb.from("students").select("*").order("full_name", { ascending: true }),
        sb.from("teachers").select("*").order("name", { ascending: true }),
        sb.from("winners").select("*").order("award_year", { ascending: true }).order("month_number", { ascending: true }),
        sb.from("nominations").select("*").order("created_at", { ascending: true }),
        sb.from("nomination_reasons").select("*").order("created_at", { ascending: true }),
        sb.from("nomination_reactions").select("*").order("updated_at", { ascending: false }),
        sb.from("student_alerts").select("*").order("created_at", { ascending: false }),
        sb.from("settings").select("*")
      ]);

      const responses = { students, teachers, winners, nominations, reasons, reactions, alerts, settings };
      const failed = Object.entries(responses).find(([, result]) => result.error);
      if (failed) throw failed[1].error;

      state.students = students.data || [];
      state.teachers = teachers.data || [];
      state.winners = winners.data || [];
      state.nominations = nominations.data || [];
      state.reasons = reasons.data || [];
      state.reactions = reactions.data || [];
      state.alerts = alerts.data || [];
      state.settings = settings.data || [];
    } catch (error) {
      console.error(error);
      toast("Supabase load failed. Falling back to local demo data for this browser.", "warning");
      usingSupabase = false;
      Object.assign(state, cloneSeed());
      saveLocal();
    }
  }

  function saveLocal() {
    if (usingSupabase) return;
    const serializable = {
      students: state.students,
      teachers: state.teachers,
      winners: state.winners,
      nominations: state.nominations,
      reasons: state.reasons,
      reactions: state.reactions,
      alerts: state.alerts,
      settings: state.settings
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(serializable));
  }

  function draw() {
    renderShell();
    if (!state.ready) {
      app.innerHTML = loadingView();
      return;
    }
    if (!state.currentTeacher) {
      app.innerHTML = loginView();
      return;
    }

    if (state.route === "vote") app.innerHTML = voteView();
    else if (state.route === "hall") app.innerHTML = hallView();
    else if (state.route === "admin") app.innerHTML = adminView();
    else app.innerHTML = homeView();
  }

  function renderShell() {
    const modeBadge = $("#modeBadge");
    modeBadge.textContent = usingSupabase ? "Supabase live" : "Local demo";
    modeBadge.className = `hidden sm:inline-flex text-[10px] uppercase tracking-widest rounded-full border px-2 py-1 ${
      usingSupabase ? "border-emerald-400/30 text-emerald-300 bg-emerald-500/10" : "border-yellow-500/30 text-yellow-300 bg-yellow-500/10"
    }`;

    $("#teacherPill").textContent = state.currentTeacher || "Select teacher";

    const items = [
      ["home", "Home", "home"],
      ["vote", "Nominate", "how_to_vote"],
      ["hall", "Hall of Fame", "leaderboard"]
    ];
    if (isAdmin()) items.push(["admin", "Admin", "admin_panel_settings"]);

    $("#desktopNav").innerHTML = items.map(([route, label]) => `
      <button type="button" data-route="${route}" class="${state.route === route ? "nav-active" : "nav-inactive"} font-label-sm text-label-sm uppercase transition-colors duration-200">
        ${escapeHtml(label)}
      </button>
    `).join("");

    $("#mobileNav").innerHTML = items.map(([route, label, icon]) => `
      <button type="button" data-route="${route}" class="flex flex-col items-center justify-center ${state.route === route ? "text-yellow-500 scale-110 drop-shadow-[0_0_5px_rgba(255,215,0,0.4)]" : "text-gray-500 grayscale opacity-70"} hover:text-yellow-300 transition-all active:scale-90 font-headline-md text-[10px] font-semibold uppercase">
        <span class="material-symbols-outlined mb-1 text-2xl" style="${state.route === route ? "font-variation-settings: 'FILL' 1;" : ""}">${icon}</span>
        ${escapeHtml(shortLabel(label))}
      </button>
    `).join("");
  }

  function loadingView() {
    return `
      <section class="min-h-[60vh] flex items-center justify-center">
        <div class="glass-panel rounded-2xl p-8 text-center">
          <span class="material-symbols-outlined text-yellow-500 text-5xl animate-pulse" style="font-variation-settings: 'FILL' 1;">star</span>
          <p class="mt-4 text-on-surface-variant">Loading awards system...</p>
        </div>
      </section>
    `;
  }

  function loginView() {
    const options = state.teachers
      .filter(t => t.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => `<option value="${escapeAttr(t.name)}">${escapeHtml(t.name)}${t.is_admin ? " · Admin" : ""}</option>`)
      .join("");

    return `
      <section class="min-h-[70vh] grid place-items-center">
        <div class="glass-panel rounded-2xl p-6 md:p-10 max-w-2xl w-full relative overflow-hidden">
          <div class="absolute -top-10 -left-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>
          <div class="relative z-10 text-center mb-8">
            <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mb-4 shadow-[0_0_40px_rgba(255,215,0,0.4)]">
              <span class="material-symbols-outlined text-[64px] text-black" style="font-variation-settings: 'FILL' 1;">stars</span>
            </div>
            <h1 class="font-display-lg text-display-lg text-primary-container">Grade 6 Student of the Month</h1>
            <p class="text-on-surface-variant mt-3">Select your teacher name to view nominations, upvote/downvote, or cast a new nomination.</p>
          </div>

          <form id="loginForm" class="relative z-10 flex flex-col gap-4">
            <label class="font-label-sm text-label-sm uppercase tracking-widest text-on-surface" for="teacherSelect">Teacher</label>
            <div class="relative">
              <select id="teacherSelect" class="w-full bg-surface-container-high/70 border border-outline/30 rounded-lg py-4 px-4 text-on-surface font-body-base appearance-none focus:outline-none focus:border-primary-container/60 focus:ring-1 focus:ring-primary-container/60">
                <option value="">Select your name...</option>
                ${options}
              </select>
              <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
            <button class="glow-button bg-primary-container text-on-primary font-headline-md text-[20px] py-4 rounded-lg flex items-center justify-center gap-2" type="submit">
              <span class="material-symbols-outlined">login</span>
              Enter voting system
            </button>
          </form>

        </div>
      </section>
    `;
  }

  function homeView() {
    const active = activeNominationsSorted();
    const votingWindow = getVotingWindow();
    const nominationTarget = getNominationTargetWindow();
    const votingClosed = isVotingClosed(votingWindow);
    const topGirls = candidateLeaders("girl").slice(0, 2);
    const topBoys = candidateLeaders("boy").slice(0, 2);

    return `
      <section class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mb-4 shadow-[0_0_40px_rgba(255,215,0,0.4)] relative overflow-hidden">
          <span class="material-symbols-outlined text-[64px] text-black" style="font-variation-settings: 'FILL' 1;">star</span>
        </div>
        <h1 class="font-display-lg text-display-lg text-primary-container">Grade 6 Nominees</h1>
        <p class="font-body-base text-body-base text-on-surface-variant mt-2 max-w-2xl mx-auto">
          ${votingClosed
            ? `${escapeHtml(votingWindow.monthName)} voting is closed. New nominations now save for ${escapeHtml(nominationTarget.monthName)} ${escapeHtml(nominationTarget.year)}.`
            : `${escapeHtml(votingWindow.monthName)} voting is open. Final target: two girls and two boys for Grade 6.`}
        </p>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-8">
        <div class="lg:col-span-4 glass-panel rounded-xl p-5">
          <p class="font-label-sm text-label-sm uppercase tracking-widest text-yellow-500 mb-2">Countdown</p>
          <h2 id="countdownText" class="font-headline-md text-3xl text-white">--</h2>
          <p class="text-on-surface-variant text-sm mt-2">${votingClosed ? `Closed for ${escapeHtml(votingWindow.monthName)}. New nominations save for ${escapeHtml(nominationTarget.monthName)}.` : `Current window: ${escapeHtml(votingWindow.monthName)} ${escapeHtml(votingWindow.year)}.`}</p>
        </div>
        <div class="lg:col-span-4 glass-panel rounded-xl p-5">
          <p class="font-label-sm text-label-sm uppercase tracking-widest text-yellow-500 mb-2">Top girls right now</p>
          ${miniLeaderList(topGirls)}
        </div>
        <div class="lg:col-span-4 glass-panel rounded-xl p-5">
          <p class="font-label-sm text-label-sm uppercase tracking-widest text-yellow-500 mb-2">Top boys right now</p>
          ${miniLeaderList(topBoys)}
        </div>
      </section>

      <section class="mb-10">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
          <div>
            <h2 class="font-headline-md text-2xl text-white">Current nomination list</h2>
          </div>
          <button data-route="vote" class="glow-button bg-primary-container text-on-primary px-5 py-3 rounded-full font-label-sm text-label-sm uppercase flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">add_circle</span>
            Cast new vote
          </button>
        </div>
        ${active.length ? nominationGrid(active) : emptyPanel("No current nominations yet.", `Use Cast New Vote to start the ${nominationTarget.monthName} list.`)}
      </section>

      <section>
        <div class="flex items-center gap-2 mb-5">
          <span class="material-symbols-outlined text-yellow-500" style="font-variation-settings: 'FILL' 1;">trophy</span>
          <h2 class="font-headline-md text-2xl text-white">Previous month winners</h2>
        </div>
        ${winnersByMonthView()}
      </section>
    `;
  }

  function voteView() {
    const votingWindow = getVotingWindow();
    const nominationTarget = getNominationTargetWindow();
    const votingClosed = isVotingClosed(votingWindow);
    const studentOptions = state.students
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map(s => `<option value="${escapeAttr(s.full_name)}">${escapeHtml(s.homeroom)} · ${escapeHtml(cap(s.gender))}</option>`)
      .join("");

    return `
      <section class="max-w-[860px] mx-auto">
        <div class="mb-10 text-center">
          <h1 class="font-display-lg text-display-lg text-primary mb-2 tracking-tight">Nominate a Student</h1>
          <p class="font-body-base text-body-base text-on-surface-variant">
            ${votingClosed
              ? `${escapeHtml(votingWindow.monthName)} voting is closed. New nominations submitted now will be saved for ${escapeHtml(nominationTarget.monthName)} ${escapeHtml(nominationTarget.year)}.`
              : `New nominations are being saved for ${escapeHtml(nominationTarget.monthName)} ${escapeHtml(nominationTarget.year)}.`}
          </p>
        </div>

        <div class="glass-panel rounded-xl p-6 md:p-10 relative overflow-hidden">
          <div class="absolute -top-10 -left-10 w-32 h-32 bg-primary-container/20 rounded-full blur-[40px] pointer-events-none"></div>
          <form id="nominationForm" class="flex flex-col gap-8 relative z-10">
            <div class="flex flex-col gap-2">
              <label class="font-label-sm text-label-sm text-on-surface uppercase tracking-widest">Nominator</label>
              <div class="w-full bg-surface-container/30 border border-outline/10 rounded-lg py-3 px-4 text-on-surface-variant font-body-base flex items-center gap-2">
                <span>${escapeHtml(state.currentTeacher)}</span>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label class="font-label-sm text-label-sm text-on-surface uppercase tracking-widest" for="studentName">Student Nominee</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
                <input list="studentList" class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 pl-12 pr-4 text-on-surface font-body-base placeholder-on-surface-variant/50 focus:outline-none focus:border-primary-container/50 focus:ring-1 focus:ring-primary-container/50 transition-colors" id="studentName" name="studentName" placeholder="Start typing the student name..." autocomplete="off" required />
                <datalist id="studentList">${studentOptions}</datalist>
              </div>
            </div>

            <div id="studentInfoPanel" class="w-full bg-surface-container/30 border border-outline/10 rounded-lg py-4 px-4 text-on-surface-variant font-body-base flex items-start gap-3">
              <span class="material-symbols-outlined text-sm mt-1">info</span>
              <span>Select a student to display homeroom, previous winner status, current nomination status, and admin notes.</span>
            </div>

            <div class="flex flex-col gap-2">
              <label class="font-label-sm text-label-sm text-on-surface uppercase tracking-widest" for="reason">Accolade Reason</label>
              <p class="text-xs font-body-base text-on-surface-variant mb-1">Concrete evidence works better than vague praise. Mention what the student actually did.</p>
              <textarea class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface font-body-base focus:outline-none focus:border-primary-container/50 focus:ring-1 focus:ring-primary-container/50 transition-colors resize-none placeholder-on-surface-variant/50" id="reason" name="reason" placeholder="Describe the student's contribution, growth, kindness, leadership, responsibility, or improvement..." rows="6" required></textarea>
            </div>

            <div class="pt-2">
              <button class="w-full glow-button bg-primary-container text-on-primary font-headline-md text-[20px] py-4 rounded-lg flex items-center justify-center gap-2" type="submit">
                <span class="material-symbols-outlined">stars</span>
                Submit nomination
              </button>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  function hallView() {
    const girls = candidateLeaders("girl");
    const boys = candidateLeaders("boy");

    return `
      <section class="text-center mb-12">
        <h1 class="font-display-lg text-display-lg text-primary-container mb-4 drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]">Hall of Fame</h1>
        <p class="font-body-base text-body-base text-on-surface-variant max-w-2xl mx-auto">
          Previous winners are grouped by month. The live leaderboard below shows active nominations and the current top two by gender.
        </p>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-gutter mb-10">
        <div class="glass-panel star-glow rounded-xl p-6 relative overflow-hidden">
          <div class="absolute -top-10 -left-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>
          <div class="relative z-10">
            <div class="flex items-center gap-2 mb-4">
              <span class="material-symbols-outlined text-yellow-500 text-3xl" style="font-variation-settings: 'FILL' 1;">female</span>
              <h2 class="font-headline-md text-2xl text-white">Girls leaderboard</h2>
            </div>
            ${leaderTable(girls)}
          </div>
        </div>
        <div class="glass-panel star-glow rounded-xl p-6 relative overflow-hidden">
          <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl"></div>
          <div class="relative z-10">
            <div class="flex items-center gap-2 mb-4">
              <span class="material-symbols-outlined text-yellow-500 text-3xl" style="font-variation-settings: 'FILL' 1;">male</span>
              <h2 class="font-headline-md text-2xl text-white">Boys leaderboard</h2>
            </div>
            ${leaderTable(boys)}
          </div>
        </div>
      </section>

      <section>
        <h2 class="font-headline-md text-2xl text-white mb-6 border-b border-white/10 pb-2">Past constellations</h2>
        ${winnersByMonthView()}
      </section>
    `;
  }

  function adminView() {
    if (!isAdmin()) {
      return emptyPanel("Admin access only.", `This panel is only visible to ${ADMIN_NAME}.`);
    }
    if (!state.adminUnlocked) return adminPasswordView();

    const votingWindow = getVotingWindow();
    const deadlineValue = toLocalDatetimeValue(votingWindow.deadline);
    const studentOptions = state.students
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map(s => `<option value="${escapeAttr(s.full_name)}">${escapeHtml(s.homeroom)} · ${escapeHtml(cap(s.gender))}</option>`)
      .join("");
    const monthNum = votingWindow.monthNumber;
    const currentMonth = votingWindow.monthName;
    const leadersGirls = candidateLeaders("girl").slice(0, 2);
    const leadersBoys = candidateLeaders("boy").slice(0, 2);
    const printFilter = getPrintFilter();

    return `
      <section class="mb-10 text-center">
        <h1 class="font-display-lg text-display-lg text-primary-container">Admin Control</h1>
        <p class="text-on-surface-variant mt-2">Deadline, warnings, winners, nominations, and print-ready certificate data.</p>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div class="lg:col-span-5 glass-panel rounded-xl p-6">
          <h2 class="font-headline-md text-2xl text-white mb-4">Voting window</h2>
          <form id="deadlineForm" class="flex flex-col gap-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input id="votingYearInput" name="votingYear" type="number" value="${escapeAttr(votingWindow.year)}" class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary-container/50" />
              <select id="votingMonthInput" name="votingMonth" class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary-container/50">
                ${MONTHS.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === monthNum ? "selected" : ""}>${m}</option>`).join("")}
              </select>
            </div>
            <input id="deadlineInput" name="deadlineInput" type="datetime-local" value="${escapeAttr(deadlineValue)}" class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary-container/50" />
            <p class="text-xs text-on-surface-variant">This controls the homepage month, countdown, and month used for new nominations while voting is open.</p>
            <button class="bg-primary-container text-on-primary rounded-lg py-3 font-label-sm text-label-sm uppercase glow-button" type="submit">Save voting window</button>
          </form>
        </div>

        <div class="lg:col-span-7 glass-panel rounded-xl p-6">
          <h2 class="font-headline-md text-2xl text-white mb-4">Student warning note</h2>
          <form id="alertForm" class="flex flex-col gap-4">
            <input list="adminStudentList" id="alertStudent" name="alertStudent" placeholder="Student name..." class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary-container/50" required />
            <datalist id="adminStudentList">${studentOptions}</datalist>
            <select id="alertSeverity" name="alertSeverity" class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary-container/50">
              <option value="info">Info / context</option>
              <option value="warning">Warning</option>
              <option value="serious">Serious concern</option>
            </select>
            <textarea id="alertNote" name="alertNote" rows="4" placeholder="Example: received detention for..." class="w-full bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface resize-none focus:outline-none focus:border-primary-container/50" required></textarea>
            <button class="bg-primary-container text-on-primary rounded-lg py-3 font-label-sm text-label-sm uppercase glow-button" type="submit">Add alert note</button>
          </form>
        </div>

        <div class="lg:col-span-12 glass-panel rounded-xl p-6">
          <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
            <div>
              <h2 class="font-headline-md text-2xl text-white">Record ${escapeHtml(currentMonth)} winners</h2>
              <p class="text-on-surface-variant">This replaces the winner set for the chosen month, so wrong entries can be corrected without SQL.</p>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
              ${[...leadersGirls, ...leadersBoys].map(item => `<span class="badge rounded-full px-3 py-1 text-yellow-300">${escapeHtml(item.student.full_name)} · ${item.score}</span>`).join("") || `<span class="text-on-surface-variant">No active leaders yet.</span>`}
            </div>
          </div>
          <form id="winnerForm" class="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input name="winnerYear" type="number" value="${escapeAttr(votingWindow.year)}" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
            <select name="winnerMonth" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface">
              ${MONTHS.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === monthNum ? "selected" : ""}>${m}</option>`).join("")}
            </select>
            <input list="adminStudentList" name="winner1" placeholder="Girl 1" value="${escapeAttr(leadersGirls[0]?.student.full_name || "")}" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
            <input list="adminStudentList" name="winner2" placeholder="Girl 2" value="${escapeAttr(leadersGirls[1]?.student.full_name || "")}" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
            <input list="adminStudentList" name="winner3" placeholder="Boy 1" value="${escapeAttr(leadersBoys[0]?.student.full_name || "")}" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
            <input list="adminStudentList" name="winner4" placeholder="Boy 2" value="${escapeAttr(leadersBoys[1]?.student.full_name || "")}" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
            <button class="md:col-span-6 bg-primary-container text-on-primary rounded-lg py-3 font-label-sm text-label-sm uppercase glow-button" type="submit">Record / replace winners</button>
          </form>
        </div>

        <div class="lg:col-span-12 glass-panel rounded-xl p-6">
          <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5 no-print">
            <div>
              <h2 class="font-headline-md text-2xl text-white">Winner certificate data</h2>
              <p class="text-on-surface-variant">Use this as the single page for certificate copy: winner names, homerooms, nomination month, vote totals, and written accolades.</p>
            </div>
            <button type="button" data-print-winners="1" class="bg-primary-container text-on-primary rounded-lg px-5 py-3 font-label-sm text-label-sm uppercase glow-button flex items-center gap-2 justify-center">
              <span class="material-symbols-outlined">print</span>
              Print winners
            </button>
          </div>
          <form id="printFilterForm" class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 no-print">
            <input name="printYear" type="number" value="${escapeAttr(printFilter.year)}" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
            <select name="printMonth" class="bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface">
              ${MONTHS.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === printFilter.monthNumber ? "selected" : ""}>${m}</option>`).join("")}
            </select>
            <button class="md:col-span-2 bg-surface-container-high border border-yellow-500/20 text-yellow-200 rounded-lg py-3 font-label-sm text-label-sm uppercase" type="submit">Show this month</button>
          </form>
          ${winnerPrintPacket(printFilter.year, printFilter.monthNumber)}
        </div>

        <div class="lg:col-span-12">
          <h2 class="font-headline-md text-2xl text-white mb-4">Active alert notes</h2>
          ${alertsView(true)}
        </div>

        <div class="lg:col-span-12">
          ${adminWinnersEditor(studentOptions)}
        </div>

        <div class="lg:col-span-12">
          ${adminNominationsEditor(studentOptions)}
        </div>
      </section>
    `;
  }

  function adminPasswordView() {
    return `
      <section class="min-h-[65vh] grid place-items-center">
        <div class="glass-panel rounded-2xl p-6 md:p-10 max-w-xl w-full relative overflow-hidden">
          <div class="absolute -top-10 -left-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>
          <div class="relative z-10 text-center mb-6">
            <span class="material-symbols-outlined text-yellow-500 text-6xl" style="font-variation-settings: 'FILL' 1;">admin_panel_settings</span>
            <h1 class="font-headline-md text-3xl text-white mt-3">Admin password</h1>
            <p class="text-on-surface-variant mt-2">Enter the admin password to open the control panel.</p>
          </div>
          <form id="adminUnlockForm" class="relative z-10 flex flex-col gap-4">
            <input id="adminPassword" name="adminPassword" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Password" class="w-full bg-surface-container-high/70 border border-outline/30 rounded-lg py-4 px-4 text-on-surface font-body-base focus:outline-none focus:border-primary-container/60 focus:ring-1 focus:ring-primary-container/60" />
            <button class="glow-button bg-primary-container text-on-primary font-headline-md text-[20px] py-4 rounded-lg flex items-center justify-center gap-2" type="submit">
              <span class="material-symbols-outlined">lock_open</span>
              Unlock admin
            </button>
          </form>
        </div>
      </section>
    `;
  }

  function adminWinnersEditor(studentOptions) {
    const winners = [...state.winners].sort((a, b) => {
      const av = Number(a.award_year) * 100 + Number(a.month_number);
      const bv = Number(b.award_year) * 100 + Number(b.month_number);
      return bv - av;
    });
    if (!winners.length) return emptyPanel("No winners to edit yet.", "Record winners first, then they will appear here for correction.");

    return `
      <div class="glass-panel rounded-xl p-6">
        <h2 class="font-headline-md text-2xl text-white mb-2">Edit recorded winners</h2>
        <p class="text-on-surface-variant mb-5">Correct wrong monthly winner entries here instead of changing SQL.</p>
        <div class="space-y-3">
          ${winners.map(w => {
            const s = studentById(w.student_id);
            return `
              <form id="winnerEditForm" class="rounded-xl border border-white/10 bg-black/20 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <input type="hidden" name="winnerId" value="${escapeAttr(w.id)}" />
                <input name="editWinnerYear" type="number" value="${escapeAttr(w.award_year)}" class="md:col-span-2 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
                <select name="editWinnerMonth" class="md:col-span-2 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface">
                  ${MONTHS.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === Number(w.month_number) ? "selected" : ""}>${m}</option>`).join("")}
                </select>
                <input list="adminStudentList" name="editWinnerStudent" value="${escapeAttr(s?.full_name || "")}" class="md:col-span-3 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
                <select name="editWinnerSlot" class="md:col-span-2 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface">
                  <option value="girl" ${String(w.slot || s?.gender) === "girl" ? "selected" : ""}>Girl</option>
                  <option value="boy" ${String(w.slot || s?.gender) === "boy" ? "selected" : ""}>Boy</option>
                </select>
                <button type="submit" class="md:col-span-1 rounded-lg bg-primary-container text-on-primary py-3 font-label-sm text-label-sm uppercase">Save</button>
                <button type="button" data-delete-winner="${escapeAttr(w.id)}" class="md:col-span-2 rounded-lg border border-red-400/30 text-red-200 bg-red-500/10 py-3 font-label-sm text-label-sm uppercase">Delete</button>
              </form>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function adminNominationsEditor(studentOptions) {
    const nominations = [...state.nominations].sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return String(studentById(a.student_id)?.full_name || "").localeCompare(String(studentById(b.student_id)?.full_name || ""));
    });
    if (!nominations.length) return emptyPanel("No nominations to edit yet.", "Nominations will appear here after teachers start voting.");

    return `
      <div class="glass-panel rounded-xl p-6">
        <h2 class="font-headline-md text-2xl text-white mb-2">Edit nominations</h2>
        <p class="text-on-surface-variant mb-5">Change the student, original teacher, accolade, nomination month, year, or status. Delete removes the nomination and its reactions/reasons.</p>
        <div class="space-y-4">
          ${nominations.map(n => {
            const s = studentById(n.student_id);
            return `
              <form id="nominationEditForm" class="rounded-xl border border-white/10 bg-black/20 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <input type="hidden" name="nominationId" value="${escapeAttr(n.id)}" />
                <input list="adminStudentList" name="editNominationStudent" value="${escapeAttr(s?.full_name || "")}" class="md:col-span-3 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
                <input name="editNominationTeacher" value="${escapeAttr(n.original_teacher || "")}" placeholder="Original teacher" class="md:col-span-3 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
                <select name="editNominationMonth" class="md:col-span-2 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface">
                  ${MONTHS.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === Number(n.first_month_number) ? "selected" : ""}>${m}</option>`).join("")}
                </select>
                <input name="editNominationYear" type="number" value="${escapeAttr(n.first_year || new Date().getFullYear())}" class="md:col-span-2 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface" />
                <select name="editNominationStatus" class="md:col-span-2 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface">
                  <option value="active" ${n.status === "active" ? "selected" : ""}>Active</option>
                  <option value="closed" ${n.status === "closed" ? "selected" : ""}>Closed</option>
                  <option value="withdrawn" ${n.status === "withdrawn" ? "selected" : ""}>Withdrawn</option>
                </select>
                <textarea name="editNominationReason" rows="4" class="md:col-span-12 bg-surface-container-high/50 border border-outline/30 rounded-lg py-3 px-4 text-on-surface resize-none">${escapeHtml(n.original_reason || "")}</textarea>
                <div class="md:col-span-12 flex flex-col md:flex-row md:justify-between gap-3">
                  <p class="text-xs text-on-surface-variant">Current score: ${nominationStats(n.id).score} · Up ${nominationStats(n.id).up} / Down ${nominationStats(n.id).down} · First nominated ${escapeHtml(n.first_month_name || "Unknown")} ${escapeHtml(n.first_year || "")}</p>
                  <div class="flex gap-2">
                    <button type="submit" class="rounded-lg bg-primary-container text-on-primary px-5 py-3 font-label-sm text-label-sm uppercase">Save nomination</button>
                    <button type="button" data-delete-nomination="${escapeAttr(n.id)}" class="rounded-lg border border-red-400/30 text-red-200 bg-red-500/10 px-5 py-3 font-label-sm text-label-sm uppercase">Delete</button>
                  </div>
                </div>
              </form>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function getPrintFilter() {
    const now = new Date();
    const year = Number(sessionStorage.getItem("scls-sotm-print-year")) || now.getFullYear();
    const monthNumber = Number(sessionStorage.getItem("scls-sotm-print-month")) || now.getMonth() + 1;
    return { year, monthNumber };
  }

  function winnerPrintPacket(year, monthNumber) {
    const monthName = MONTHS[monthNumber - 1] || "Month";
    const winners = state.winners
      .filter(w => Number(w.award_year) === Number(year) && Number(w.month_number) === Number(monthNumber))
      .sort((a, b) => String(a.slot).localeCompare(String(b.slot)) || String(studentById(a.student_id)?.full_name || "").localeCompare(String(studentById(b.student_id)?.full_name || "")));

    if (!winners.length) {
      return `<div id="winnerPrintPacket" class="print-area rounded-xl border border-white/10 bg-black/20 p-6 text-center text-on-surface-variant">No recorded winners for ${escapeHtml(monthName)} ${escapeHtml(year)} yet.</div>`;
    }

    return `
      <div id="winnerPrintPacket" class="print-area rounded-xl border border-white/10 bg-black/20 p-5 md:p-8">
        <div class="text-center mb-6">
          <p class="font-label-sm text-label-sm uppercase tracking-widest text-yellow-500">SCLS Grade 6 Student of the Month</p>
          <h2 class="font-headline-md text-3xl text-white mt-2">${escapeHtml(monthName)} ${escapeHtml(year)} Winners</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${winners.map(w => winnerCertificateCard(w)).join("")}
        </div>
      </div>
    `;
  }

  function winnerCertificateCard(winner) {
    const student = studentById(winner.student_id);
    if (!student) return "";
    const nomination = nominationForStudentAny(student.id);
    const stats = nomination ? nominationStats(nomination.id) : null;
    const allReasons = nomination ? state.reasons.filter(r => String(r.nomination_id) === String(nomination.id)) : [];
    const mainReason = nomination?.original_reason || "No nomination accolade found for this student.";
    const uniqueReasons = [];
    for (const r of allReasons) {
      if (r.reason && !uniqueReasons.some(x => sameText(x.reason, r.reason))) uniqueReasons.push(r);
    }

    return `
      <article class="rounded-xl border border-white/10 bg-white/5 p-5 break-inside-avoid">
        <div class="flex items-start gap-3 mb-3">
          ${avatar(student.full_name, "w-12 h-12")}
          <div>
            <h3 class="font-headline-md text-2xl text-white">${escapeHtml(student.full_name)}</h3>
            <p class="text-yellow-300 text-sm">Homeroom ${escapeHtml(student.homeroom)} · ${escapeHtml(cap(winner.slot || student.gender))}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm mb-4">
          <div class="rounded-lg bg-black/20 border border-white/10 p-2"><strong class="text-white">Nominated:</strong><br>${escapeHtml(nomination?.first_month_name || "Unknown")} ${escapeHtml(nomination?.first_year || "")}</div>
          <div class="rounded-lg bg-black/20 border border-white/10 p-2"><strong class="text-white">Votes:</strong><br>${stats ? `${stats.score} net · ${stats.up} up / ${stats.down} down` : "No vote data"}</div>
        </div>
        <p class="font-label-sm text-label-sm uppercase tracking-widest text-yellow-500 mb-2">Certificate accolade</p>
        <p class="text-on-surface leading-relaxed">${escapeHtml(mainReason)}</p>
        ${uniqueReasons.length > 1 ? `
          <div class="mt-4 border-t border-white/10 pt-3">
            <p class="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-2">Additional teacher wording</p>
            <div class="space-y-2">
              ${uniqueReasons.filter(r => !sameText(r.reason, mainReason)).map(r => `<p class="text-sm text-on-surface-variant"><strong class="text-on-surface">${escapeHtml(r.teacher_name)}:</strong> ${escapeHtml(r.reason)}</p>`).join("")}
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }

  function nominationForStudentAny(studentId) {
    return [...state.nominations]
      .filter(n => String(n.student_id) === String(studentId))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        const av = Number(a.first_year || 0) * 100 + Number(a.first_month_number || 0);
        const bv = Number(b.first_year || 0) * 100 + Number(b.first_month_number || 0);
        return bv - av;
      })[0];
  }

  function nominationGrid(nominations) {
    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">${nominations.map(nominationCard).join("")}</div>`;
  }

  function nominationCard(nom) {
    const student = studentById(nom.student_id);
    if (!student) return "";
    const stats = nominationStats(nom.id);
    const myReaction = state.reactions.find(r => r.nomination_id === nom.id && teacherMatches(r.teacher_name, state.currentTeacher));
    const alreadyWon = winnerForStudent(student.id);
    const activeAlerts = alertsForStudent(student.id);
    const isOriginal = teacherMatches(nom.original_teacher, state.currentTeacher);
    const extraReasons = state.reasons.filter(r => r.nomination_id === nom.id && r.reason && !sameText(r.reason, nom.original_reason));
    const eligible = !alreadyWon;
    const selectedUp = myReaction?.reaction === 1;
    const selectedDown = myReaction?.reaction === -1;

    return `
      <article class="glass-card rounded-xl overflow-hidden hover:shadow-[0_0_30px_rgba(255,215,0,0.15)] transition-shadow duration-300 relative">
        <div class="absolute top-0 left-0 w-32 h-32 bg-yellow-500/10 blur-[40px] rounded-full pointer-events-none"></div>
        <div class="p-6 flex flex-col h-full relative z-10">
          <div class="flex items-start gap-4 mb-4">
            ${avatar(student.full_name, "w-16 h-16")}
            <div class="flex-grow min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="font-headline-md text-[24px] leading-tight text-white">${escapeHtml(student.full_name)}</h3>
                  <div class="flex flex-wrap items-center gap-2 mt-2">
                    <span class="badge rounded-full px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">Homeroom ${escapeHtml(student.homeroom)}</span>
                    <span class="badge rounded-full px-2 py-1 font-label-sm text-label-sm ${student.gender === "girl" ? "text-pink-200" : "text-blue-200"}">${escapeHtml(cap(student.gender))}</span>
                    <span class="badge rounded-full px-2 py-1 font-label-sm text-label-sm text-yellow-200">Nominated ${escapeHtml(nom.first_month_name || "Unknown")} ${escapeHtml(nom.first_year || "")}</span>
                    <span class="rounded-full px-2 py-1 font-label-sm text-label-sm ${eligible ? "bg-emerald-500/10 border border-emerald-400/20 text-emerald-200" : "bg-red-500/10 border border-red-400/20 text-red-200"}">${eligible ? "New candidate" : "Already won"}</span>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="text-4xl font-headline-md text-yellow-400 leading-none">${stats.score}</div>
                  <div class="text-[10px] uppercase tracking-widest text-on-surface-variant">net</div>
                </div>
              </div>
            </div>
          </div>

          ${alreadyWon ? warningBlock(`Won in ${alreadyWon.month_name} ${alreadyWon.award_year}. This vote still records, but the system flags the repeat.`) : ""}
          ${activeAlerts.map(a => warningBlock(`${cap(a.severity)}: ${a.note}`, a.severity)).join("")}

          <div class="mb-5 flex-grow">
            <p class="font-body-base text-body-base text-on-surface italic">“${escapeHtml(nom.original_reason)}”</p>
            <p class="font-label-sm text-label-sm text-on-surface-variant mt-2 text-right">— ${escapeHtml(nom.original_teacher)}</p>
            ${extraReasons.length ? `
              <details class="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                <summary class="cursor-pointer text-yellow-300 text-sm">Additional teacher notes (${extraReasons.length})</summary>
                <div class="mt-3 space-y-3">
                  ${extraReasons.map(r => `<p class="text-sm text-on-surface-variant"><strong class="text-on-surface">${escapeHtml(r.teacher_name)}:</strong> ${escapeHtml(r.reason)}</p>`).join("")}
                </div>
              </details>
            ` : ""}
          </div>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="rounded-lg bg-emerald-500/10 border border-emerald-400/20 p-3 text-center">
              <div class="text-xl font-bold text-emerald-200">${stats.up}</div>
              <div class="text-[10px] uppercase tracking-widest text-emerald-200/70">up</div>
            </div>
            <div class="rounded-lg bg-red-500/10 border border-red-400/20 p-3 text-center">
              <div class="text-xl font-bold text-red-200">${stats.down}</div>
              <div class="text-[10px] uppercase tracking-widest text-red-200/70">down</div>
            </div>
            <div class="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
              <div class="text-xl font-bold text-white">${stats.totalTeachers}</div>
              <div class="text-[10px] uppercase tracking-widest text-on-surface-variant">teachers</div>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-auto">
            ${isOriginal ? `
              <span class="px-4 py-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">edit</span>
                Original nomination
              </span>
            ` : `
              <button data-reaction="-1" data-nomination-id="${escapeAttr(nom.id)}" class="w-11 h-11 rounded-full border ${selectedDown ? "border-red-300 bg-red-500/20 text-red-100" : "border-outline-variant bg-surface-container-high text-on-surface-variant"} flex items-center justify-center hover:text-white hover:border-white transition-colors" title="Downvote" type="button">
                <span class="material-symbols-outlined">thumb_down</span>
              </button>
              <button data-reaction="1" data-nomination-id="${escapeAttr(nom.id)}" class="px-6 py-2 rounded-full ${selectedUp ? "bg-emerald-400 text-emerald-950" : "bg-primary-container text-on-primary"} font-label-sm text-label-sm flex items-center gap-2 shadow-[0_0_15px_rgba(255,215,0,0.3)] hover:scale-105 transition-transform" type="button">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">thumb_up</span>
                ${selectedUp ? "Upvoted" : "Upvote"}
              </button>
            `}
          </div>
        </div>
      </article>
    `;
  }

  function winnersByMonthView() {
    const groups = groupWinnersByMonth();
    if (!groups.length) return emptyPanel("No winners recorded yet.", "Use the admin panel to record the first four winners.");

    return `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      ${groups.map(group => `
        <div class="glass-panel rounded-xl p-5 hover:bg-white/5 transition-colors">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-headline-md text-xl text-white">${escapeHtml(group.month_name)} ${group.award_year}</h3>
            <span class="material-symbols-outlined text-yellow-500" style="font-variation-settings: 'FILL' 1;">workspace_premium</span>
          </div>
          <div class="grid grid-cols-1 gap-3">
            ${group.items.map(w => {
              const s = studentById(w.student_id);
              return s ? `
                <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                  ${avatar(s.full_name, "w-11 h-11")}
                  <div>
                    <p class="font-bold text-white">${escapeHtml(s.full_name)}</p>
                    <p class="font-label-sm text-label-sm text-yellow-500">${escapeHtml(s.homeroom)} · ${escapeHtml(cap(w.slot || s.gender))}</p>
                  </div>
                </div>
              ` : "";
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>`;
  }

  function leaderTable(items) {
    if (!items.length) return `<p class="text-on-surface-variant">No candidates in this pool yet.</p>`;
    return `
      <div class="space-y-3">
        ${items.map((item, idx) => {
          const won = winnerForStudent(item.student.id);
          return `
            <div class="rounded-lg border border-white/10 bg-black/20 p-3 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 text-center font-headline-md text-yellow-400">${idx + 1}</div>
                ${avatar(item.student.full_name, "w-10 h-10")}
                <div class="min-w-0">
                  <p class="text-white font-bold truncate">${escapeHtml(item.student.full_name)}</p>
                  <p class="text-xs text-on-surface-variant">${escapeHtml(item.student.homeroom)}${won ? ` · won ${escapeHtml(won.month_name)}` : ""}</p>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-2xl text-yellow-300 font-headline-md">${item.score}</p>
                <p class="text-[10px] uppercase tracking-widest text-on-surface-variant">${item.up} up / ${item.down} down</p>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function miniLeaderList(items) {
    if (!items.length) return `<p class="text-on-surface-variant">No active nominees yet.</p>`;
    return `<div class="space-y-2">
      ${items.map((item, idx) => `
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-yellow-500 font-bold">${idx + 1}</span>
            <span class="truncate text-white">${escapeHtml(item.student.full_name)}</span>
          </div>
          <span class="rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 text-yellow-300 text-sm">${item.score}</span>
        </div>
      `).join("")}
    </div>`;
  }

  function alertsView(admin = false) {
    const activeAlerts = state.alerts.filter(a => a.active !== false);
    if (!activeAlerts.length) return emptyPanel("No active alert notes.", "Admin notes added here will appear on the nomination form and nominee cards.");

    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
      ${activeAlerts.map(alert => {
        const s = studentById(alert.student_id);
        return `
          <div class="glass-card rounded-xl p-5 flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined ${alert.severity === "serious" ? "text-red-300" : alert.severity === "warning" ? "text-yellow-300" : "text-blue-300"}">priority_high</span>
                <h3 class="font-bold text-white">${escapeHtml(s?.full_name || "Unknown student")}</h3>
                <span class="badge rounded-full px-2 py-1 text-xs">${escapeHtml(cap(alert.severity))}</span>
              </div>
              <p class="text-on-surface-variant">${escapeHtml(alert.note)}</p>
              <p class="text-xs text-on-surface-variant mt-2">Added by ${escapeHtml(alert.created_by || ADMIN_NAME)}</p>
            </div>
            ${admin ? `<button data-deactivate-alert="${escapeAttr(alert.id)}" type="button" class="text-on-surface-variant hover:text-red-200"><span class="material-symbols-outlined">close</span></button>` : ""}
          </div>
        `;
      }).join("")}
    </div>`;
  }

  function emptyPanel(title, body) {
    return `
      <div class="glass-panel rounded-xl p-8 text-center">
        <span class="material-symbols-outlined text-yellow-500 text-5xl mb-2">auto_awesome</span>
        <h3 class="font-headline-md text-2xl text-white">${escapeHtml(title)}</h3>
        <p class="text-on-surface-variant mt-2">${escapeHtml(body)}</p>
      </div>
    `;
  }

  function studentInfoHtml(student) {
    if (!student) {
      return `
        <span class="material-symbols-outlined text-sm mt-1">info</span>
        <span>Select a student to display homeroom, previous winner status, current nomination status, and admin notes.</span>
      `;
    }

    const nomination = activeNominationForStudent(student.id);
    const won = winnerForStudent(student.id);
    const alerts = alertsForStudent(student.id);

    return `
      <div class="flex items-start gap-3 w-full">
        ${avatar(student.full_name, "w-12 h-12")}
        <div class="flex-grow">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <strong class="text-white">${escapeHtml(student.full_name)}</strong>
            <span class="badge rounded-full px-2 py-1 text-xs">Homeroom ${escapeHtml(student.homeroom)}</span>
            <span class="badge rounded-full px-2 py-1 text-xs">${escapeHtml(cap(student.gender))}</span>
          </div>
          <div class="space-y-2 text-sm">
            ${won ? warningBlock(`Already won in ${won.month_name} ${won.award_year}. A new reason can still be stored, but this student will not appear in the active nomination list.`) : `<p class="text-emerald-200">No previous win recorded this year.</p>`}
            ${nomination ? warningBlock(`Already on the nomination list. Your reason will be added to the existing nomination, and your support reaction will be recorded once.`) : won ? `<p class="text-yellow-100">Not currently visible as a candidate because a win is already recorded.</p>` : `<p class="text-emerald-200">Not currently nominated. Submitting will create a ${escapeHtml(getNominationTargetWindow().monthName)} nomination card.</p>`}
            ${alerts.length ? alerts.map(a => warningBlock(`${cap(a.severity)}: ${a.note}`, a.severity)).join("") : ""}
          </div>
        </div>
      </div>
    `;
  }

  async function handleClick(event) {
    const routeBtn = event.target.closest("[data-route]");
    if (routeBtn) {
      go(routeBtn.dataset.route);
      return;
    }

    const reactionBtn = event.target.closest("[data-reaction]");
    if (reactionBtn) {
      await setReaction(reactionBtn.dataset.nominationId, Number(reactionBtn.dataset.reaction));
      return;
    }

    const deactivateBtn = event.target.closest("[data-deactivate-alert]");
    if (deactivateBtn) {
      await deactivateAlert(deactivateBtn.dataset.deactivateAlert);
      return;
    }

    const printBtn = event.target.closest("[data-print-winners]");
    if (printBtn) {
      window.print();
      return;
    }

    const deleteWinnerBtn = event.target.closest("[data-delete-winner]");
    if (deleteWinnerBtn) {
      if (confirm("Delete this recorded winner?")) await deleteWinner(deleteWinnerBtn.dataset.deleteWinner);
      return;
    }

    const deleteNominationBtn = event.target.closest("[data-delete-nomination]");
    if (deleteNominationBtn) {
      if (confirm("Delete this nomination and its reactions/reasons?")) await deleteNomination(deleteNominationBtn.dataset.deleteNomination);
      return;
    }

  }

  function handleInput(event) {
    if (event.target.id === "studentName") {
      const student = findStudentByName(event.target.value);
      const panel = $("#studentInfoPanel");
      if (panel) panel.innerHTML = studentInfoHtml(student);
    }
  }

  async function handleSubmit(event) {
    if (event.target.id === "adminUnlockForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      const password = String(data.get("adminPassword") || "").trim();
      if (password !== ADMIN_PASSWORD) return toast("Incorrect admin password.", "warning");
      state.adminUnlocked = true;
      sessionStorage.setItem(ADMIN_AUTH_KEY, "yes");
      toast("Admin unlocked.", "success");
      draw();
      return;
    }

    if (event.target.id === "loginForm") {
      event.preventDefault();
      const teacher = $("#teacherSelect").value;
      if (!teacher) return toast("Select your teacher name first.", "warning");
      state.currentTeacher = teacher;
      localStorage.setItem(TEACHER_KEY, teacher);
      go("home");
      draw();
      return;
    }

    if (event.target.id === "nominationForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      await submitNomination(String(data.get("studentName") || ""), String(data.get("reason") || ""));
      return;
    }

    if (event.target.id === "deadlineForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      const year = Number(data.get("votingYear"));
      const monthNumber = Number(data.get("votingMonth"));
      const value = String(data.get("deadlineInput") || "");
      const deadline = value ? new Date(value) : defaultDeadlineFor(year, monthNumber);
      await saveVotingWindow(year, monthNumber, deadline);
      toast(`${MONTHS[monthNumber - 1]} voting window saved.`, "success");
      draw();
      return;
    }

    if (event.target.id === "alertForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      await addAlert(String(data.get("alertStudent") || ""), String(data.get("alertSeverity") || "info"), String(data.get("alertNote") || ""));
      event.target.reset();
      return;
    }

    if (event.target.id === "printFilterForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      sessionStorage.setItem("scls-sotm-print-year", String(Number(data.get("printYear"))));
      sessionStorage.setItem("scls-sotm-print-month", String(Number(data.get("printMonth"))));
      draw();
      return;
    }

    if (event.target.id === "winnerEditForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      await updateWinner(data);
      return;
    }

    if (event.target.id === "nominationEditForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      await updateNomination(data);
      return;
    }

    if (event.target.id === "winnerForm") {
      event.preventDefault();
      const data = new FormData(event.target);
      await recordWinners(data);
      return;
    }
  }

  async function submitNomination(studentName, reason) {
    const student = findStudentByName(studentName);
    reason = reason.trim();

    if (!student) return toast("Student name must match one of the Grade 6 students.", "warning");
    if (reason.length < 12) return toast("Add a more specific nomination reason before submitting.", "warning");

    const existing = activeNominationForStudent(student.id);
    const won = winnerForStudent(student.id);

    if (existing) {
      await addReason(existing.id, state.currentTeacher, reason);
      if (!teacherMatches(existing.original_teacher, state.currentTeacher)) {
        await setReaction(existing.id, 1, { silent: true });
      }
      toast(`${student.full_name} was already on the nomination list. Your reason was added and your vote was recorded once.`, won ? "warning" : "success");
      go("home");
      await reloadIfLive();
      draw();
      return;
    }

    const targetWindow = getNominationTargetWindow();
    const nomination = {
      id: uid("nom"),
      student_id: student.id,
      original_teacher: state.currentTeacher,
      original_reason: reason,
      first_month_name: targetWindow.monthName,
      first_month_number: targetWindow.monthNumber,
      first_year: targetWindow.year,
      status: won ? "closed" : "active"
    };

    if (usingSupabase) {
      const { data, error } = await sb.from("nominations").insert({
        student_id: nomination.student_id,
        original_teacher: nomination.original_teacher,
        original_reason: nomination.original_reason,
        first_month_name: nomination.first_month_name,
        first_month_number: nomination.first_month_number,
        first_year: nomination.first_year,
        status: nomination.status
      }).select().single();
      if (error) return toast(error.message, "warning");
      nomination.id = data.id;
    } else {
      state.nominations.push(nomination);
    }

    await addReason(nomination.id, state.currentTeacher, reason, { silent: true });

    toast(`${student.full_name} has been nominated for ${nomination.first_month_name} ${nomination.first_year}.${won ? " This student has already won, so the nomination is stored but not shown in the active list." : ""}`, won ? "warning" : "success");
    go("home");
    await reloadIfLive();
    saveLocal();
    draw();
  }

  async function setReaction(nominationId, reaction, opts = {}) {
    const nom = state.nominations.find(n => String(n.id) === String(nominationId));
    if (!nom) return;
    if (teacherMatches(nom.original_teacher, state.currentTeacher)) {
      return toast("The original nomination already counts as that teacher's support.", "warning");
    }

    const existing = state.reactions.find(r => String(r.nomination_id) === String(nominationId) && teacherMatches(r.teacher_name, state.currentTeacher));

    if (usingSupabase) {
      if (existing) {
        const { error } = await sb.from("nomination_reactions")
          .update({ reaction, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) return toast(error.message, "warning");
      } else {
        const { error } = await sb.from("nomination_reactions").insert({
          nomination_id: nominationId,
          teacher_name: state.currentTeacher,
          reaction
        });
        if (error) return toast(error.message, "warning");
      }
      await reloadIfLive();
    } else {
      if (existing) {
        existing.reaction = reaction;
        existing.updated_at = new Date().toISOString();
      } else {
        state.reactions.push({
          id: uid("rx"),
          nomination_id: nominationId,
          teacher_name: state.currentTeacher,
          reaction,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      saveLocal();
    }

    if (!opts.silent) toast(reaction === 1 ? "Upvote recorded." : "Downvote recorded.", "success");
    draw();
  }

  async function addReason(nominationId, teacherName, reason, opts = {}) {
    const entry = {
      id: uid("reason"),
      nomination_id: nominationId,
      teacher_name: teacherName,
      reason: reason.trim(),
      created_at: new Date().toISOString()
    };

    if (usingSupabase) {
      const { error } = await sb.from("nomination_reasons").insert({
        nomination_id: nominationId,
        teacher_name: teacherName,
        reason: entry.reason
      });
      if (error) return toast(error.message, "warning");
    } else {
      state.reasons.push(entry);
      saveLocal();
    }
    if (!opts.silent) toast("Reason added.", "success");
  }

  async function addAlert(studentName, severity, note) {
    const student = findStudentByName(studentName);
    note = note.trim();
    if (!student) return toast("Student name must match the Grade 6 list.", "warning");
    if (note.length < 5) return toast("Add a useful alert note.", "warning");

    const alert = {
      id: uid("alert"),
      student_id: student.id,
      severity,
      note,
      active: true,
      created_by: state.currentTeacher,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (usingSupabase) {
      const { error } = await sb.from("student_alerts").insert({
        student_id: alert.student_id,
        severity: alert.severity,
        note: alert.note,
        active: true,
        created_by: state.currentTeacher
      });
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      state.alerts.unshift(alert);
      saveLocal();
    }

    toast(`Alert note added for ${student.full_name}.`, "success");
    draw();
  }

  async function deactivateAlert(alertId) {
    if (usingSupabase) {
      const { error } = await sb.from("student_alerts").update({ active: false, updated_at: new Date().toISOString() }).eq("id", alertId);
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      const alert = state.alerts.find(a => String(a.id) === String(alertId));
      if (alert) alert.active = false;
      saveLocal();
    }
    toast("Alert note deactivated.", "success");
    draw();
  }

  async function saveSetting(key, value) {
    const row = { key, value, updated_by: state.currentTeacher, updated_at: new Date().toISOString() };
    if (usingSupabase) {
      const { error } = await sb.from("settings").upsert(row, { onConflict: "key" });
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      const existing = state.settings.find(s => s.key === key);
      if (existing) Object.assign(existing, row);
      else state.settings.push(row);
      saveLocal();
    }
  }

  async function recordWinners(formData) {
    const year = Number(formData.get("winnerYear"));
    const monthNumber = Number(formData.get("winnerMonth"));
    const monthName = MONTHS[monthNumber - 1];
    const names = ["winner1", "winner2", "winner3", "winner4"].map(k => String(formData.get(k) || "").trim()).filter(Boolean);

    if (names.length !== 4) return toast("Record exactly four winners: two girls and two boys.", "warning");

    const students = names.map(findStudentByName);
    if (students.some(s => !s)) return toast("Every winner name must match the Grade 6 student list.", "warning");
    if (new Set(students.map(s => String(s.id))).size !== 4) return toast("The four winner names must be four different students.", "warning");

    const firstTwoGirls = students.slice(0, 2).every(s => s.gender === "girl");
    const lastTwoBoys = students.slice(2).every(s => s.gender === "boy");
    if (!firstTwoGirls || !lastTwoBoys) return toast("Use the first two boxes for girls and the last two boxes for boys.", "warning");

    const rows = students.map((student, index) => ({
      id: uid("win"),
      award_year: year,
      month_number: monthNumber,
      month_name: monthName,
      student_id: student.id,
      slot: index < 2 ? "girl" : "boy",
      recorded_by: state.currentTeacher,
      created_at: new Date().toISOString()
    }));

    const winnerStudentIds = students.map(s => s.id);
    const activeWindowBeforeSave = getVotingWindow();
    const shouldAdvanceWindow = Number(activeWindowBeforeSave.year) === year && Number(activeWindowBeforeSave.monthNumber) === monthNumber;
    const nextWindow = shouldAdvanceWindow ? nextVotingWindow(activeWindowBeforeSave) : null;

    if (usingSupabase) {
      const del = await sb.from("winners").delete().eq("award_year", year).eq("month_number", monthNumber);
      if (del.error) return toast(del.error.message, "warning");
      const { error } = await sb.from("winners").insert(rows.map(({ id, created_at, ...r }) => r));
      if (error) return toast(error.message, "warning");
      const close = await sb.from("nominations").update({ status: "closed", updated_at: new Date().toISOString() }).in("student_id", winnerStudentIds).eq("status", "active");
      if (close.error) return toast(close.error.message, "warning");
      if (shouldAdvanceWindow) {
        await saveVotingWindow(nextWindow.year, nextWindow.monthNumber, nextWindow.deadline);
      } else {
        await reloadIfLive();
      }
    } else {
      state.winners = state.winners.filter(w => !(Number(w.award_year) === year && Number(w.month_number) === monthNumber));
      state.winners.push(...rows);
      state.nominations.forEach(n => {
        if (winnerStudentIds.some(id => String(id) === String(n.student_id)) && n.status === "active") n.status = "closed";
      });
      if (shouldAdvanceWindow) {
        const value = {
          year: nextWindow.year,
          monthNumber: nextWindow.monthNumber,
          monthName: nextWindow.monthName,
          deadlineIso: nextWindow.deadline.toISOString()
        };
        const existing = state.settings.find(s => s.key === "voting_window");
        if (existing) Object.assign(existing, { value, updated_by: state.currentTeacher, updated_at: new Date().toISOString() });
        else state.settings.push({ key: "voting_window", value, updated_by: state.currentTeacher, updated_at: new Date().toISOString() });
      }
      saveLocal();
    }

    sessionStorage.setItem("scls-sotm-print-year", String(year));
    sessionStorage.setItem("scls-sotm-print-month", String(monthNumber));
    const advanceNote = shouldAdvanceWindow ? ` Voting window moved to ${nextWindow.monthName} ${nextWindow.year}.` : "";
    toast(`${monthName} winners recorded and removed from the active nomination list.${advanceNote}`, "success");
    state.route = "admin";
    location.hash = "admin";
    draw();
  }

  async function updateWinner(formData) {
    const winnerId = String(formData.get("winnerId") || "");
    const year = Number(formData.get("editWinnerYear"));
    const monthNumber = Number(formData.get("editWinnerMonth"));
    const monthName = MONTHS[monthNumber - 1];
    const student = findStudentByName(String(formData.get("editWinnerStudent") || ""));
    const slot = String(formData.get("editWinnerSlot") || "");

    if (!winnerId) return toast("Missing winner id.", "warning");
    if (!student) return toast("Winner student name must match the Grade 6 list.", "warning");
    if (!["girl", "boy"].includes(slot)) return toast("Select Girl or Boy slot.", "warning");

    const patch = { award_year: year, month_number: monthNumber, month_name: monthName, student_id: student.id, slot, recorded_by: state.currentTeacher };

    if (usingSupabase) {
      const { error } = await sb.from("winners").update(patch).eq("id", winnerId);
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      const row = state.winners.find(w => String(w.id) === winnerId);
      if (row) Object.assign(row, patch);
      saveLocal();
    }

    toast("Winner updated.", "success");
    draw();
  }

  async function deleteWinner(winnerId) {
    if (usingSupabase) {
      const { error } = await sb.from("winners").delete().eq("id", winnerId);
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      state.winners = state.winners.filter(w => String(w.id) !== String(winnerId));
      saveLocal();
    }
    toast("Winner deleted.", "success");
    draw();
  }

  async function updateNomination(formData) {
    const nominationId = String(formData.get("nominationId") || "");
    const student = findStudentByName(String(formData.get("editNominationStudent") || ""));
    const originalTeacher = String(formData.get("editNominationTeacher") || "").trim();
    const originalReason = String(formData.get("editNominationReason") || "").trim();
    const firstMonthNumber = Number(formData.get("editNominationMonth"));
    const firstMonthName = MONTHS[firstMonthNumber - 1];
    const firstYear = Number(formData.get("editNominationYear"));
    const status = String(formData.get("editNominationStatus") || "active");

    if (!nominationId) return toast("Missing nomination id.", "warning");
    if (!student) return toast("Nomination student name must match the Grade 6 list.", "warning");
    if (!originalTeacher) return toast("Original teacher is required.", "warning");
    if (originalReason.length < 5) return toast("Nomination reason is too short.", "warning");
    if (!["active", "closed", "withdrawn"].includes(status)) return toast("Invalid nomination status.", "warning");

    const patch = {
      student_id: student.id,
      original_teacher: originalTeacher,
      original_reason: originalReason,
      first_month_name: firstMonthName,
      first_month_number: firstMonthNumber,
      first_year: firstYear,
      status
    };

    if (usingSupabase) {
      const { error } = await sb.from("nominations").update(patch).eq("id", nominationId);
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      const row = state.nominations.find(n => String(n.id) === nominationId);
      if (row) Object.assign(row, patch, { updated_at: new Date().toISOString() });
      saveLocal();
    }

    toast("Nomination updated.", "success");
    draw();
  }

  async function deleteNomination(nominationId) {
    if (usingSupabase) {
      const { error } = await sb.from("nominations").delete().eq("id", nominationId);
      if (error) return toast(error.message, "warning");
      await reloadIfLive();
    } else {
      state.nominations = state.nominations.filter(n => String(n.id) !== String(nominationId));
      state.reasons = state.reasons.filter(r => String(r.nomination_id) !== String(nominationId));
      state.reactions = state.reactions.filter(r => String(r.nomination_id) !== String(nominationId));
      saveLocal();
    }
    toast("Nomination deleted.", "success");
    draw();
  }

  async function reloadIfLive() {
    if (!usingSupabase) return;
    await loadAll();
  }

  function activeNominationsSorted() {
    return state.nominations
      .filter(n => n.status === "active")
      .map(n => ({ nom: n, stats: nominationStats(n.id), student: studentById(n.student_id) }))
      .filter(x => x.student && !winnerForStudent(x.student.id))
      .sort((a, b) => b.stats.score - a.stats.score || a.student.full_name.localeCompare(b.student.full_name))
      .map(x => x.nom);
  }

  function candidateLeaders(gender) {
    return activeNominationsSorted()
      .map(nom => {
        const student = studentById(nom.student_id);
        const stats = nominationStats(nom.id);
        return { nomination: nom, student, ...stats };
      })
      .filter(x => x.student?.gender === gender)
      .sort((a, b) => b.score - a.score || b.up - a.up || a.student.full_name.localeCompare(b.student.full_name));
  }

  function nominationStats(nominationId) {
    const nom = state.nominations.find(n => String(n.id) === String(nominationId));
    const reactions = state.reactions.filter(r => String(r.nomination_id) === String(nominationId));
    const up = 1 + reactions.filter(r => Number(r.reaction) === 1).length;
    const down = reactions.filter(r => Number(r.reaction) === -1).length;
    const totalTeachers = 1 + new Set(reactions.map(r => teacherKey(r.teacher_name))).size;
    return { up, down, score: up - down, totalTeachers };
  }

  function groupWinnersByMonth() {
    const map = new Map();
    for (const w of state.winners) {
      const key = `${String(w.award_year).padStart(4, "0")}-${String(w.month_number).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { award_year: w.award_year, month_number: w.month_number, month_name: w.month_name, items: [] });
      map.get(key).items.push(w);
    }
    return [...map.values()].sort((a, b) => {
      const av = Number(a.award_year) * 100 + Number(a.month_number);
      const bv = Number(b.award_year) * 100 + Number(b.month_number);
      return bv - av;
    });
  }

  function studentById(id) {
    return state.students.find(s => String(s.id) === String(id));
  }

  function findStudentByName(name) {
    const key = normalizeName(name);
    return state.students.find(s => normalizeName(s.full_name) === key);
  }

  function activeNominationForStudent(studentId) {
    return state.nominations.find(n => String(n.student_id) === String(studentId) && n.status === "active");
  }

  function winnerForStudent(studentId) {
    return state.winners
      .filter(w => String(w.student_id) === String(studentId))
      .sort((a, b) => (Number(b.award_year) * 100 + Number(b.month_number)) - (Number(a.award_year) * 100 + Number(a.month_number)))[0];
  }

  function alertsForStudent(studentId) {
    return state.alerts.filter(a => String(a.student_id) === String(studentId) && a.active !== false);
  }

  function getSetting(key) {
    return state.settings.find(s => s.key === key)?.value;
  }

  function defaultDeadlineFor(year, monthNumber) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(monthNumber) || (new Date().getMonth() + 1);
    return new Date(y, m, 0, 16, 0, 0);
  }

  function getVotingWindow() {
    const now = new Date();
    const saved = getSetting("voting_window") || {};
    const fallbackDeadline = getSetting("countdown_deadline")?.iso;
    const monthNumber = Number(saved.monthNumber) || now.getMonth() + 1;
    const year = Number(saved.year) || now.getFullYear();
    const monthName = MONTHS[monthNumber - 1] || MONTHS[now.getMonth()];
    const iso = saved.deadlineIso || saved.iso || fallbackDeadline;
    const parsed = iso ? new Date(iso) : null;
    const deadline = parsed && !Number.isNaN(parsed.getTime()) ? parsed : defaultDeadlineFor(year, monthNumber);
    const windowInfo = { year, monthNumber, monthName, deadline };
    const hasFullWinnerSet = state.winners.filter(w => Number(w.award_year) === year && Number(w.month_number) === monthNumber).length >= 4;
    if (deadline.getTime() <= Date.now() && hasFullWinnerSet) {
      return nextVotingWindow(windowInfo);
    }
    return windowInfo;
  }

  function nextVotingWindow(windowInfo = getVotingWindow()) {
    let monthNumber = Number(windowInfo.monthNumber) + 1;
    let year = Number(windowInfo.year);
    if (monthNumber > 12) {
      monthNumber = 1;
      year += 1;
    }
    return {
      year,
      monthNumber,
      monthName: MONTHS[monthNumber - 1],
      deadline: defaultDeadlineFor(year, monthNumber)
    };
  }

  function isVotingClosed(windowInfo = getVotingWindow()) {
    return windowInfo.deadline.getTime() <= Date.now();
  }

  function getNominationTargetWindow() {
    const windowInfo = getVotingWindow();
    return isVotingClosed(windowInfo) ? nextVotingWindow(windowInfo) : windowInfo;
  }

  async function saveVotingWindow(year, monthNumber, deadline) {
    const value = {
      year: Number(year),
      monthNumber: Number(monthNumber),
      monthName: MONTHS[Number(monthNumber) - 1],
      deadlineIso: deadline.toISOString()
    };
    await saveSetting("voting_window", value);
    await saveSetting("countdown_deadline", { iso: value.deadlineIso });
  }

  function getDeadline() {
    return getVotingWindow().deadline;
  }

  function tickCountdown() {
    const node = $("#countdownText");
    if (!node) return;
    const deadline = getDeadline();
    const diff = deadline.getTime() - Date.now();

    if (diff <= 0) {
      node.textContent = "Voting closed";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    node.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  function isAdmin() {
    return teacherMatches(state.currentTeacher, ADMIN_NAME) || state.teachers.some(t => teacherMatches(t.name, state.currentTeacher) && t.is_admin);
  }

  function teacherMatches(a, b) {
    const ak = teacherKey(a);
    const bk = teacherKey(b);
    if (ak === bk) return true;
    if (ak.includes("keagan") && ak.includes("appel") && bk.includes("keagan") && bk.includes("appel")) return true;
    return false;
  }

  function teacherKey(name) {
    return String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function normalizeName(name) {
    return String(name || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function sameText(a, b) {
    return normalizeName(a).slice(0, 160) === normalizeName(b).slice(0, 160);
  }

  function avatar(name, sizeClass = "w-12 h-12") {
    const initials = String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("") || "?";
    return `<div class="${sizeClass} name-initials rounded-full border-2 border-yellow-500/50 flex-shrink-0 grid place-items-center text-black font-headline-md font-bold">${escapeHtml(initials)}</div>`;
  }

  function warningBlock(text, severity = "warning") {
    const cls = severity === "serious"
      ? "bg-red-500/10 border-red-400/30 text-red-100"
      : severity === "info"
        ? "bg-blue-500/10 border-blue-400/30 text-blue-100"
        : "bg-yellow-500/10 border-yellow-400/30 text-yellow-100";
    return `
      <div class="rounded-lg border ${cls} px-3 py-2 mb-3 text-sm flex gap-2 items-start">
        <span class="material-symbols-outlined text-base mt-0.5">priority_high</span>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  }

  function toast(message, type = "info") {
    const host = $("#toastHost");
    const cls = type === "success"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
      : type === "warning"
        ? "border-yellow-400/30 bg-yellow-500/15 text-yellow-100"
        : "border-blue-400/30 bg-blue-500/15 text-blue-100";
    const el = document.createElement("div");
    el.className = `glass-panel rounded-xl border ${cls} p-4 shadow-xl`;
    el.innerHTML = `<p class="text-sm">${escapeHtml(message)}</p>`;
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      el.style.transition = "all .25s ease";
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function cap(value) {
    value = String(value || "");
    return value ? value[0].toUpperCase() + value.slice(1) : "";
  }

  function shortLabel(label) {
    return label === "Hall of Fame" ? "Hall" : label;
  }

  function toLocalDatetimeValue(date) {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
})();
