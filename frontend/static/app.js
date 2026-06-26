const state = { user: null, view: "dashboard", equipment: [], bookings: [], returns: [] };
const $ = (selector) => document.querySelector(selector);
const portalMode = document.body.dataset.portalMode === "admin" ? "admin" : "user";
const portalPaths = { admin: "/admin", user: "/user" };
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const dateText = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const pretty = (value) => String(value || "").replaceAll("_", " ");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const menus = {
  user: [
    ["dashboard", "home", "Home"], ["book", "search", "Equipment"], ["return", "rotate-ccw", "Return Request"],
    ["rentals", "clock-3", "My Rentals"], ["settlements", "receipt", "Settlements"], ["profile", "user-round", "Profile"]
  ],
  admin: [
    ["dashboard", "layout-dashboard", "Dashboard"], ["equipment", "package", "Equipment Management"], ["categories", "tags", "Categories"],
    ["bookings", "calendar-check", "Bookings"], ["customers", "users", "Customers"], ["returns", "rotate-ccw", "Return Requests"],
    ["damages", "shield-alert", "Damage Reports"], ["payments", "credit-card", "Payments"], ["reports", "bar-chart-3", "Reports"],
    ["settings", "settings", "Settings"], ["profile", "user-round", "Profile"]
  ]
};

const titles = {
  dashboard: ["DASHBOARD", "Dashboard", "A live view of your rental operations."], book: ["EQUIPMENT CATALOGUE", "Equipment", "Search, filter, and book available rental gear."],
  return: ["RETURN CENTRE", "Return Equipment", "Request a return for an active rental."], rentals: ["RENTAL HISTORY", "My Rentals", "Track every booking from request to return."],
  settlements: ["REFUND STATEMENTS", "Settlements", "Review deposits, rental charges, damage deductions, and refund balances."],
  profile: ["ACCOUNT", "Profile", "Review and update your personal details."], equipment: ["ADMIN INVENTORY", "Equipment Management", "Add equipment and control stock availability."],
  categories: ["ADMIN CATEGORIES", "Categories", "Organize equipment groups, availability, and category performance."], bookings: ["ADMIN BOOKINGS", "Bookings", "Approve requests, track dues, and manage payment status."],
  customers: ["ADMIN CUSTOMERS", "Customers", "View customer accounts and rental activity."], returns: ["ADMIN RETURNS", "Return Requests", "Inspect incoming equipment and complete returns."],
  damages: ["ADMIN CLAIMS", "Damage Reports", "Review damaged or lost equipment cases."], deductions: ["ADMIN FINANCE", "Deposit Deduction", "Approve or reject proposed deposit deductions."],
  payments: ["ADMIN PAYMENTS", "Payments", "Review deposits, deductions, refunds, and claim decisions."], statuses: ["ADMIN WORKFLOW", "Status Updates", "Update booking and return workflow states."],
  reports: ["ADMIN ANALYTICS", "Reports", "Review operational and financial totals."], settings: ["ADMIN SETTINGS", "Settings", "Manage company details, notifications, and workspace preferences."]
};

const iconPaths = {
  home: `<path d="m3 11 9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>`,
  search: `<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>`,
  "rotate-ccw": `<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path>`,
  "clock-3": `<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6h4"></path>`,
  receipt: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><path d="M8 7h8"></path><path d="M8 12h8"></path><path d="M8 17h5"></path>`,
  "user-round": `<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path>`,
  "layout-dashboard": `<rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect>`,
  package: `<path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>`,
  tags: `<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"></path><circle cx="7.5" cy="7.5" r=".7" fill="currentColor" stroke="none"></circle>`,
  "calendar-check": `<path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="m9 16 2 2 4-4"></path>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`,
  "shield-alert": `<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.4a1.4 1.4 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path>`,
  "credit-card": `<rect width="20" height="14" x="2" y="5" rx="2"></rect><path d="M2 10h20"></path>`,
  "bar-chart-3": `<path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path>`,
  settings: `<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.3a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.3a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.3a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.3a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"></path><circle cx="12" cy="12" r="3"></circle>`
};

function iconSvg(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || iconPaths.home}</svg>`;
}

function redirectToPortal(role) {
  const target = portalPaths[role] || portalPaths.user;
  if (window.location.pathname !== target) {
    window.location.replace(target);
    return true;
  }
  return false;
}

function applyPortalMode() {
  const isAdminPortal = portalMode === "admin";
  document.title = isAdminPortal ? "Admin Panel | Equipment Return & Damage Tracker" : "User Panel | Equipment Return & Damage Tracker";
  $("#brandSubtitle").textContent = isAdminPortal ? "Admin operations panel" : "Customer rental portal";
  $("#loginEyebrow").textContent = isAdminPortal ? "ADMIN OPERATIONS" : "RENTAL MANAGEMENT";
  $("#loginHeadline").textContent = isAdminPortal
    ? "Admin panel for inventory, returns, and claims."
    : "User panel for bookings, rentals, and returns.";
  $("#loginDescription").textContent = isAdminPortal
    ? "Sign in with your administrator account to manage equipment, customers, inspections, deductions, and reports."
    : "Sign in to book equipment, track rental status, request returns, and manage your customer account.";
  $("#featureOneTitle").textContent = isAdminPortal ? "Inventory and customer control" : "Book and manage rentals";
  $("#featureOneCopy").textContent = isAdminPortal
    ? "Review equipment availability, customer activity, and booking queues in one workspace."
    : "Browse available gear, place rental requests, and follow approval status.";
  $("#featureTwoTitle").textContent = isAdminPortal ? "Returns, claims, and reports" : "Returns and account access";
  $("#featureTwoCopy").textContent = isAdminPortal
    ? "Handle inspections, damage claims, deposit deductions, and reporting from the admin side."
    : "Request returns, review rental history, reset passwords, and update profile details.";
  $("#accessEyebrow").textContent = isAdminPortal ? "ADMIN ACCESS" : "USER ACCESS";
  $("#loginIdentifierText").textContent = isAdminPortal ? "Admin email address" : "Email or Phone number";
  $("#loginIdentifierInput").type = isAdminPortal ? "email" : "text";
  $("#loginIdentifierInput").placeholder = isAdminPortal ? "admin@sd-digitals.com" : "name@example.com or +91 00000 00000";
  $("#loginIdentifierInput").autocomplete = isAdminPortal ? "email" : "off";
  $("#showRegister")?.classList.toggle("hidden", isAdminPortal);
}

function toast(message, error = false) {
  const el = $("#toast"); el.textContent = message; el.className = `toast show${error ? " error" : ""}`;
  setTimeout(() => el.className = "toast", 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  let data = {}; try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.details?.join?.(", ") || data.error || "Request failed");
  return data;
}

function badge(value) { return `<span class="badge ${value}">${escapeHtml(pretty(value))}</span>`; }
function table(headers, rows, empty = "No records found") {
  return `<div class="panel"><div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>${rows.length ? "" : `<div class="empty">${empty}</div>`}</div></div>`;
}
function cards(items) { return `<div class="summary-grid">${items.map((x,i) => `<article class="summary-card"><span class="summary-icon ${x[2] || ""}">${String(i+1).padStart(2,"0")}</span><div><small>${x[0]}</small><strong>${x[1]}</strong></div></article>`).join("")}</div>`; }
function hero(title, subtitle, actions = []) {
  return `<section class="hero-panel"><div><p class="eyebrow">SD DIGITALS CONTROL CENTER</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><div class="hero-actions">${actions.map(a => `<button class="${a[2] || "primary"}" data-jump="${a[1]}">${escapeHtml(a[0])}</button>`).join("")}</div></section>`;
}
function wireJumps() {
  document.querySelectorAll("[data-jump]").forEach(button => button.onclick = () => loadView(button.dataset.jump));
}

function openModal(html) { $("#modalContent").innerHTML = `<div class="modal-body">${html}</div>`; $("#modal").showModal(); document.querySelectorAll(".modal-close").forEach(b => b.onclick = () => $("#modal").close()); }
function modalHead(title, subtitle = "") { return `<div class="modal-head"><div><h2>${title}</h2>${subtitle ? `<p class="muted">${subtitle}</p>` : ""}</div><button type="button" class="modal-close">x</button></div>`; }
function settlementStatus(record, booking) {
  if (record?.return_request_status === "processed") return record.status === "closed" ? "settled" : record.status;
  if (record) return "inspection";
  if (booking.status === "returned") return "settlement_pending";
  return booking.status;
}
function settlementValue(value) {
  return value === null || value === undefined ? "-" : money(value);
}
function settlementNotice(record) {
  if (!record) return "Return settlement will appear here after the return request is submitted and inspected.";
  if (record.return_request_status !== "processed") return "Return received. Inspection is pending, so refund amount is not final yet.";
  if ((record.deposit_deduction || 0) > 0) return `Damage or repair deduction applied: ${money(record.deposit_deduction)}. Refund balance: ${money(record.balance_refund)}.`;
  return `No damage deduction applied. Refund balance: ${money(record.balance_refund)}.`;
}
function showSettlement(bookingId) {
  const booking = state.bookings.find(x => x.id === bookingId);
  const record = state.returns.find(x => x.booking_id === bookingId);
  if (!booking) return;
  const days = record?.booking_days ?? booking.days;
  const rentalAmount = record?.rental_amount ?? booking.total_amount;
  const deposit = record?.deposit_amount ?? booking.deposit_amount;
  const deduction = record?.deposit_deduction ?? null;
  const refund = record?.balance_refund ?? null;
  openModal(`${modalHead("Return settlement statement", `${escapeHtml(booking.equipment_name)} / Booking #${booking.id}`)}
    <div class="settlement-statement">
      <div class="detail-grid">
        <div><small>Rental period</small><b>${dateText(booking.start_date)} - ${dateText(booking.end_date)}</b></div>
        <div><small>Duration</small><b>${days} day(s)</b></div>
        <div><small>Status</small>${badge(settlementStatus(record, booking))}</div>
      </div>
      <div class="notice"><b>Customer settlement</b><br>${escapeHtml(settlementNotice(record))}</div>
      <div class="settlement-lines">
        <div class="metric-line"><span>Rental amount for ${days} day(s)</span><b>${money(rentalAmount)}</b></div>
        <div class="metric-line"><span>Security deposit paid</span><b>${money(deposit)}</b></div>
        <div class="metric-line"><span>Damage / repair deduction</span><b>${settlementValue(deduction)}</b></div>
        <div class="metric-line settlement-refund"><span>Refund balance</span><b>${settlementValue(refund)}</b></div>
      </div>
      ${record?.condition ? `<div class="detail-grid"><div><small>Returned condition</small><b>${escapeHtml(pretty(record.condition))}</b></div><div><small>Return date</small><b>${dateText(record.actual_return_date || record.return_due_date)}</b></div></div>` : ""}
      ${record?.damage_remarks ? `<div class="notice"><b>Damage remarks</b><br>${escapeHtml(record.damage_remarks)}</div>` : ""}
      <div class="form-actions"><button type="button" class="primary modal-close">Close statement</button></div>
    </div>`);
}
function settlementTable(bookings, returns, empty = "No return settlements yet.") {
  const returnsByBooking = new Map(returns.filter(r => r.booking_id).map(r => [r.booking_id, r]));
  const rows = bookings.map(b => {
    const record = returnsByBooking.get(b.id);
    const deduction = record ? money(record.deposit_deduction || 0) : "-";
    const refund = record?.return_request_status === "processed" ? money(record.balance_refund) : "-";
    const status = record ? settlementStatus(record, b) : (b.is_overdue ? "overdue" : b.status);
    const action = record ? `<button class="small-btn" data-settlement="${b.id}">View statement</button>` : "-";
    return `<tr><td>#${b.id}</td><td><strong>${escapeHtml(b.equipment_name)}</strong><small>${escapeHtml(b.equipment_code)}</small></td><td>${dateText(b.start_date)} - ${dateText(b.end_date)}<small>${b.days} day(s)</small></td><td>${money(b.total_amount)}</td><td>${money(b.deposit_amount)}</td><td>${deduction}</td><td><strong>${refund}</strong></td><td>${badge(status)}</td><td>${action}</td></tr>`;
  });
  return table(["Booking","Equipment","Rental period","Rent amount","Deposit","Damage cut","Refund","Status","Statement"], rows, empty);
}
function wireSettlementButtons() {
  document.querySelectorAll("[data-settlement]").forEach(b => b.onclick = () => showSettlement(Number(b.dataset.settlement)));
}

async function boot() {
  applyPortalMode();
  try {
    state.user = (await api("/api/auth/me")).user;
    if (redirectToPortal(state.user.role)) return;
    showApp();
  } catch (_) {
    clearAuthForms();
    $("#loginPage").classList.remove("hidden");
  }
}

function showApp() {
  $("#loginPage").classList.add("hidden"); $("#appShell").classList.remove("hidden");
  const bg = $("#webgl-background"); if (bg) bg.classList.add("hidden");
  document.body.classList.add("app-active");
  startAntigravity();
  $("#portalName").textContent = state.user.role === "admin" ? "Admin operations" : "Customer rental portal";
  $("#sidebarName").textContent = state.user.name; $("#sidebarRole").textContent = state.user.role === "admin" ? "Administrator" : "Customer";
  $("#userInitials").textContent = state.user.name.split(" ").map(x => x[0]).slice(0,2).join("").toUpperCase();
  $("#navigation").innerHTML = menus[state.user.role].map(item => `<button class="nav-item" data-view="${item[0]}"><span class="nav-icon">${iconSvg(item[1])}</span><span>${item[2]}</span></button>`).join("");
  document.querySelectorAll(".nav-item").forEach(button => button.onclick = () => loadView(button.dataset.view));
  loadView("dashboard");
}

async function loadView(view) {
  state.view = view; const info = titles[view];
  $("#pageEyebrow").textContent = info[0]; $("#pageTitle").textContent = info[1]; $("#pageSubtitle").textContent = info[2]; $("#headerAction").innerHTML = "";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("#pageContent").innerHTML = `<div class="loading">Loading ${info[1].toLowerCase()}...</div>`;
  try { await renderers[view](); wireJumps(); } catch (error) { $("#pageContent").innerHTML = `<div class="panel empty">${escapeHtml(error.message)}</div>`; toast(error.message, true); }
}

const renderers = {
  async dashboard() {
    const data = await api("/api/dashboard");
    if (state.user.role === "user") {
      const rows = data.recent.map(b => `<tr><td><strong>${escapeHtml(b.equipment_name)}</strong><small>${escapeHtml(b.equipment_code)}</small></td><td>${dateText(b.start_date)} - ${dateText(b.end_date)}</td><td>${money(b.total_amount)}</td><td>${badge(b.is_overdue ? "overdue" : b.status)}</td></tr>`);
      const settlements = await api("/api/returns");
      const latestSettlement = settlements.find(r => r.return_request_status === "processed") || settlements[0];
      const settlementPanel = latestSettlement
        ? `<aside class="panel side-panel"><h3>Latest settlement</h3><div class="metric-line"><span>Equipment</span><b>${escapeHtml(latestSettlement.equipment_name)}</b></div><div class="metric-line"><span>Rental amount</span><b>${settlementValue(latestSettlement.rental_amount)}</b></div><div class="metric-line"><span>Deposit paid</span><b>${money(latestSettlement.deposit_amount)}</b></div><div class="metric-line"><span>Damage cut</span><b>${money(latestSettlement.deposit_deduction || 0)}</b></div><div class="metric-line settlement-refund"><span>Refund balance</span><b>${latestSettlement.return_request_status === "processed" ? money(latestSettlement.balance_refund) : "-"}</b></div><button class="small-btn" data-jump="settlements" type="button">View all settlements</button></aside>`
        : `<aside class="panel side-panel"><h3>Settlement updates</h3><p class="muted">After a return is inspected, your deposit, damage deduction, and refund details will appear here.</p><button class="small-btn" data-jump="return" type="button">Request return</button></aside>`;
      $("#pageContent").innerHTML = hero(`Welcome, ${state.user.name}`, "Book camera gear, track rental status, and review return settlements from one clean workspace.", [["Book equipment","book"],["Settlements","settlements","ghost"]]) + cards([["Total rentals",data.total_rentals],["Active",data.active,"green"],["Pending",data.pending,"amber"],["Returned",data.returned]]) + `<div class="content-grid">${table(["Equipment","Rental period","Amount","Status"], rows, "You have no rentals yet.")}${settlementPanel}</div>`;
    } else {
      const rows = data.recent.map(r => `<tr><td><strong>${escapeHtml(r.equipment_name)}</strong><small>${escapeHtml(r.equipment_code)}</small></td><td>${escapeHtml(r.customer_name)}</td><td>${dateText(r.return_due_date)}</td><td>${badge(r.is_overdue ? "overdue" : r.status)}</td></tr>`);
      $("#pageContent").innerHTML = hero("Admin operations workspace", "Monitor inventory, customers, returns, claims, deposit deductions, and reports with a polished control panel.", [["Manage equipment","equipment"],["Reports","reports","ghost"]]) + cards([["Equipment",data.equipment],["Customers",data.customers],["Pending bookings",data.pending_bookings,"amber"],["Open claims",data.claims,"red"]]) + `<div class="content-grid">${table(["Equipment","Customer","Due date","Status"],rows,"No return activity yet.")}<aside class="panel side-panel"><h3>Financial snapshot</h3><div class="metric-line"><span>Repair exposure</span><b>${money(data.repair_cost)}</b></div><div class="metric-line"><span>Deposit deductions</span><b>${money(data.deductions)}</b></div><div class="metric-line"><span>Available units</span><b>${data.available}</b></div><div class="metric-line"><span>Overdue returns</span><b>${data.overdue}</b></div></aside></div>`;
    }
  },
  async book() {
    state.equipment = await api("/api/equipment");
    const available = state.equipment.filter(e => e.status === "available" && e.stock_available > 0);
    const cardFor = e => `<article class="equipment-card">${catalogueEquipmentVisual(e)}<small class="muted">${escapeHtml(e.category)} / ${escapeHtml(e.code)}</small><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.description)}</p><div class="equipment-meta"><span>Daily rate<b>${money(e.daily_rate)}</b></span><span>Deposit<b>${money(e.deposit_amount)}</b></span><span>Available<b>${e.stock_available}</b></span></div><button class="primary" data-book="${e.id}">Book now</button></article>`;
    $("#pageContent").innerHTML = hero("Find production-ready equipment", "Browse featured equipment, then submit a clean booking request with deposit details.", [["My rentals","rentals"],["Return request","return","ghost"]]) + `
      <section class="catalogue-toolbar">
        <label>Search<input id="equipmentSearch" placeholder="Search cameras, lenses, lights..." autocomplete="off"></label>
      </section>
      <div class="equipment-grid" id="catalogueGrid"></div>`;
    const bindBookButtons = () => document.querySelectorAll("[data-book]").forEach(b => b.onclick = () => showBooking(Number(b.dataset.book)));
    const refreshCatalogue = () => {
      const query = ($("#equipmentSearch")?.value || "").toLowerCase().trim();
      const matches = available.filter(e => {
        const haystack = `${e.name} ${e.category} ${e.code} ${e.description}`.toLowerCase();
        return !query || haystack.includes(query);
      });
      $("#catalogueGrid").innerHTML = matches.map(cardFor).join("") || `<div class="panel empty">No available equipment matches these filters.</div>`;
      bindBookButtons();
    };
    const input = $("#equipmentSearch");
    if (input) input.oninput = refreshCatalogue;
    refreshCatalogue();
  },
  async return() {
    state.bookings = await api("/api/bookings");
    const eligible = state.bookings.filter(b => ["approved","active"].includes(b.status));
    const rows = eligible.map(b => `<tr><td><strong>${escapeHtml(b.equipment_name)}</strong><small>${escapeHtml(b.equipment_code)}</small></td><td>${dateText(b.end_date)}</td><td>${money(b.deposit_amount)}</td><td>${badge(b.status)}</td><td><button class="small-btn" data-return="${b.id}">Request return</button></td></tr>`);
    $("#pageContent").innerHTML = table(["Equipment","Due date","Deposit","Status","Action"],rows,"No active rentals are ready for return.");
    document.querySelectorAll("[data-return]").forEach(b => b.onclick = () => showReturnRequest(Number(b.dataset.return)));
  },
  async rentals() {
    [state.bookings, state.returns] = await Promise.all([api("/api/bookings"), api("/api/returns")]);
    $("#pageContent").innerHTML = hero("My rental statements", "Review rent amount, security deposit, damage deductions, and refund balance after each return is processed.", [["Return equipment","return"],["Book more gear","book","ghost"]]) + settlementTable(state.bookings, state.returns, "No booking history yet.");
    wireSettlementButtons();
  },
  async settlements() {
    [state.bookings, state.returns] = await Promise.all([api("/api/bookings"), api("/api/returns")]);
    const returnedBookingIds = new Set(state.returns.map(r => r.booking_id).filter(Boolean));
    const settlementBookings = state.bookings.filter(b => returnedBookingIds.has(b.id));
    const totalDeposit = state.returns.reduce((sum, r) => sum + (r.deposit_amount || 0), 0);
    const totalDeduction = state.returns.reduce((sum, r) => sum + (r.deposit_deduction || 0), 0);
    const finalRefund = state.returns.filter(r => r.return_request_status === "processed").reduce((sum, r) => sum + (r.balance_refund || 0), 0);
    $("#pageContent").innerHTML = hero("Return settlement centre", "Every completed return shows a clear statement of rent, deposit, damage deduction, and refund balance.", [["My rentals","rentals"],["Return equipment","return","ghost"]]) + cards([["Return records",state.returns.length],["Deposit paid",money(totalDeposit),"green"],["Damage cut",money(totalDeduction),"red"],["Refund ready",money(finalRefund),"green"]]) + settlementTable(settlementBookings, state.returns, "No return settlement records yet.");
    wireSettlementButtons();
  },
  async profile() {
    const p = await api("/api/profile");
    $("#pageContent").innerHTML = `<section class="panel profile-card"><div class="profile-header"><span class="avatar">${escapeHtml(p.name[0])}</span><div><h2>${escapeHtml(p.name)}</h2><small>${escapeHtml(pretty(p.role))} account</small></div></div><form id="profileForm"><div class="form-grid"><label class="field">Full name<input name="name" value="${escapeHtml(p.name)}" required></label><label class="field">Phone number<input name="phone" value="${escapeHtml(p.phone || "")}"></label><label class="field wide">Email address<input value="${escapeHtml(p.email)}" disabled></label></div><div class="form-actions"><button class="primary">Save profile</button></div></form></section>`;
    $("#profileForm").onsubmit = saveProfile;
  },
  async equipment() {
    state.equipment = await api("/api/equipment");
    $("#headerAction").innerHTML = "";
    renderEquipmentManagement();
  },
  async categories() {
    state.equipment = await api("/api/equipment");
    const groups = Object.values(state.equipment.reduce((acc, item) => {
      const key = item.category || "Uncategorized";
      if (!acc[key]) acc[key] = { name: key, total: 0, stock: 0, available: 0, maintenance: 0, value: 0 };
      acc[key].total += 1;
      acc[key].stock += Number(item.stock_total) || 0;
      acc[key].available += Number(item.stock_available) || 0;
      acc[key].maintenance += item.status === "maintenance" ? 1 : 0;
      acc[key].value += (Number(item.daily_rate) || 0) * (Number(item.stock_total) || 0);
      return acc;
    }, {})).sort((a, b) => a.name.localeCompare(b.name));
    const rows = groups.map(g => `<tr><td><strong>${escapeHtml(g.name)}</strong><small>${g.total} equipment type${g.total === 1 ? "" : "s"}</small></td><td>${g.stock}</td><td>${g.available}</td><td>${g.maintenance}</td><td>${money(g.value)}</td><td>${badge(g.available ? "available" : "maintenance")}</td></tr>`);
    $("#pageContent").innerHTML = hero("Category performance", "Track every equipment group with stock, availability, and estimated rental value from one premium workspace.", [["Add equipment","equipment"],["Reports","reports","ghost"]]) + `
      <div class="category-grid">${groups.map(g => `<article class="category-card"><small class="muted">CATEGORY</small><h3>${escapeHtml(g.name)}</h3><strong>${g.available}/${g.stock}</strong><p class="muted">Available stock across ${g.total} item${g.total === 1 ? "" : "s"}.</p></article>`).join("")}</div>
      ${table(["Category","Total stock","Available","Maintenance","Rental value","Status"], rows, "No categories found.")}`;
  },
  async bookings() {
    state.bookings = await api("/api/bookings");
    const rows = state.bookings.map(b => {
      const payment = ["rejected", "cancelled"].includes(b.status) ? "cancelled" : b.status === "pending" ? "pending" : "approved";
      const actions = b.status === "pending"
        ? `<div class="actions"><button class="small-btn" data-booking-decision="${b.id}:approved">Approve</button><button class="small-btn secondary" data-booking-decision="${b.id}:rejected">Reject</button></div>`
        : b.status === "approved" ? `<button class="small-btn" data-booking-decision="${b.id}:active">Mark active</button>` : `<span class="muted">No action</span>`;
      return `<tr><td>#${b.id}</td><td><strong>${escapeHtml(b.customer_name)}</strong><small>${escapeHtml(b.customer_email || "")}</small></td><td><strong>${escapeHtml(b.equipment_name)}</strong><small>${escapeHtml(b.equipment_code)}</small></td><td>${dateText(b.start_date)} - ${dateText(b.end_date)}</td><td>${b.days} day${b.days === 1 ? "" : "s"}</td><td>${money(b.total_amount)}</td><td>${badge(payment)}</td><td>${badge(b.is_overdue ? "overdue" : b.status)}</td><td>${actions}</td></tr>`;
    });
    $("#pageContent").innerHTML = hero("Booking approvals", "Review incoming rentals, approve or reject requests, and keep payment and due-date information visible.", [["Equipment","equipment"],["Customers","customers","ghost"]]) + table(["Booking","Customer","Equipment","Rental period","Duration","Amount","Payment","Status","Action"], rows, "No bookings found.");
    document.querySelectorAll("[data-booking-decision]").forEach(b => b.onclick = () => {
      const [id, status] = b.dataset.bookingDecision.split(":");
      updateBookingStatus(id, status);
    });
  },
  async customers() {
    const customers = await api("/api/customers");
    const rows = customers.map(c => `<tr><td><strong>${escapeHtml(c.name)}</strong><small>Customer #${c.id}</small></td><td>${escapeHtml(c.email)}</td><td>${escapeHtml(c.phone || "-")}</td><td>${c.rental_count}</td><td>${money(c.total_spend)}</td><td>${badge(c.active ? "active" : "disabled")}</td><td><button class="small-btn ${c.active ? "secondary" : ""}" data-customer="${c.id}:${c.active ? 0 : 1}">${c.active ? "Disable" : "Enable"}</button></td></tr>`);
    $("#pageContent").innerHTML = table(["Customer","Email","Phone","Rentals","Total value","Account","Action"],rows,"No customers found.");
    document.querySelectorAll("[data-customer]").forEach(b => b.onclick = () => updateCustomer(b.dataset.customer));
  },
  async returns() {
    state.returns = await api("/api/returns");
    const rows = state.returns.map(r => `<tr><td>#${r.id}</td><td><strong>${escapeHtml(r.equipment_name)}</strong><small>${escapeHtml(r.equipment_code)}</small></td><td>${escapeHtml(r.customer_name)}</td><td>${dateText(r.actual_return_date || r.return_due_date)}</td><td>${badge(r.status)}</td><td><button class="small-btn" data-inspect="${r.id}">${r.return_request_status === "processed" ? "View" : "Inspect"}</button></td></tr>`);
    $("#pageContent").innerHTML = table(["Request","Equipment","Customer","Return date","Status","Action"],rows,"No return requests.");
    document.querySelectorAll("[data-inspect]").forEach(b => b.onclick = () => showInspection(Number(b.dataset.inspect)));
  },
  async damages() {
    state.returns = await api("/api/returns"); const records = state.returns.filter(r => r.status === "claim_pending" || ["damaged","lost"].includes(r.condition));
    const rows = records.map(r => `<tr><td>#${r.id}</td><td><strong>${escapeHtml(r.equipment_name)}</strong><small>${escapeHtml(r.equipment_code)}</small></td><td>${escapeHtml(r.customer_name)}</td><td>${badge(r.condition)}</td><td>${escapeHtml(r.damage_remarks || "-")}</td><td>${money(r.repair_cost)}</td><td>${badge(r.status)}</td></tr>`);
    $("#pageContent").innerHTML = table(["Report","Equipment","Customer","Condition","Damage remarks","Repair cost","Status"],rows,"No damage reports.");
  },
  async deductions() {
    state.returns = await api("/api/returns"); const records = state.returns.filter(r => r.status === "claim_pending" && r.deduction_status === "pending");
    const rows = records.map(r => `<tr><td>#${r.id}</td><td>${escapeHtml(r.customer_name)}</td><td><strong>${escapeHtml(r.equipment_name)}</strong></td><td>${money(r.deposit_amount)}</td><td>${money(r.deposit_deduction)}</td><td>${badge(r.deduction_status)}</td><td><div class="actions"><button class="small-btn" data-deduct="${r.id}:approved">Approve</button><button class="small-btn secondary" data-deduct="${r.id}:rejected">Reject</button></div></td></tr>`);
    $("#pageContent").innerHTML = table(["Claim","Customer","Equipment","Deposit","Proposed deduction","Decision","Action"],rows,"No deductions require review.");
    document.querySelectorAll("[data-deduct]").forEach(b => b.onclick = () => decideDeduction(b.dataset.deduct));
  },
  async payments() {
    state.returns = await api("/api/returns");
    const totalDeposit = state.returns.reduce((sum, r) => sum + (Number(r.deposit_amount) || 0), 0);
    const totalDeduction = state.returns.reduce((sum, r) => sum + (Number(r.deposit_deduction) || 0), 0);
    const totalRefund = state.returns.filter(r => r.return_request_status === "processed").reduce((sum, r) => sum + (Number(r.balance_refund) || 0), 0);
    const pendingClaims = state.returns.filter(r => r.status === "claim_pending" && r.deduction_status === "pending").length;
    const rows = state.returns.map(r => {
      const action = r.status === "claim_pending" && r.deduction_status === "pending"
        ? `<div class="actions"><button class="small-btn" data-deduct="${r.id}:approved">Approve</button><button class="small-btn secondary" data-deduct="${r.id}:rejected">Reject</button></div>`
        : `<span class="muted">${pretty(r.deduction_status || "reviewed")}</span>`;
      return `<tr><td>#${r.id}</td><td><strong>${escapeHtml(r.customer_name)}</strong><small>${escapeHtml(r.customer_email || "")}</small></td><td>${escapeHtml(r.equipment_name)}</td><td>${money(r.deposit_amount)}</td><td>${money(r.rental_amount || 0)}</td><td>${money(r.deposit_deduction || 0)}</td><td>${r.return_request_status === "processed" ? money(r.balance_refund) : "-"}</td><td>${badge(r.deduction_status || r.status)}</td><td>${action}</td></tr>`;
    });
    $("#pageContent").innerHTML = hero("Payments and refunds", "Approve claim deductions and keep deposit, rental amount, damage cut, and customer refund details clear.", [["Damage reports","damages"],["Download CSV","reports","ghost"]]) + cards([["Deposits held",money(totalDeposit),"green"],["Damage deductions",money(totalDeduction),"red"],["Refund ready",money(totalRefund),"green"],["Pending claims",pendingClaims,"amber"]]) + table(["Claim","Customer","Equipment","Deposit","Rental","Damage cut","Refund","Decision","Action"], rows, "No payment records found.");
    document.querySelectorAll("[data-deduct]").forEach(b => b.onclick = () => decideDeduction(b.dataset.deduct));
  },
  async statuses() {
    const [bookings, returns] = await Promise.all([api("/api/bookings"), api("/api/returns")]);
    const bookingRows = bookings.map(b => `<tr><td>#${b.id}</td><td>${escapeHtml(b.customer_name)}</td><td>${escapeHtml(b.equipment_name)}</td><td>${badge(b.status)}</td><td><select data-booking-status="${b.id}">${["pending","approved","active","return_requested","returned","rejected","cancelled"].map(s => `<option ${s===b.status?"selected":""}>${s}</option>`).join("")}</select></td></tr>`);
    const returnRows = returns.map(r => `<tr><td>#${r.id}</td><td>${escapeHtml(r.customer_name)}</td><td>${escapeHtml(r.equipment_name)}</td><td>${badge(r.status)}</td><td><select data-return-status="${r.id}">${["due","overdue","returned","inspection","claim_pending","closed"].map(s => `<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></td></tr>`);
    $("#pageContent").innerHTML = `<div class="panel-head"><div><h2>Booking statuses</h2><p>Approve or move customer booking requests.</p></div></div>${table(["Booking","Customer","Equipment","Current","Update"],bookingRows)}<div style="height:18px"></div><div class="panel-head"><div><h2>Return statuses</h2><p>Control return and claim workflow states.</p></div></div>${table(["Return","Customer","Equipment","Current","Update"],returnRows)}`;
    document.querySelectorAll("[data-booking-status]").forEach(s => s.onchange = () => updateBookingStatus(s.dataset.bookingStatus,s.value));
    document.querySelectorAll("[data-return-status]").forEach(s => s.onchange = () => updateReturnStatus(s.dataset.returnStatus,s.value));
  },
  async reports() {
    const data = await api("/api/dashboard");
    $("#headerAction").innerHTML = `<a class="primary" href="/api/reports/returns.csv" style="text-decoration:none">Download CSV</a>`;
    const metrics = [["Bookings", data.bookings], ["Returns", data.returns], ["Claims", data.claims], ["Overdue", data.overdue]];
    const max = Math.max(1, ...metrics.map(x => Number(x[1]) || 0));
    const chartRows = metrics.map(([label, value]) => `<div class="chart-row"><span>${label}</span><div class="chart-track"><span class="chart-fill" style="width:${Math.max(6, ((Number(value) || 0) / max) * 100)}%"></span></div><b>${value}</b></div>`).join("");
    $("#pageContent").innerHTML = hero("Analytics and reports", "Monitor bookings, monthly revenue indicators, damage exposure, and operational health with export-ready reports.", [["Payments","payments"],["Equipment","equipment","ghost"]]) + cards([["Total bookings",data.bookings],["Return records",data.returns],["Open claims",data.claims,"red"],["Overdue",data.overdue,"amber"]]) + `<div class="analytics-grid"><section class="chart-panel"><h3>Operations chart</h3><p class="muted">Current activity distribution across the rental workflow.</p><div class="chart-bars">${chartRows}</div></section><section class="panel side-panel"><h3>Financial report</h3><div class="metric-line"><span>Estimated repair costs</span><b>${money(data.repair_cost)}</b></div><div class="metric-line"><span>Deposit deductions</span><b>${money(data.deductions)}</b></div><div class="metric-line"><span>Customers</span><b>${data.customers}</b></div><div class="metric-line"><span>Inventory units available</span><b>${data.available}</b></div></section></div>`;
  },
  async settings() {
    const [p, settings] = await Promise.all([api("/api/profile"), api("/api/settings")]);
    $("#pageContent").innerHTML = `
      <div class="settings-grid">
        <section class="settings-card">
          <h3>Company details</h3>
          <p class="muted">Workspace identity used across invoices, reports, and customer communication.</p>
          <form class="admin-equipment-form" id="companySettingsForm">
            <label>Company name<input value="${escapeHtml(settings.company_name || "SD Digitals")}" name="company_name"></label>
            <label>Support email<input type="email" value="${escapeHtml(settings.support_email || p.email)}" name="support_email"></label>
            <label>Support phone<input value="${escapeHtml(settings.support_phone || p.phone || "+91 90000 00000")}" name="support_phone"></label>
            <button class="primary" type="submit">Save settings</button>
          </form>
        </section>
        <section class="settings-card">
          <h3>Notifications</h3>
          <p class="muted">Professional alerts for bookings, returns, claims, payments, and refunds.</p>
          <form class="toggle-list" id="notificationSettingsForm">
            ${notificationToggle("notify_booking_approvals", "Booking approvals", settings.notify_booking_approvals)}
            ${notificationToggle("notify_return_inspections", "Return inspections", settings.notify_return_inspections)}
            ${notificationToggle("notify_payment_refunds", "Payment and refund updates", settings.notify_payment_refunds)}
            ${notificationToggle("notify_damage_escalation", "Damage claim escalation", settings.notify_damage_escalation)}
            <button class="primary" type="submit">Save notifications</button>
          </form>
        </section>
      </div>`;
    $("#companySettingsForm").onsubmit = saveSettingsForm;
    $("#notificationSettingsForm").onsubmit = saveSettingsForm;
  }
};

function notificationToggle(name, label, checked) {
  return `<label class="toggle-row"><span>${escapeHtml(label)}</span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span class="switch" aria-hidden="true"></span></label>`;
}

async function saveSettingsForm(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {};
  new FormData(form).forEach((value, key) => { payload[key] = value; });
  form.querySelectorAll('input[type="checkbox"]').forEach(input => { payload[input.name] = input.checked; });
  try {
    await api("/api/settings", { method: "PATCH", body: JSON.stringify(payload) });
    toast("Settings saved");
    loadView("settings");
  } catch (e) {
    toast(e.message, true);
  }
}

function equipmentVisual(e) {
  const category = escapeHtml(e.category || "Equipment");
  const code = escapeHtml(e.code || "SD");
  const imageUrl = normalizeImageUrl(e.image_url);
  if (imageUrl) {
    return `<div class="admin-equipment-visual has-image" data-category="${category.toLowerCase()}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(e.name || category)}" loading="lazy" onerror="this.closest('.admin-equipment-visual').classList.remove('has-image'); this.remove();"><span>${escapeHtml(category.slice(0, 3).toUpperCase())}</span><small>${code}</small></div>`;
  }
  return `<div class="admin-equipment-visual" data-category="${category.toLowerCase()}"><span>${escapeHtml(category.slice(0, 3).toUpperCase())}</span><small>${code}</small></div>`;
}

function catalogueEquipmentVisual(e) {
  const imageUrl = normalizeImageUrl(e.image_url);
  if (imageUrl) {
    return `<div class="equipment-visual has-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(e.name)}" loading="lazy" onerror="this.parentElement.classList.remove('has-image'); this.remove(); this.parentElement.textContent='${escapeHtml(e.category.slice(0,3).toUpperCase())}';"></div>`;
  }
  return `<div class="equipment-visual">${escapeHtml(e.category.slice(0,3).toUpperCase())}</div>`;
}

function normalizeImageUrl(value) {
  const imageUrl = String(value || "").trim();
  if (!imageUrl) return "";
  try {
    const parsed = new URL(imageUrl);
    for (const key of ["imgurl", "mediaurl", "url"]) {
      const candidate = parsed.searchParams.get(key);
      if (candidate) return decodeURIComponent(candidate).trim();
    }
  } catch (_) {}
  return imageUrl;
}

function renderEquipmentManagement(editId = null) {
  const editing = editId ? state.equipment.find(x => x.id === editId) : null;
  const categories = ["Camera", "Lens", "Lighting", "Audio", "Gimbal", "Accessory"];
  const conditions = ["excellent", "good", "fair", "damaged"];
  const statuses = ["available", "maintenance", "retired"];
  const fieldValue = (key, fallback = "") => escapeHtml(editing?.[key] ?? fallback);
  const cards = state.equipment.map(e => `
    <article class="admin-equipment-card ${e.status === "retired" ? "is-retired" : ""}">
      ${equipmentVisual(e)}
      <div class="admin-equipment-card-body">
        <small>${escapeHtml(e.category)}</small>
        <h3>${escapeHtml(e.name)}</h3>
        <p>${escapeHtml(e.description || "Inventory item ready for rental operations.")}</p>
        <div class="admin-equipment-stats">
          <span>Rate<b>${money(e.daily_rate)}</b></span>
          <span>Stock<b>${e.stock_available} / ${e.stock_total}</b></span>
        </div>
        <div class="admin-equipment-actions">
          <button class="small-btn" data-edit-equipment="${e.id}" type="button">Edit</button>
          <button class="small-btn danger" data-retire-equipment="${e.id}" type="button">${e.status === "retired" ? "Retired" : "Delete"}</button>
        </div>
      </div>
    </article>
  `).join("");

  $("#pageContent").innerHTML = `
    <section class="admin-equipment-page">
      <aside class="admin-equipment-panel">
        <div class="admin-panel-head">
          <h2>${editing ? "Edit Equipment" : "Add Equipment"}</h2>
          ${editing ? `<button class="link-btn" type="button" id="cancelEquipmentEdit">New item</button>` : ""}
        </div>
        <form id="adminEquipmentForm" class="admin-equipment-form">
          <label>Asset code<input name="code" placeholder="CAM-001" value="${fieldValue("code")}" ${editing ? "disabled" : ""} required></label>
          <label>Equipment name<input name="name" placeholder="Equipment name" value="${fieldValue("name")}" required></label>
          <label>Category<select name="category">${categories.map(x => `<option ${x === editing?.category ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          <label>Image URL<input name="image_url" type="url" placeholder="Paste direct image link or Google imgres link" value="${fieldValue("image_url")}"></label>
          <div class="admin-image-preview ${editing?.image_url ? "has-image" : ""}" id="equipmentImagePreview">
            ${editing?.image_url ? `<img src="${escapeHtml(normalizeImageUrl(editing.image_url))}" alt="Equipment preview">` : `<span>Image preview</span>`}
          </div>
          <div class="admin-form-row">
            <label>Daily rate<input type="number" min="0" name="daily_rate" value="${fieldValue("daily_rate", 0)}" required></label>
            <label>Deposit<input type="number" min="0" name="deposit_amount" value="${fieldValue("deposit_amount", 0)}" required></label>
          </div>
          <div class="admin-form-row">
            <label>Total stock<input type="number" min="0" name="stock_total" value="${fieldValue("stock_total", 1)}" required></label>
            <label>Available<input type="number" min="0" name="stock_available" value="${fieldValue("stock_available", editing ? 0 : 1)}"></label>
          </div>
          <div class="admin-form-row">
            <label>Condition<select name="condition">${conditions.map(x => `<option value="${x}" ${x === (editing?.condition || "excellent") ? "selected" : ""}>${pretty(x)}</option>`).join("")}</select></label>
            <label>Status<select name="status">${statuses.map(x => `<option value="${x}" ${x === (editing?.status || "available") ? "selected" : ""}>${pretty(x)}</option>`).join("")}</select></label>
          </div>
          <label>Description<textarea name="description" rows="5" placeholder="Description">${fieldValue("description")}</textarea></label>
          <button class="primary" type="submit">+ ${editing ? "Save Equipment" : "Add Equipment"}</button>
        </form>
      </aside>
      <section class="admin-equipment-panel admin-equipment-list-panel">
        <div class="admin-panel-head">
          <h2>Existing Equipment</h2>
          <span>${state.equipment.length} item${state.equipment.length === 1 ? "" : "s"}</span>
        </div>
        <div class="admin-equipment-card-grid">${cards || `<div class="empty">No equipment in inventory.</div>`}</div>
      </section>
    </section>
  `;

  $("#adminEquipmentForm").onsubmit = saveInlineEquipment(editing?.id || null);
  const imageInput = $("#adminEquipmentForm [name=image_url]");
  if (imageInput) {
    imageInput.oninput = () => updateEquipmentImagePreview(imageInput.value);
    updateEquipmentImagePreview(imageInput.value);
  }
  const cancel = $("#cancelEquipmentEdit"); if (cancel) cancel.onclick = () => renderEquipmentManagement();
  document.querySelectorAll("[data-edit-equipment]").forEach(b => b.onclick = () => renderEquipmentManagement(Number(b.dataset.editEquipment)));
  document.querySelectorAll("[data-retire-equipment]").forEach(b => b.onclick = () => retireEquipment(Number(b.dataset.retireEquipment)));
}

function updateEquipmentImagePreview(value) {
  const preview = $("#equipmentImagePreview");
  if (!preview) return;
  const imageUrl = normalizeImageUrl(value);
  if (!imageUrl) {
    preview.className = "admin-image-preview";
    preview.innerHTML = "<span>Image preview</span>";
    return;
  }
  preview.className = "admin-image-preview has-image";
  preview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Equipment preview" onerror="this.parentElement.className='admin-image-preview error'; this.parentElement.innerHTML='<span>Image not loading. Use Copy image address.</span>';">`;
}

function saveInlineEquipment(id = null) {
  return async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target));
    payload.image_url = normalizeImageUrl(payload.image_url);
    if (!id) payload.stock_available = payload.stock_total;
    try {
      await api(id ? `/api/equipment/${id}` : "/api/equipment", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast(id ? "Equipment updated" : "Equipment added");
      state.equipment = await api("/api/equipment");
      renderEquipmentManagement();
    } catch (e) {
      toast(e.message, true);
    }
  };
}

async function retireEquipment(id) {
  const item = state.equipment.find(x => x.id === id);
  if (!item || item.status === "retired") return;
  try {
    await api(`/api/equipment/${id}`, { method: "PATCH", body: JSON.stringify({ status: "retired", stock_available: 0 }) });
    toast("Equipment retired");
    state.equipment = await api("/api/equipment");
    renderEquipmentManagement();
  } catch (e) {
    toast(e.message, true);
  }
}

function showBooking(id) {
  const e = state.equipment.find(x => x.id === id);
  openModal(`${modalHead("Book equipment", `${escapeHtml(e.name)} / ${money(e.daily_rate)} per day`)}<form id="bookingForm"><input type="hidden" name="equipment_id" value="${e.id}"><div class="form-grid"><label class="field">Start date<input type="date" name="start_date" required></label><label class="field">End date<input type="date" name="end_date" required></label><label class="field wide">Purpose<textarea name="purpose" rows="3" placeholder="Shoot, event, production..."></textarea></label></div><div class="notice">Security deposit: <b>${money(e.deposit_amount)}</b>. Final rental amount is calculated from the selected duration.</div><div class="form-actions"><button type="button" class="ghost modal-close">Cancel</button><button class="primary">Submit booking</button></div></form>`);
  $("#bookingForm").onsubmit = async event => { event.preventDefault(); try { await api("/api/bookings",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(event.target)))}); $("#modal").close(); toast("Booking request submitted"); loadView("rentals"); } catch(e){toast(e.message,true);} };
}

function showReturnRequest(id) {
  const b = state.bookings.find(x => x.id === id);
  openModal(`${modalHead("Return equipment", `${escapeHtml(b.equipment_name)} / Booking #${b.id}`)}<form id="returnRequestForm"><input type="hidden" name="booking_id" value="${b.id}"><div class="form-grid"><label class="field">Return date<input type="date" name="actual_return_date" value="${new Date().toISOString().slice(0,10)}" required></label><label class="field wide">Return notes<textarea name="notes" rows="3" placeholder="Mention accessories or any known issue"></textarea></label></div><div class="form-actions"><button type="button" class="ghost modal-close">Cancel</button><button class="primary">Submit return request</button></div></form>`);
  $("#returnRequestForm").onsubmit = async event => { event.preventDefault(); try { await api("/api/returns/request",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(event.target)))}); $("#modal").close(); toast("Return request submitted"); loadView("rentals"); } catch(e){toast(e.message,true);} };
}

function showEquipmentForm(id = null) {
  const e = id ? state.equipment.find(x => x.id === id) : {};
  openModal(`${modalHead(id ? "Edit equipment" : "Add equipment")}<form id="equipmentForm"><div class="form-grid"><label class="field">Asset code<input name="code" value="${escapeHtml(e.code||"")}" ${id?"disabled":""} required></label><label class="field">Equipment name<input name="name" value="${escapeHtml(e.name||"")}" required></label><label class="field">Category<select name="category">${["Camera","Lens","Lighting","Audio","Gimbal","Accessory"].map(x=>`<option ${x===e.category?"selected":""}>${x}</option>`).join("")}</select></label><label class="field">Daily rate<input type="number" min="0" name="daily_rate" value="${e.daily_rate||0}" required></label><label class="field">Deposit amount<input type="number" min="0" name="deposit_amount" value="${e.deposit_amount||0}" required></label><label class="field">Total stock<input type="number" min="0" name="stock_total" value="${e.stock_total??1}" required></label>${id?`<label class="field">Available stock<input type="number" min="0" name="stock_available" value="${e.stock_available}"></label><label class="field">Condition<select name="condition">${["excellent","good","fair","damaged"].map(x=>`<option ${x===e.condition?"selected":""}>${x}</option>`).join("")}</select></label><label class="field">Status<select name="status">${["available","maintenance","retired"].map(x=>`<option ${x===e.status?"selected":""}>${x}</option>`).join("")}</select></label>`:""}<label class="field wide">Description<textarea name="description" rows="3">${escapeHtml(e.description||"")}</textarea></label></div><div class="form-actions"><button type="button" class="ghost modal-close">Cancel</button><button class="primary">Save equipment</button></div></form>`);
  $("#equipmentForm").onsubmit = async event => { event.preventDefault(); const payload=Object.fromEntries(new FormData(event.target)); try { await api(id?`/api/equipment/${id}`:"/api/equipment",{method:id?"PATCH":"POST",body:JSON.stringify(payload)}); $("#modal").close(); toast("Equipment saved"); loadView("equipment"); } catch(e){toast(e.message,true);} };
}

async function showInspection(id) {
  const r = await api(`/api/returns/${id}`);
  openModal(`${modalHead(`Return inspection #${r.id}`, `${escapeHtml(r.equipment_name)} / ${escapeHtml(r.customer_name)}`)}<div class="detail-grid"><div><small>Due date</small><b>${dateText(r.return_due_date)}</b></div><div><small>Deposit</small><b>${money(r.deposit_amount)}</b></div><div><small>Status</small>${badge(r.status)}</div></div>${r.recommendation?`<div class="notice"><b>Recommendation</b><br>${escapeHtml(r.recommendation)}</div>`:""}<form id="inspectionForm"><div class="form-grid"><label class="field">Actual return date<input type="date" name="actual_return_date" value="${r.actual_return_date||new Date().toISOString().slice(0,10)}" required></label><label class="field">Condition<select name="condition">${["excellent","good","fair","damaged","lost"].map(x=>`<option ${x===r.condition?"selected":""}>${x}</option>`).join("")}</select></label><label class="field">Repair cost<input type="number" name="repair_cost" min="0" value="${r.repair_cost||0}"></label><label class="field wide">Damage remarks<textarea name="damage_remarks" rows="3">${escapeHtml(r.damage_remarks||"")}</textarea></label></div><div class="form-actions"><button type="button" class="ghost modal-close">Close</button><button class="primary">Process inspection</button></div></form>`);
  $("#inspectionForm").onsubmit = async event => {event.preventDefault();try{await api(`/api/returns/${id}/process`,{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});$("#modal").close();toast("Inspection processed");loadView("returns");}catch(e){toast(e.message,true);}};
}

async function saveProfile(event) { event.preventDefault(); try { const p=await api("/api/profile",{method:"PATCH",body:JSON.stringify(Object.fromEntries(new FormData(event.target)))}); state.user={...state.user,...p}; $("#sidebarName").textContent=p.name; toast("Profile updated"); } catch(e){toast(e.message,true);} }
async function decideDeduction(value) { const [id,decision]=value.split(":"); try{await api(`/api/returns/${id}/deduction`,{method:"PATCH",body:JSON.stringify({decision})});toast(`Deduction ${decision}`);loadView(state.view || "payments");}catch(e){toast(e.message,true);} }
async function updateBookingStatus(id,status) { try{await api(`/api/bookings/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});toast("Booking status updated");loadView(state.view || "bookings");}catch(e){toast(e.message,true);loadView(state.view || "bookings");} }
async function updateReturnStatus(id,status) { try{await api(`/api/returns/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});toast("Return status updated");loadView(state.view || "returns");}catch(e){toast(e.message,true);loadView(state.view || "returns");} }
async function updateCustomer(value) { const [id,active]=value.split(":"); try{await api(`/api/customers/${id}`,{method:"PATCH",body:JSON.stringify({active:active==="1"})});toast("Customer account updated");loadView("customers");}catch(e){toast(e.message,true);} }

function clearAuthForms() {
  ["loginForm", "createAccountForm", "forgotPasswordForm"].forEach((id) => {
    const form = document.getElementById(id);
    if (form) form.reset();
  });
  document.querySelectorAll("#loginForm input, #createAccountForm input, #forgotPasswordForm input").forEach((input) => {
    input.value = "";
    input.defaultValue = "";
    if (input.dataset.passwordVisible === "true") {
      input.type = "password";
      input.dataset.passwordVisible = "false";
    }
  });
  const forgotEmail = $("#forgotPasswordForm [name=email]");
  if (forgotEmail) forgotEmail.readOnly = false;
  const otpHelp = $("#otpHelp"); if (otpHelp) otpHelp.classList.add("hidden");
  setForgotStep("email");
  applyPortalMode();
  setAuthMode("login");
}

$("#loginForm").onsubmit = async event => {
  event.preventDefault();
  try {
    const payload = { ...Object.fromEntries(new FormData(event.target)), portal: portalMode };
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    state.user = data.user;
    if (redirectToPortal(state.user.role)) return;
    clearAuthForms();
    showApp();
  } catch (e) {
    toast(e.message, true);
  }
};
const createAccountFormEl = $("#createAccountForm");
if (createAccountFormEl) {
  createAccountFormEl.onsubmit = async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target));
    if (payload.password !== payload.confirm_password) {
      toast("Passwords do not match", true);
      return;
    }
    delete payload.confirm_password;
    try {
      const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
      state.user = data.user;
      event.target.reset();
      toast("Account created successfully");
      showApp();
    } catch (e) {
      toast(e.message, true);
    }
  };
}
$("#forgotPasswordForm").onsubmit = async event => {
  event.preventDefault();
  const currentStep = event.target.dataset.step || "email";
  if (currentStep === "email") {
    $("#sendOtpBtn")?.click();
    return;
  }
  if (currentStep === "otp") {
    $("#verifyOtpBtn")?.click();
    return;
  }
  const payload = Object.fromEntries(new FormData(event.target));
  if (payload.password !== payload.confirm_password) {
    toast("Passwords do not match", true);
    return;
  }
  if (!payload.otp || payload.otp.length !== 6) {
    toast("Enter the 6 digit OTP sent to your email", true);
    return;
  }
  delete payload.confirm_password;
  try {
    await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify(payload) });
    const identifier = payload.email;
    event.target.reset();
    setForgotStep("email");
    $("#forgotPasswordForm [name=email]").readOnly = false;
    $("#loginForm [name=email]").value = identifier;
    $("#loginForm [name=password]").value = "";
    setAuthMode("login");
    toast("Password reset successfully. Sign in with your new password.");
  } catch (e) {
    toast(e.message, true);
  }
};
$("#verifyOtpBtn").onclick = async () => {
  const form = $("#forgotPasswordForm");
  const email = form.querySelector("[name=email]").value.trim();
  const otp = form.querySelector("[name=otp]").value.trim();
  if (!otp || otp.length !== 6) {
    toast("Enter the 6 digit OTP", true);
    return;
  }
  try {
    await api("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) });
    setForgotStep("password");
    $("#forgotPasswordForm [name=password]")?.focus();
  } catch (e) {
    toast(e.message, true);
  }
};
$("#sendOtpBtn").onclick = async () => {
  const form = $("#forgotPasswordForm");
  const email = form.querySelector("[name=email]").value.trim();
  if (!email) {
    toast("Enter your account email first", true);
    return;
  }
  try {
    const result = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    const help = $("#otpHelp");
    form.querySelector("[name=email]").readOnly = true;
    help.textContent = result.dev_otp
      ? `Email delivery is not configured yet. Development OTP: ${result.dev_otp}. Add SMTP details in .env to send it.`
      : "OTP sent to your email. Enter it below.";
    setForgotStep("otp");
    form.querySelector("[name=otp]")?.focus();
    toast(result.email_sent ? "OTP sent to your email" : "OTP generated for local testing");
  } catch (e) {
    toast(e.message, true);
  }
};
function setForgotStep(step) {
  const form = $("#forgotPasswordForm");
  const emailFields = $("#forgotEmailFields");
  const otpFields = $("#verifyOtpFields");
  const passwordFields = $("#setPasswordFields");
  const help = $("#otpHelp");
  if (form) form.dataset.step = step;
  emailFields?.classList.toggle("hidden", step !== "email");
  otpFields?.classList.toggle("hidden", step !== "otp");
  passwordFields?.classList.toggle("hidden", step !== "password");
  help?.classList.toggle("hidden", step === "email");
  emailFields?.querySelectorAll("input, button").forEach((control) => { control.disabled = false; });
  otpFields?.querySelectorAll("input, button").forEach((control) => { control.disabled = step === "email"; });
  passwordFields?.querySelectorAll("input, button").forEach((control) => { control.disabled = step !== "password"; });
  if (step === "email") {
    const forgotEmail = $("#forgotPasswordForm [name=email]");
    if (forgotEmail) forgotEmail.readOnly = false;
    if ($("#sendOtpBtn")) $("#sendOtpBtn").textContent = "Send OTP";
  } else if (step === "password" && help) {
    help.textContent = "OTP verified. Set your new password.";
  }
}
function setAuthMode(mode) {
  const allowRegistration = portalMode === "user";
  if (!allowRegistration && mode === "register") mode = "login";
  const isRegister = allowRegistration && mode === "register";
  const isForgot = mode === "forgot";
  $("#loginForm")?.classList.toggle("hidden", mode !== "login");
  $("#createAccountForm")?.classList.toggle("hidden", !isRegister);
  $("#forgotPasswordForm")?.classList.toggle("hidden", !isForgot);
  $("#showLogin")?.classList.toggle("active", mode === "login");
  $("#showRegister")?.classList.toggle("active", isRegister);
  $("#showRegister")?.classList.toggle("hidden", !allowRegistration);
  $("#authTitle").textContent = isRegister ? "Create account" : isForgot ? "Reset password" : portalMode === "admin" ? "Admin sign in" : "Welcome back";
  $("#authSubtitle").textContent = isRegister
    ? "Set up your customer account to book and return equipment."
    : isForgot
      ? "Enter your account email first. After OTP verification, set your new password."
      : portalMode === "admin"
        ? "Enter your administrator account details to continue."
        : "Enter your account details to continue.";
  if (!isForgot) {
    setForgotStep("email");
  }
}
const btnLogin = $("#showLogin"); if (btnLogin) btnLogin.onclick = () => setAuthMode("login");
const btnRegister = $("#showRegister"); if (btnRegister) btnRegister.onclick = () => setAuthMode("register");
const btnBackFromReg = $("#backToLoginFromRegister"); if (btnBackFromReg) btnBackFromReg.onclick = () => setAuthMode("login");
const btnBackFromForgot = $("#backToLoginFromForgot"); if (btnBackFromForgot) btnBackFromForgot.onclick = () => setAuthMode("login");
$("#forgotPasswordLink").onclick = () => {
  const identifier = $("#loginForm [name=email]").value.trim();
  $("#forgotPasswordForm [name=email]").value = identifier.includes("@") ? identifier : "";
  setForgotStep("email");
  setAuthMode("forgot");
};
document.querySelectorAll("[data-toggle-password]").forEach(button => {
  button.onclick = () => {
    const form = document.getElementById(button.dataset.togglePassword);
    const inputs = form.querySelectorAll('input[type="password"], input[data-password-visible="true"]');
    const shouldShow = [...inputs].some(input => input.type === "password");
    inputs.forEach(input => {
      input.type = shouldShow ? "text" : "password";
      input.dataset.passwordVisible = shouldShow ? "true" : "false";
    });
    form.querySelectorAll("[data-toggle-password]").forEach(toggle => {
      toggle.textContent = shouldShow ? "Hide" : "Show";
    });
  };
});
$("#logoutBtn").onclick = async () => { await api("/api/auth/logout",{method:"POST"}); state.user=null; stopAntigravity(); clearAuthForms(); document.body.classList.remove("app-active"); $("#appShell").classList.add("hidden"); $("#loginPage").classList.remove("hidden"); const bg = $("#webgl-background"); if (bg) bg.classList.remove("hidden"); toast("Logged out"); };

/* ── Antigravity 3D Background Engine ── */
let _agRenderer = null, _agAnimId = null, _agRunning = false;

function startAntigravity() {
  if (_agRunning) return;
  const canvas = $("#webgl-dashboard");
  if (!canvas || typeof THREE === "undefined") return;
  _agRunning = true;
  canvas.classList.remove("hidden");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x071018, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  _agRenderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x071018, 0.018);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 180);
  camera.position.set(0, 5, 34);

  scene.add(new THREE.AmbientLight(0x8fb7ff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 12, 10); scene.add(key);
  const cyan = new THREE.PointLight(0x2dd4bf, 5, 85); cyan.position.set(-12, 9, 6); scene.add(cyan);
  const amber = new THREE.PointLight(0xf59e0b, 3.2, 70); amber.position.set(14, 4, -6); scene.add(amber);
  const blue = new THREE.PointLight(0x60a5fa, 4, 85); blue.position.set(0, 12, 10); scene.add(blue);

  const root = new THREE.Group();
  scene.add(root);

  const matBody = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.42, metalness: 0.72 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.58, metalness: 0.45 });
  const matGlass = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.04, metalness: 0.05, transmission: 0.28, thickness: 0.5, emissive: 0x0ea5e9, emissiveIntensity: 0.45 });
  const matCase = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.45 });
  const matEdge = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.36, metalness: 0.7 });
  const matRing = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const matLine = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22 });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SX = 46, SY = 28, SZ = 70, TOP = SY / 2 + 8, BOT = -SY / 2 - 8;
  const items = [];

  const grid = new THREE.GridHelper(90, 36, 0x38bdf8, 0x1e3a5f);
  grid.position.y = -12;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  root.add(grid);

  for (let i = 0; i < 7; i++) addMotionItem(createCameraModel(), "camera", rnd(0.72, 1.1));
  for (let i = 0; i < 8; i++) addMotionItem(createLensModel(), "lens", rnd(0.72, 1.22));
  for (let i = 0; i < 6; i++) addMotionItem(createReturnCrate(), "crate", rnd(0.82, 1.25));
  for (let i = 0; i < 9; i++) addMotionItem(createStatusRing(), "ring", rnd(1, 1.7));

  const routes = createRouteLines();
  const particles = createParticles(700);
  root.add(routes, particles);

  function addMotionItem(mesh, kind, scale) {
    mesh.position.set(rnd(-SX / 2, SX / 2), rnd(-SY / 2, SY / 2), rnd(-SZ, 10));
    mesh.rotation.set(rnd(-0.7, 0.7), rnd(0, Math.PI * 2), rnd(-0.4, 0.4));
    mesh.scale.setScalar(scale);
    root.add(mesh);
    items.push({ mesh, kind, seed: rnd(0, 100), drift: rnd(0.004, 0.013), sway: rnd(0.3, 1.2), ry: rnd(0.001, 0.006) * (Math.random() > 0.5 ? 1 : -1), rx: rnd(0.0006, 0.003) * (Math.random() > 0.5 ? 1 : -1) });
  }

  function createCameraModel() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.35, 0.88), matBody);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.95, 0.72), matDark); grip.position.set(1.28, -0.06, 0.02);
    const prism = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.38, 0.58), matBody); prism.position.y = 0.86;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.58, 1.05, 36), matDark); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.82;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 36), matGlass); glass.rotation.x = Math.PI / 2; glass.position.z = 1.39;
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.08), matEdge); flash.position.set(-0.55, 0.34, 0.48);
    g.add(body, grip, prism, barrel, glass, flash);
    return g;
  }

  function createLensModel() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 1.55, 48), matDark); barrel.rotation.x = Math.PI / 2;
    const bandA = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 10, 48), matEdge); bandA.position.z = 0.58;
    const bandB = bandA.clone(); bandB.position.z = -0.58;
    const glassA = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48), matGlass); glassA.rotation.x = Math.PI / 2; glassA.position.z = 0.82;
    const glassB = glassA.clone(); glassB.position.z = -0.82;
    g.add(barrel, bandA, bandB, glassA, glassB);
    return g;
  }

  function createReturnCrate() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 1.3), matCase);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.16, 1.42), matEdge); lid.position.y = 0.66;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.08), matDark); latch.position.set(0, 0.2, 0.69);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.38), matRing); tag.position.set(-0.48, 0.05, 0.67);
    g.add(box, lid, latch, tag);
    return g;
  }

  function createStatusRing() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 8, 72), matRing);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), matEdge);
    dot.position.x = 0.9;
    g.add(ring, dot);
    return g;
  }

  function createRouteLines() {
    const group = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const points = [];
      const x = rnd(-25, 25);
      const z = rnd(-58, 4);
      for (let j = 0; j < 8; j++) {
        points.push(new THREE.Vector3(x + Math.sin(j * 0.9 + i) * 3, -8 + j * 2.2, z + j * 1.2));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), matLine));
    }
    return group;
  }

  function createParticles(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rnd(-42, 42);
      positions[i * 3 + 1] = rnd(-16, 18);
      positions[i * 3 + 2] = rnd(-78, 12);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9cc8ff, size: 0.055, transparent: true, opacity: 0.55, depthWrite: false }));
  }

  const mPos = { x: 0, y: 0 }, par = { x: 0, y: 0 };
  const onMove = (e) => { mPos.x = (e.clientX / window.innerWidth - 0.5) * 2; mPos.y = -(e.clientY / window.innerHeight - 0.5) * 2; };
  window.addEventListener("mousemove", onMove, { passive: true });

  const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight, false); };
  window.addEventListener("resize", onResize);

  function loop() {
    if (!_agRunning) return;
    _agAnimId = requestAnimationFrame(loop);
    const t = performance.now() * 0.001;
    par.x += (mPos.x * 1.2 - par.x) * 0.02;
    par.y += (mPos.y * 1.2 - par.y) * 0.02;
    camera.position.x = Math.sin(t * 0.16) * 2.2 + par.x * 1.1;
    camera.position.y = 5 + Math.cos(t * 0.13) * 1.2 + par.y * 0.7;
    camera.position.z = 32 + Math.sin(t * 0.1) * 2.4;
    camera.lookAt(0, -1.5, -18);
    root.rotation.y = Math.sin(t * 0.06) * 0.08;
    grid.position.z = (t * 4) % 5;
    routes.rotation.y = Math.sin(t * 0.12) * 0.04;
    particles.rotation.y += 0.0008;
    for (const it of items) {
      it.mesh.position.y += it.drift;
      it.mesh.position.x += Math.sin(t * 0.5 + it.seed) * 0.002 * it.sway;
      it.mesh.rotation.y += it.ry;
      it.mesh.rotation.x += it.rx;
      if (it.mesh.position.y > TOP) { it.mesh.position.y = BOT; it.mesh.position.x = rnd(-SX / 2, SX / 2); it.mesh.position.z = rnd(-SZ, 5); }
      if (it.kind === "ring") it.mesh.scale.setScalar(1.2 + Math.sin(t * 1.8 + it.seed) * 0.18);
    }
    cyan.position.x = Math.cos(t * 0.32) * 16;
    cyan.position.z = Math.sin(t * 0.28) * 16;
    amber.position.y = 5 + Math.sin(t * 0.5) * 5;
    blue.position.x = Math.sin(t * 0.18) * 18;
    renderer.render(scene, camera);
  }
  loop();

  window._agCleanup = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("resize", onResize); };
}

function startAntigravity() {
  if (_agRunning) return;
  const canvas = $("#webgl-dashboard");
  if (!canvas || typeof THREE === "undefined") return;
  _agRunning = true;
  canvas.classList.remove("hidden");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x020202, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  _agRenderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030201, 0.014);

  const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 180);
  camera.position.set(0, 9.4, 24);

  scene.add(new THREE.HemisphereLight(0xffd59a, 0x010101, 0.62));
  const key = new THREE.DirectionalLight(0xfff1c7, 2.4);
  key.position.set(-8, 18, 12);
  scene.add(key);
  const goldGlow = new THREE.PointLight(0xffb21d, 4.8, 80);
  goldGlow.position.set(-14, 8, 8);
  scene.add(goldGlow);
  const roseGlow = new THREE.PointLight(0xff6b35, 2.8, 65);
  roseGlow.position.set(16, 6, -12);
  scene.add(roseGlow);

  const root = new THREE.Group();
  scene.add(root);
  const rand = (min, max) => min + Math.random() * (max - min);

  const liquidUniforms = {
    uTime: { value: 0 },
    uBase: { value: new THREE.Color(0x010101) },
    uGoldA: { value: new THREE.Color(0x6f4305) },
    uGoldB: { value: new THREE.Color(0xffc45c) },
    uHot: { value: new THREE.Color(0xfff0a3) },
  };

  const liquid = new THREE.Mesh(
    new THREE.PlaneGeometry(118, 86, 220, 160),
    new THREE.ShaderMaterial({
      uniforms: liquidUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;

        float wave(vec2 p, float speed, float scale) {
          return sin(p.x * scale + uTime * speed) * cos(p.y * (scale * 0.72) - uTime * (speed * 0.64));
        }

        void main() {
          vUv = uv;
          vec3 p = position;
          float d = length(p.xy);
          float ripple =
            wave(p.xy, 0.42, 0.34) * 0.92 +
            wave(p.yx + vec2(8.0, -3.0), 0.31, 0.55) * 0.48 +
            sin(d * 0.72 - uTime * 0.86) * 0.36;
          float mask = smoothstep(70.0, 10.0, d);
          p.z += ripple * mask * 1.24;
          vWave = ripple;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBase;
        uniform vec3 uGoldA;
        uniform vec3 uGoldB;
        uniform vec3 uHot;
        varying vec2 vUv;
        varying float vWave;

        float stripe(vec2 p, float scale, float speed) {
          return sin((p.x * 1.4 + p.y * 0.65) * scale + uTime * speed);
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float vignette = smoothstep(1.25, 0.18, length(p));
          float flow = stripe(vUv, 18.0, 0.55) * 0.5 + stripe(vUv.yx, 27.0, -0.32) * 0.3;
          float gold = smoothstep(0.08, 0.86, vWave * 0.45 + flow * 0.55 + 0.44);
          float hot = pow(max(0.0, gold), 4.0);
          vec3 color = mix(uBase, uGoldA, gold * 0.72);
          color = mix(color, uGoldB, hot * 0.72);
          color += uHot * hot * 0.24;
          color *= 0.44 + vignette * 0.92;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
  );
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.set(0, -4.6, -17);
  root.add(liquid);

  const particleCount = 980;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleSeeds = new Float32Array(particleCount);
  const particleSizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = rand(-46, 46);
    particlePositions[i * 3 + 1] = rand(-4, 26);
    particlePositions[i * 3 + 2] = rand(-55, 15);
    particleSeeds[i] = rand(0, 100);
    particleSizes[i] = rand(2.4, 11);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeo.setAttribute("aSeed", new THREE.BufferAttribute(particleSeeds, 1));
  particleGeo.setAttribute("aSize", new THREE.BufferAttribute(particleSizes, 1));
  const shimmer = new THREE.Points(particleGeo, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.y = mod(position.y + uTime * (0.42 + fract(aSeed) * 0.58) + 8.0, 34.0) - 7.0;
        p.x += sin(uTime * 0.22 + aSeed) * 0.62;
        p.z += cos(uTime * 0.18 + aSeed * 0.7) * 0.52;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vAlpha = 0.18 + sin(uTime * 1.4 + aSeed) * 0.16;
        gl_PointSize = aSize * uPixelRatio * (22.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord.xy - 0.5;
        float d = dot(uv, uv);
        if (d > 0.25) discard;
        float core = smoothstep(0.25, 0.0, d);
        vec3 gold = mix(vec3(1.0, 0.54, 0.10), vec3(0.72, 0.92, 1.0), core * 0.22);
        gl_FragColor = vec4(gold, core * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  root.add(shimmer);

  const bokehTexture = createBokehTexture();
  const bokeh = [];
  for (let i = 0; i < 18; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bokehTexture,
      color: 0xffbd69,
      transparent: true,
      opacity: rand(0.05, 0.18),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sprite.position.set(rand(-38, 38), rand(1, 22), rand(-68, -8));
    sprite.scale.setScalar(rand(4, 13));
    sprite.userData = { seed: rand(0, 100), baseY: sprite.position.y, speed: rand(0.05, 0.14) };
    root.add(sprite);
    bokeh.push(sprite);
  }

  function createBokehTexture() {
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 96;
    spriteCanvas.height = 96;
    const ctx = spriteCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(48, 48, 2, 48, 48, 48);
    grad.addColorStop(0, "rgba(255, 246, 206, 0.9)");
    grad.addColorStop(0.35, "rgba(255, 185, 72, 0.38)");
    grad.addColorStop(1, "rgba(255, 143, 40, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 96, 96);
    return new THREE.CanvasTexture(spriteCanvas);
  }

  const mouse = { x: 0, y: 0 };
  const parallax = { x: 0, y: 0 };
  const onMove = (event) => {
    mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = -(event.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("mousemove", onMove, { passive: true });

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    shimmer.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
  };
  window.addEventListener("resize", onResize);

  function loop() {
    if (!_agRunning) return;
    _agAnimId = requestAnimationFrame(loop);
    const time = performance.now() * 0.001;
    liquidUniforms.uTime.value = time;
    shimmer.material.uniforms.uTime.value = time;
    parallax.x += (mouse.x * 0.62 - parallax.x) * 0.018;
    parallax.y += (mouse.y * 0.38 - parallax.y) * 0.018;
    camera.position.x = Math.sin(time * 0.12) * 1.08 + parallax.x;
    camera.position.y = 9.2 + Math.cos(time * 0.10) * 0.46 + parallax.y;
    camera.position.z = 23.6 + Math.sin(time * 0.09) * 0.88;
    camera.lookAt(Math.sin(time * 0.07) * 1.2, -4.2, -17);
    root.rotation.y = Math.sin(time * 0.045) * 0.018;
    goldGlow.position.x = Math.cos(time * 0.22) * 18;
    goldGlow.position.z = Math.sin(time * 0.18) * 16 - 6;
    roseGlow.position.y = 6 + Math.sin(time * 0.34) * 2.5;
    for (const sprite of bokeh) {
      sprite.position.y = sprite.userData.baseY + Math.sin(time * sprite.userData.speed + sprite.userData.seed) * 1.2;
      sprite.material.opacity = 0.07 + Math.sin(time * 0.28 + sprite.userData.seed) * 0.035;
    }
    renderer.render(scene, camera);
  }
  loop();

  window._agCleanup = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("resize", onResize);
  };
}

function startAntigravity() {
  if (_agRunning) return;
  const canvas = $("#webgl-dashboard");
  if (!canvas || typeof THREE === "undefined") return;
  _agRunning = true;
  canvas.classList.remove("hidden");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x061127, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  _agRenderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x061127, 0.015);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 180);
  camera.position.set(-6.5, 2.6, 28);

  const root = new THREE.Group();
  root.position.set(2.2, 0, -18);
  scene.add(root);

  scene.add(new THREE.AmbientLight(0x7dcfff, 0.52));
  const cyanKey = new THREE.PointLight(0x53e7ff, 5.5, 88);
  cyanKey.position.set(11, 7, 5);
  scene.add(cyanKey);
  const whiteCore = new THREE.PointLight(0xf4fbff, 3.8, 60);
  whiteCore.position.set(15, 1, -14);
  scene.add(whiteCore);
  const indigoFill = new THREE.DirectionalLight(0x3451ff, 1.4);
  indigoFill.position.set(-7, 9, 12);
  scene.add(indigoFill);

  const rand = (min, max) => min + Math.random() * (max - min);
  const bokehTexture = createGlowTexture();

  const backdropUniforms = {
    uTime: { value: 0 },
    uTop: { value: new THREE.Color(0x08183a) },
    uMid: { value: new THREE.Color(0x061127) },
    uDeep: { value: new THREE.Color(0x020716) },
  };
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 90, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: backdropUniforms,
      depthWrite: false,
      depthTest: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.x / 75.0, position.y / 45.0, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uDeep;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float glow = smoothstep(1.18, 0.0, length(p - vec2(0.42, 0.08)));
          float upperRay = smoothstep(0.028, 0.0, abs((p.y + p.x * 0.42) - 0.58));
          float lowerRay = smoothstep(0.036, 0.0, abs((p.y + p.x * 0.36) - 0.28));
          vec3 color = mix(uDeep, uMid, vUv.y);
          color = mix(color, uTop, smoothstep(0.25, 1.0, vUv.y) * 0.72);
          color += vec3(0.08, 0.34, 0.58) * glow * 0.48;
          color += vec3(0.28, 0.74, 1.0) * (upperRay * 0.09 + lowerRay * 0.06);
          color *= 0.78 + smoothstep(1.35, 0.18, length(p)) * 0.45;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
  );
  backdrop.renderOrder = -10;
  scene.add(backdrop);

  const nodeCount = 188;
  const positions = new Float32Array(nodeCount * 3);
  const basePositions = [];
  const seeds = new Float32Array(nodeCount);
  const sizes = new Float32Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const r = Math.random();
    const isCluster = r > 0.24;
    const x = isCluster ? rand(0, 24) + Math.pow(Math.random(), 2.2) * 11 : rand(-30, 3);
    const y = isCluster ? rand(-9.5, 10.5) : rand(-12, 12);
    const z = isCluster ? rand(-18, 12) : rand(-24, 16);
    const position = new THREE.Vector3(x, y, z);
    basePositions.push(position);
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    seeds[i] = rand(0, 100);
    sizes[i] = isCluster ? rand(6, 16) : rand(3, 9);
  }

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  nodeGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  nodeGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  const nodes = new THREE.Points(nodeGeo, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uCyan: { value: new THREE.Color(0x58eaff) },
      uWhite: { value: new THREE.Color(0xf6fbff) },
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vPulse;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.24 + aSeed) * 0.12;
        p.y += cos(uTime * 0.21 + aSeed * 1.7) * 0.16;
        p.z += sin(uTime * 0.18 + aSeed * 0.8) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vPulse = 0.55 + sin(uTime * 1.8 + aSeed) * 0.45;
        gl_PointSize = aSize * (0.78 + vPulse * 0.56) * uPixelRatio * (26.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uCyan;
      uniform vec3 uWhite;
      varying float vPulse;

      void main() {
        vec2 uv = gl_PointCoord.xy - 0.5;
        float d = dot(uv, uv);
        if (d > 0.25) discard;
        float core = smoothstep(0.08, 0.0, d);
        float halo = smoothstep(0.25, 0.0, d);
        vec3 color = mix(uCyan, uWhite, core * 0.75 + vPulse * 0.18);
        gl_FragColor = vec4(color, halo * (0.34 + core * 0.62));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  root.add(nodes);

  const linePairs = [];
  for (let i = 0; i < nodeCount; i++) {
    const candidates = [];
    for (let j = i + 1; j < nodeCount; j++) {
      const distance = basePositions[i].distanceTo(basePositions[j]);
      if (distance < 7.2) candidates.push({ index: j, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    candidates.slice(0, 3).forEach((candidate) => {
      if (Math.random() > 0.16) linePairs.push([i, candidate.index, rand(0, 100)]);
    });
  }

  const linePositions = new Float32Array(linePairs.length * 6);
  const lineSeeds = new Float32Array(linePairs.length * 2);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute("aSeed", new THREE.BufferAttribute(lineSeeds, 1));
  const lines = new THREE.LineSegments(lineGeometry, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x6eeeff) },
    },
    vertexShader: `
      attribute float aSeed;
      varying float vSeed;
      void main() {
        vSeed = aSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying float vSeed;
      void main() {
        float flicker = 0.34 + sin(uTime * 2.2 + vSeed) * 0.22 + sin(uTime * 6.1 + vSeed * 1.7) * 0.08;
        gl_FragColor = vec4(uColor, clamp(flicker, 0.08, 0.72));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  root.add(lines);

  const bokeh = [];
  for (let i = 0; i < 36; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bokehTexture,
      color: Math.random() > 0.72 ? 0xf7fbff : 0x73e7ff,
      transparent: true,
      opacity: rand(0.035, 0.16),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sprite.position.set(rand(-44, 42), rand(-20, 22), rand(-68, 15));
    sprite.scale.setScalar(rand(2.4, 15.5));
    sprite.userData = { seed: rand(0, 100), base: sprite.position.clone(), speed: rand(0.05, 0.18) };
    scene.add(sprite);
    bokeh.push(sprite);
  }

  const hazeLayers = [];
  for (let i = 0; i < 4; i++) {
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(75, 18),
      new THREE.MeshBasicMaterial({
        map: bokehTexture,
        color: 0x5ecbff,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    haze.position.set(rand(-22, 20), rand(2, 16), rand(-50, -18));
    haze.rotation.set(rand(-0.18, 0.18), rand(-0.22, 0.22), -0.45 + rand(-0.08, 0.08));
    scene.add(haze);
    hazeLayers.push(haze);
  }

  function createGlowTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const ctx = textureCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grad.addColorStop(0.2, "rgba(155, 242, 255, 0.52)");
    grad.addColorStop(1, "rgba(64, 182, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(textureCanvas);
  }

  const mouse = { x: 0, y: 0 };
  const parallax = { x: 0, y: 0 };
  const onMove = (event) => {
    mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = -(event.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("mousemove", onMove, { passive: true });

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    nodes.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
  };
  window.addEventListener("resize", onResize);

  function updateLines(time) {
    const nodeArray = nodeGeo.attributes.position.array;
    for (let i = 0; i < linePairs.length; i++) {
      const [a, b, seed] = linePairs[i];
      const ax = nodeArray[a * 3] + Math.sin(time * 0.24 + seed) * 0.12;
      const ay = nodeArray[a * 3 + 1] + Math.cos(time * 0.2 + seed) * 0.16;
      const az = nodeArray[a * 3 + 2] + Math.sin(time * 0.18 + seed) * 0.18;
      const bx = nodeArray[b * 3] + Math.sin(time * 0.24 + seed + 2.1) * 0.12;
      const by = nodeArray[b * 3 + 1] + Math.cos(time * 0.2 + seed + 1.3) * 0.16;
      const bz = nodeArray[b * 3 + 2] + Math.sin(time * 0.18 + seed + 0.9) * 0.18;
      const offset = i * 6;
      linePositions[offset] = ax;
      linePositions[offset + 1] = ay;
      linePositions[offset + 2] = az;
      linePositions[offset + 3] = bx;
      linePositions[offset + 4] = by;
      linePositions[offset + 5] = bz;
      lineSeeds[i * 2] = seed;
      lineSeeds[i * 2 + 1] = seed;
    }
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.aSeed.needsUpdate = true;
    lineGeometry.setDrawRange(0, Math.floor(linePairs.length * (0.68 + Math.sin(time * 0.42) * 0.18)) * 2);
  }

  function loop() {
    if (!_agRunning) return;
    _agAnimId = requestAnimationFrame(loop);
    const time = performance.now() * 0.001;
    backdropUniforms.uTime.value = time;
    nodes.material.uniforms.uTime.value = time;
    lines.material.uniforms.uTime.value = time;
    updateLines(time);

    parallax.x += (mouse.x * 0.95 - parallax.x) * 0.02;
    parallax.y += (mouse.y * 0.65 - parallax.y) * 0.02;
    camera.position.x = -7.4 + Math.sin(time * 0.095) * 1.5 + parallax.x;
    camera.position.y = 2.8 + Math.cos(time * 0.082) * 0.7 + parallax.y;
    camera.position.z = 29.5 - ((time * 0.55) % 5.8);
    camera.lookAt(10 + Math.sin(time * 0.07) * 1.2, 0.4, -17);

    root.rotation.y = -0.24 + Math.sin(time * 0.06) * 0.08;
    root.rotation.x = Math.sin(time * 0.045) * 0.025;
    cyanKey.position.x = 9 + Math.cos(time * 0.24) * 7;
    cyanKey.position.y = 7 + Math.sin(time * 0.2) * 2.2;
    whiteCore.position.z = -14 + Math.sin(time * 0.18) * 7;

    for (const sprite of bokeh) {
      sprite.position.x = sprite.userData.base.x + Math.sin(time * sprite.userData.speed + sprite.userData.seed) * 1.1;
      sprite.position.y = sprite.userData.base.y + Math.cos(time * sprite.userData.speed * 0.8 + sprite.userData.seed) * 0.9;
      sprite.material.opacity = 0.05 + Math.sin(time * 0.22 + sprite.userData.seed) * 0.035;
    }
    hazeLayers.forEach((haze, index) => {
      haze.material.opacity = 0.026 + Math.sin(time * 0.16 + index) * 0.012;
      haze.position.x += Math.sin(time * 0.05 + index) * 0.002;
    });

    renderer.render(scene, camera);
  }
  loop();

  window._agCleanup = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("resize", onResize);
    root.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    scene.traverse((object) => {
      if (object.material && object.parent !== root) object.material.dispose();
      if (object.geometry && object.parent !== root) object.geometry.dispose();
    });
    bokehTexture.dispose();
  };
}

function stopAntigravity() {
  _agRunning = false;
  if (_agAnimId) { cancelAnimationFrame(_agAnimId); _agAnimId = null; }
  if (_agRenderer) { _agRenderer.dispose(); _agRenderer = null; }
  if (window._agCleanup) { window._agCleanup(); window._agCleanup = null; }
  const c = $("#webgl-dashboard"); if (c) c.classList.add("hidden");
}

boot();
