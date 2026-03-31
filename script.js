/* ═══════════════════════════════════════════════════════════
   CourseMap v2 — script.js
   Features:
    • Per-day different lecture timings
    • Indian holidays 2025 & 2026
    • Excluded date-range periods (midterms, exams, breaks)
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UNIT_COLORS = ['uc-0', 'uc-1', 'uc-2', 'uc-3', 'uc-4', 'uc-5'];
const ROW_TINTS = ['tr-0', 'tr-1', 'tr-2', 'tr-3', 'tr-4', 'tr-5'];
const PILL_BG = ['#e8a430', '#3aada8', '#d45a3a', '#5ab87a', '#9b7fe8', '#e87a9b'];

// ── STATE ──────────────────────────────────────────────────
// dayConfig[i] = { enabled: bool, startTime: 'HH:MM', durationMins: number }
let dayConfig = [
  { enabled: false, startTime: '09:00', durationMins: 60 }, // Sun
  { enabled: true, startTime: '09:00', durationMins: 60 }, // Mon
  { enabled: true, startTime: '10:00', durationMins: 60 }, // Tue
  { enabled: true, startTime: '09:00', durationMins: 60 }, // Wed
  { enabled: true, startTime: '11:00', durationMins: 60 }, // Thu
  { enabled: true, startTime: '10:00', durationMins: 60 }, // Fri
  { enabled: false, startTime: '09:00', durationMins: 60 }, // Sat
];

let holidays = {};  // { 'YYYY-MM-DD': 'Name' }
let excludePeriods = [];  // [{ id, label, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }]
let units = [];
let unitIdCounter = 0;
let periodIdCounter = 0;

// ── INIT ───────────────────────────────────────────────────
window.onload = () => {
  setDefaultDates();
  renderDayTimings();
  // default units
  addUnit('Unit I', 'Introduction & Fundamentals', 10);
  addUnit('Unit II', 'Core Concepts & Theory', 12);
  addUnit('Unit III', 'Advanced Topics', 14);
  addUnit('Unit IV', 'Applications & Case Studies', 10);
  addUnit('Unit V', 'Review & Problem Solving', 8);
  updateTotalHrs();
  
  document.getElementById('startDate').addEventListener('change', updateAvailabilitySummary);
  document.getElementById('endDate').addEventListener('change', updateAvailabilitySummary);
  
  // Initial calculation
  updateAvailabilitySummary();
  
  // Restore theme
  const savedTheme = localStorage.getItem('coursemap_theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    updateThemeIcon('light');
  }
};

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.getAttribute('data-theme') === 'light';
  
  if (isLight) {
    root.removeAttribute('data-theme');
    localStorage.setItem('coursemap_theme', 'dark');
    updateThemeIcon('dark');
  } else {
    root.setAttribute('data-theme', 'light');
    localStorage.setItem('coursemap_theme', 'light');
    updateThemeIcon('light');
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (theme === 'light') {
    // Moon icon for switching to dark
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  } else {
    // Sun icon for switching to light
    icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  }
}

function setDefaultDates() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  document.getElementById('startDate').value = isoDate(new Date(y, m, 1));
  document.getElementById('endDate').value = isoDate(new Date(y, m + 4, 30));
}

// ── DATE UTILS ─────────────────────────────────────────────
function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function fmtDisplay(d) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addMins(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isExcluded(dateStr) {
  if (holidays[dateStr]) return true;
  const d = parseDateLocal(dateStr);
  for (const p of excludePeriods) {
    const from = parseDateLocal(p.from);
    const to = parseDateLocal(p.to);
    if (d >= from && d <= to) return true;
  }
  return false;
}

// ── DYNAMIC SUMMARY ────────────────────────────────────────
function updateAvailabilitySummary() {
  const startStr = document.getElementById('startDate').value;
  const endStr = document.getElementById('endDate').value;
  const summaryEl = document.getElementById('availabilitySummary');

  if (!summaryEl) return;

  if (!startStr || !endStr || startStr > endStr) {
    summaryEl.style.display = 'none';
    return;
  }

  const start = parseDateLocal(startStr);
  const end = parseDateLocal(endStr);
  
  let totalMins = 0;
  let excludedMins = 0;
  let availableMins = 0;

  let cur = new Date(start);
  while (cur <= end) {
    const ds = isoDate(cur);
    const dow = cur.getDay();
    const cfg = dayConfig[dow];
    
    if (cfg.enabled) {
      totalMins += cfg.durationMins;
      if (isExcluded(ds)) {
        excludedMins += cfg.durationMins;
      } else {
        availableMins += cfg.durationMins;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  const availHrs = (availableMins / 60).toFixed(1);
  const exclHrs = (excludedMins / 60).toFixed(1);

  summaryEl.style.display = 'block';
  document.getElementById('availHrsText').innerText = availHrs;
  document.getElementById('exclHrsText').innerText = exclHrs;
}

// ── DAY TIMING UI ──────────────────────────────────────────
function renderDayTimings() {
  const wrap = document.getElementById('dayTimingGrid');
  wrap.innerHTML = '';
  DAY_NAMES.forEach((name, i) => {
    const cfg = dayConfig[i];
    const slot = document.createElement('div');
    slot.className = 'day-slot' + (cfg.enabled ? ' active' : ' disabled');
    slot.id = `ds-${i}`;
    slot.innerHTML = `
      <div class="day-slot-head">
        <span class="day-name">${name}</span>
        <input type="checkbox" class="day-toggle-cb" id="dtcb-${i}"
          ${cfg.enabled ? 'checked' : ''}
          onchange="toggleDay(${i}, this.checked)">
      </div>
      <div>
        <div class="day-time-label">Start Time</div>
        <input type="time" id="dt-start-${i}" value="${cfg.startTime}"
          ${cfg.enabled ? '' : 'disabled'}
          oninput="dayConfig[${i}].startTime = this.value">
      </div>
      <div>
        <div class="day-time-label">Duration (min)</div>
        <input type="number" id="dt-dur-${i}" value="${cfg.durationMins}"
          min="15" max="360" step="5"
          style="font-family:var(--mono);font-size:0.72rem;background:var(--bg);border:1px solid var(--border);border-bottom:2px solid var(--border2);color:var(--text);padding:5px 6px;width:100%;outline:none;"
          ${cfg.enabled ? '' : 'disabled'}
          oninput="dayConfig[${i}].durationMins = parseInt(this.value)||60; updateAvailabilitySummary()">
      </div>`;
    wrap.appendChild(slot);
  });
}

function toggleDay(i, enabled) {
  dayConfig[i].enabled = enabled;
  const slot = document.getElementById(`ds-${i}`);
  const startIn = document.getElementById(`dt-start-${i}`);
  const durIn = document.getElementById(`dt-dur-${i}`);
  slot.classList.toggle('active', enabled);
  slot.classList.toggle('disabled', !enabled);
  startIn.disabled = !enabled;
  durIn.disabled = !enabled;
  updateAvailabilitySummary();
}

function applyAllSameTime() {
  const refStart = document.getElementById('dt-start-1').value || '09:00';
  const refDur = parseInt(document.getElementById('dt-dur-1').value) || 60;
  dayConfig.forEach((cfg, i) => {
    if (cfg.enabled) {
      cfg.startTime = refStart;
      cfg.durationMins = refDur;
      const s = document.getElementById(`dt-start-${i}`);
      const d = document.getElementById(`dt-dur-${i}`);
      if (s) s.value = refStart;
      if (d) d.value = refDur;
    }
  });
  updateAvailabilitySummary();
}

// ── HOLIDAYS ───────────────────────────────────────────────
function addHoliday() {
  const dEl = document.getElementById('hDate');
  const nEl = document.getElementById('hName');
  if (!dEl.value) { showAlert('Select a holiday date.'); return; }
  holidays[dEl.value] = nEl.value.trim() || 'Holiday';
  dEl.value = '';
  nEl.value = '';
  renderHolidayTags();
  updateAvailabilitySummary();
}

function removeHoliday(date) {
  delete holidays[date];
  renderHolidayTags();
  updateAvailabilitySummary();
}

function renderHolidayTags() {
  const c = document.getElementById('holidayTags');
  const keys = Object.keys(holidays).sort();
  if (!keys.length) {
    c.innerHTML = '<span class="tag-empty">No holidays added</span>';
    return;
  }
  c.innerHTML = '';
  keys.forEach(date => {
    const d = parseDateLocal(date);
    const tag = document.createElement('span');
    tag.className = 'tag holiday-tag';
    tag.innerHTML = `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${holidays[date]}
      <span class="x" onclick="removeHoliday('${date}')">✕</span>`;
    c.appendChild(tag);
  });
}

function loadHolidays(year) {
  const h = {
    2025: {
      '2025-01-14': 'Makar Sankranti',
      '2025-01-26': 'Republic Day',
      '2025-02-26': 'Maha Shivratri',
      '2025-03-17': 'Holi',
      '2025-03-31': 'Id-ul-Fitr (Eid)',
      '2025-04-14': 'Dr. Ambedkar Jayanti / Baisakhi',
      '2025-04-18': 'Good Friday',
      '2025-05-01': 'Maharashtra Day / Labour Day',
      '2025-08-15': 'Independence Day',
      '2025-08-27': 'Janmashtami',
      '2025-09-05': 'Ganesh Chaturthi',
      '2025-10-02': 'Gandhi Jayanti',
      '2025-10-02': 'Dussehra',
      '2025-10-20': 'Dussehra',
      '2025-10-20': 'Diwali Eve',
      '2025-10-21': 'Diwali (Laxmi Puja)',
      '2025-10-23': 'Bhai Dooj',
      '2025-11-05': 'Guru Nanak Jayanti',
      '2025-12-25': 'Christmas Day',
    },
    2026: {
      '2026-01-14': 'Makar Sankranti',
      '2026-01-26': 'Republic Day',
      '2026-02-15': 'Maha Shivratri',
      '2026-03-20': 'Holi',
      '2026-03-21': 'Holi (2nd Day)',
      '2026-04-03': 'Good Friday',
      '2026-04-14': 'Dr. Ambedkar Jayanti / Baisakhi',
      '2026-05-01': 'Maharashtra Day / Labour Day',
      '2026-06-17': 'Eid al-Adha (Bakrid)',
      '2026-08-15': 'Independence Day',
      '2026-08-16': 'Janmashtami',
      '2026-09-19': 'Ganesh Chaturthi',
      '2026-10-02': 'Gandhi Jayanti',
      '2026-10-09': 'Dussehra',
      '2026-10-28': 'Diwali (Laxmi Puja)',
      '2026-10-30': 'Bhai Dooj',
      '2026-11-25': 'Guru Nanak Jayanti',
      '2026-12-25': 'Christmas Day',
    }
  };
  const selected = h[year] || {};
  Object.assign(holidays, selected);
  renderHolidayTags();
  updateAvailabilitySummary();
}

// ── EXCLUDE PERIODS ────────────────────────────────────────
function addPeriod() {
  const lEl = document.getElementById('pLabel');
  const fEl = document.getElementById('pFrom');
  const tEl = document.getElementById('pTo');
  if (!fEl.value || !tEl.value) { showAlert('Select both From and To dates for the excluded period.'); return; }
  if (fEl.value > tEl.value) { showAlert('"From" date must be before "To" date.'); return; }
  const label = lEl.value.trim() || 'Excluded Period';
  excludePeriods.push({ id: periodIdCounter++, label, from: fEl.value, to: tEl.value });
  lEl.value = '';
  fEl.value = '';
  tEl.value = '';
  renderPeriodTags();
  updateAvailabilitySummary();
}

function removePeriod(id) {
  excludePeriods = excludePeriods.filter(p => p.id !== id);
  renderPeriodTags();
  updateAvailabilitySummary();
}

function renderPeriodTags() {
  const c = document.getElementById('periodTags');
  if (!excludePeriods.length) {
    c.innerHTML = '<span class="tag-empty">No periods excluded</span>';
    return;
  }
  c.innerHTML = '';
  excludePeriods.forEach(p => {
    const f = parseDateLocal(p.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const t = parseDateLocal(p.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const tag = document.createElement('span');
    tag.className = 'tag period-tag';
    tag.innerHTML = `${p.label}: ${f} – ${t}
      <span class="x" onclick="removePeriod(${p.id})">✕</span>`;
    c.appendChild(tag);
  });
}

// ── UNITS ──────────────────────────────────────────────────
function addUnit(name = '', topics = '', hours = '') {
  units.push({ id: unitIdCounter++, name, topics, hours });
  renderUnits();
}

function removeUnit(id) {
  units = units.filter(u => u.id !== id);
  renderUnits();
}

function renderUnits() {
  const list = document.getElementById('unitsList');
  list.innerHTML = '';
  units.forEach((u, idx) => {
    const row = document.createElement('div');
    row.className = 'unit-entry';
    const colorStyle = `border-left-color:${PILL_BG[idx % PILL_BG.length]}`;
    row.style.cssText = colorStyle;
    row.innerHTML = `
      <div class="unit-num">${String(idx + 1).padStart(2, '0')}</div>
      <div class="fg">
        <label>Unit Name</label>
        <input type="text" placeholder="Unit ${idx + 1}" value="${escHtml(u.name)}"
          oninput="units[${idx}].name=this.value">
      </div>
      <div class="fg">
        <label>Topics (Time required). E.g. Topic A (2)</label>
        <input type="text" placeholder="Topic A, Topic B (2.5), Topic C…" value="${escHtml(u.topics)}"
          oninput="units[${idx}].topics=this.value">
      </div>
      <div class="fg">
        <label>Hours</label>
        <input type="number" min="1" max="999" placeholder="hrs" value="${u.hours}"
          oninput="units[${idx}].hours=this.value;updateTotalHrs()">
      </div>
      <div style="display:flex;align-items:flex-end;padding-bottom:2px;">
        <button class="btn btn-red" onclick="removeUnit(${u.id})">✕</button>
      </div>`;
    list.appendChild(row);
  });
  updateTotalHrs();
}

function updateTotalHrs() {
  const total = units.reduce((s, u) => s + (parseFloat(u.hours) || 0), 0);
  const el = document.getElementById('totalHrsDisplay');
  if (el) el.textContent = total + ' hrs total';
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── GENERATE PLAN ──────────────────────────────────────────
function generatePlan() {
  const subject = document.getElementById('subjectName').value.trim();
  const teacher = document.getElementById('teacherName').value.trim();
  const term = document.getElementById('termName').value.trim();
  const startStr = document.getElementById('startDate').value;
  const endStr = document.getElementById('endDate').value;

  if (!subject) { showAlert('Please enter a subject name.'); return; }
  if (!startStr || !endStr) { showAlert('Please select start and end dates.'); return; }
  if (startStr > endStr) { showAlert('"Start Date" must be before "End Date".'); return; }

  const enabledDays = dayConfig.filter(d => d.enabled);
  if (!enabledDays.length) { showAlert('Please enable at least one working day.'); return; }

  const validUnits = units.filter(u => u.name.trim() && parseFloat(u.hours) > 0);
  if (!validUnits.length) { showAlert('Please add at least one unit with a name and hours.'); return; }

  // ── Build available teaching slots ──────────────────────
  const slots = [];   // { date: Date, dateStr, startTime, durationMins }
  const start = parseDateLocal(startStr);
  const end = parseDateLocal(endStr);
  let cur = new Date(start);
  while (cur <= end) {
    const ds = isoDate(cur);
    const dow = cur.getDay();
    const cfg = dayConfig[dow];
    if (cfg.enabled && !isExcluded(ds)) {
      slots.push({
        date: new Date(cur),
        dateStr: ds,
        startTime: cfg.startTime,
        durationMins: cfg.durationMins
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (!slots.length) {
    showAlert('No teaching days available in the selected range after applying exclusions.');
    return;
  }

  const totalHrs = validUnits.reduce((s, u) => s + parseFloat(u.hours), 0);

  // ── Distribute sessions ─────────────────────────────────
  const sessions = [];
  let slotIdx = 0;
  let sessionNum = 0;

  let cumHrs = 0;
  let ranOutOfTime = false;
  let uncoveredList = [];

  for (let ui = 0; ui < validUnits.length; ui++) {
    const u = validUnits[ui];
    let remHrs = parseFloat(u.hours);
    let sesInUnit = 0;

    let topics = parseTopics(u.topics || u.name, remHrs);
    let tIdx = 0;
    let tRem = topics[0] ? topics[0].hrs : remHrs;

    while (remHrs > 0.001) {
      if (slotIdx >= slots.length) {
        ranOutOfTime = true;
        if (tRem > 0.001 && tIdx < topics.length) {
          uncoveredList.push({ unitName: u.name, topic: topics[tIdx].name, hrs: tRem });
        }
        for (let i = tIdx + 1; i < topics.length; i++) {
          uncoveredList.push({ unitName: u.name, topic: topics[i].name, hrs: topics[i].hrs });
        }
        break;
      }
      const slot = slots[slotIdx++];
      const slotHrs = slot.durationMins / 60;
      const thisHrs = Math.min(slotHrs, remHrs);

      let cover = thisHrs;
      let sesNames = [];

      while (cover > 0.001 && tIdx < topics.length) {
        if (tRem <= 0.001) {
          tIdx++;
          if (tIdx < topics.length) {
            tRem = topics[tIdx].hrs;
          } else {
            break;
          }
          continue;
        }
        let take = Math.min(cover, tRem);
        let n = topics[tIdx].name;
        if (topics[tIdx].hrs > 0 && tRem < topics[tIdx].hrs - 0.001) {
          n += ' (cont.)';
        }
        sesNames.push(n);
        cover -= take;
        tRem -= take;
      }

      if (cover > 0.001 && topics.length > 0) {
        sesNames.push(topics[topics.length - 1].name + ' (cont.)');
      }

      const topicStr = [...new Set(sesNames)].join(' + ');

      cumHrs += thisHrs;
      const cumPct = (cumHrs / totalHrs) * 100;

      sessions.push({
        num: ++sessionNum,
        date: slot.date,
        dateStr: slot.dateStr,
        startTime: slot.startTime,
        endTime: addMins(slot.startTime, slot.durationMins),
        durationMins: slot.durationMins,
        unitIdx: ui,
        unitName: u.name,
        topic: topicStr,
        hours: thisHrs,
        cumPct: cumPct,
        isFirst: sesInUnit === 0
      });

      remHrs -= thisHrs;
      sesInUnit++;
    }

    if (ranOutOfTime) {
      for (let nextUi = ui + 1; nextUi < validUnits.length; nextUi++) {
        const nu = validUnits[nextUi];
        const nTopics = parseTopics(nu.topics || nu.name, parseFloat(nu.hours));
        nTopics.forEach(nt => {
          uncoveredList.push({ unitName: nu.name, topic: nt.name, hrs: nt.hrs });
        });
      }
      break;
    }
  }

  // ── Count excluded days ─────────────────────────────────
  const hCount = Object.keys(holidays).length;
  const pCount = excludePeriods.reduce((s, p) => {
    let cnt = 0;
    const f = parseDateLocal(p.from), t = parseDateLocal(p.to);
    let d = new Date(f);
    while (d <= t) { cnt++; d.setDate(d.getDate() + 1); }
    return s + cnt;
  }, 0);

  // ── Render ──────────────────────────────────────────────
  renderStats(sessions.length, totalHrs, slots.length, hCount, excludePeriods.length);
  renderTable(sessions);

  const remUi = document.getElementById('remainingAlert');
  if (uncoveredList.length > 0) {
    const totalUncoveredHrs = uncoveredList.reduce((s, t) => s + t.hrs, 0);
    const coveredPcnt = ((totalHrs - totalUncoveredHrs) / totalHrs) * 100;

    let html = `<div class="card" style="border-left: 3px solid var(--red); background: rgba(212,90,58,0.05); margin-bottom:18px;">
        <h3 style="color:var(--red); font-family:var(--serif); font-size:1.1rem; margin-bottom:8px;">⚠️ Syllabus Not Completed</h3>
        <p style="font-family:var(--mono); font-size:0.7rem; color:var(--text2); margin-bottom:12px;">
          Ran out of available teaching days! Overall completed: <strong style="color:var(--text);">${coveredPcnt.toFixed(1)}%</strong>. 
          Remaining topics require <strong>${totalUncoveredHrs.toFixed(1)}</strong> more teaching hours.
        </p>
        <div style="display:grid; grid-template-columns:1fr; gap:6px;">
      `;
    uncoveredList.forEach(t => {
      html += `<div style="display:flex; justify-content:space-between; padding:8px 12px; background:var(--surface); border:1px solid var(--border); border-radius:2px;">
             <span style="font-size:0.8rem; color:var(--text2);"><span class="unit-pill" style="margin-right:8px; border:1px solid var(--border2); color:var(--text);">${escHtml(t.unitName)}</span> ${escHtml(t.topic)}</span>
             <span style="font-family:var(--mono); font-size:0.65rem; color:var(--red); white-space:nowrap; margin-left:12px;">${t.hrs.toFixed(1)} hrs needed</span>
          </div>`;
    });
    html += `</div></div>`;
    remUi.innerHTML = html;
    remUi.style.display = 'block';
  } else {
    if (remUi) remUi.style.display = 'none';
  }

  document.getElementById('planTitle').textContent = subject + ' — Course Plan';
  document.getElementById('planMeta').innerHTML =
    `${escHtml(term || '')} · ${escHtml(teacher || 'Faculty')}<br>${startStr} to ${endStr}`;

  const out = document.getElementById('outputSection');
  out.style.display = 'block';
  setTimeout(() => out.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function parseTopics(str, totalHrs) {
  const parts = (str || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) parts.push(str || 'Topic');

  let topics = [];
  let specified = 0;
  let unspecCount = 0;

  parts.forEach(txt => {
    const m = txt.match(/(?:(?:\[|\()([\d.]+)(?:\]|\))|:\s*([\d.]+))(?:hrs|h|hours)?\s*$/i);
    if (m) {
      const h = parseFloat(m[1] || m[2]);
      topics.push({ name: txt.substring(0, m.index).trim(), hrs: h });
      specified += h;
    } else {
      topics.push({ name: txt, hrs: 0 });
      unspecCount++;
    }
  });

  const remaining = Math.max(0, totalHrs - specified);
  if (unspecCount > 0) {
    const each = remaining / unspecCount;
    topics.forEach(t => { if (!t.hrs) t.hrs = each; });
  }
  return topics;
}

// ── RENDER STATS ───────────────────────────────────────────
function renderStats(sessions, totalHrs, availDays, hCount, pCount) {
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-val">${sessions}</div>
      <div class="stat-lbl">Teaching Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${totalHrs.toFixed(0)}</div>
      <div class="stat-lbl">Teaching Hours</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${availDays}</div>
      <div class="stat-lbl">Available Days</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${hCount}</div>
      <div class="stat-lbl">Holidays Excluded</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${pCount}</div>
      <div class="stat-lbl">Exam Periods Excluded</div>
    </div>`;
}

// ── RENDER TABLE ───────────────────────────────────────────
function renderTable(sessions) {
  const tbody = document.getElementById('planBody');
  tbody.innerHTML = '';
  sessions.forEach(s => {
    const tr = document.createElement('tr');
    const ci = s.unitIdx % PILL_BG.length;
    tr.className = ROW_TINTS[ci] + (s.isFirst ? ' unit-first' : '');
    tr.innerHTML = `
      <td class="td-num">${String(s.num).padStart(2, '0')}</td>
      <td class="td-date">${fmtDisplay(s.date)}</td>
      <td class="td-day">${DAY_NAMES[s.date.getDay()]}</td>
      <td class="td-time">${s.startTime} – ${s.endTime}<br>
        <span style="font-size:0.58rem;color:var(--muted);">${s.durationMins} min</span>
      </td>
      <td>
        <span class="unit-pill ${UNIT_COLORS[ci]}">${escHtml(s.unitName)}</span>
      </td>
      <td class="topic-cell">${escHtml(s.topic)}</td>
      <td><span class="hrs-pill">${s.hours.toFixed(1)}h</span></td>
      <td style="min-width:70px;">
        <div style="font-family:var(--mono);font-size:0.6rem;color:var(--text);margin-bottom:2px;">${s.cumPct.toFixed(1)}%</div>
        <div style="width:100%;height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="width:${s.cumPct}%;height:100%;background:var(--amber);"></div>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ── EXPORT CSV ─────────────────────────────────────────────
function exportCSV() {
  const rows = [['#', 'Date', 'Day', 'Start', 'End', 'Duration(min)', 'Unit', 'Topic', 'Hours', 'Progress(%)']];
  document.querySelectorAll('#planBody tr').forEach(tr => {
    const td = [...tr.querySelectorAll('td')];
    if (td.length < 7) return;
    const timeCell = td[3].innerText.split('\n');
    const times = (timeCell[0] || '').split('–');
    rows.push([
      td[0].textContent.trim(),
      td[1].textContent.trim(),
      td[2].textContent.trim(),
      (times[0] || '').trim(),
      (times[1] || '').trim(),
      (timeCell[1] || '').replace('min', '').trim(),
      td[4].textContent.trim(),
      td[5].textContent.trim(),
      td[6].textContent.trim(),
      td[7].textContent.trim().replace('%', '')
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `course_plan_${document.getElementById('subjectName').value.replace(/\s+/g, '_') || 'export'}.csv`;
  a.click();
}

// ── UTILITIES ──────────────────────────────────────────────
function showAlert(msg) {
  const el = document.getElementById('alertBox');
  el.textContent = '⚠  ' + msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4500);
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function resetAll() {
  document.getElementById('subjectName').value = '';
  document.getElementById('teacherName').value = '';
  document.getElementById('termName').value = '';
  holidays = {};
  excludePeriods = [];
  units = [];
  unitIdCounter = 0;
  periodIdCounter = 0;
  renderHolidayTags();
  renderPeriodTags();
  renderUnits();
  document.getElementById('outputSection').style.display = 'none';
}

function loadSampleData() {
  document.getElementById('subjectName').value = 'Data Structures & Algorithms';
  document.getElementById('teacherName').value = 'Prof. Anjali Sharma';
  document.getElementById('termName').value = 'Semester III — Jan to May 2026';
  document.getElementById('startDate').value = '2026-01-05';
  document.getElementById('endDate').value = '2026-05-15';

  // Per-day timings (Mon-Fri different)
  dayConfig = [
    { enabled: false, startTime: '09:00', durationMins: 60 },
    { enabled: true, startTime: '09:00', durationMins: 60 },  // Mon
    { enabled: true, startTime: '11:00', durationMins: 90 },  // Tue — 90-min lecture
    { enabled: true, startTime: '09:00', durationMins: 60 },  // Wed
    { enabled: true, startTime: '14:00', durationMins: 60 },  // Thu — afternoon
    { enabled: true, startTime: '10:00', durationMins: 45 },  // Fri — shorter
    { enabled: false, startTime: '09:00', durationMins: 60 },
  ];
  renderDayTimings();

  holidays = {};
  loadHolidays(2026);

  excludePeriods = [];
  periodIdCounter = 0;
  excludePeriods.push({ id: periodIdCounter++, label: 'Mid-Semester Exam', from: '2026-03-02', to: '2026-03-07' });
  excludePeriods.push({ id: periodIdCounter++, label: 'Study Break', from: '2026-04-13', to: '2026-04-17' });
  excludePeriods.push({ id: periodIdCounter++, label: 'End-Sem Exams', from: '2026-05-04', to: '2026-05-15' });
  renderPeriodTags();

  units = [];
  unitIdCounter = 0;
  addUnit('Unit I', 'Complexity Analysis, Arrays, Strings, Two-Pointer technique', 12);
  addUnit('Unit II', 'Linked Lists, Stacks, Queues, Monotonic Stack', 14);
  addUnit('Unit III', 'Binary Trees, BST, AVL Trees, Heaps, Tries', 16);
  addUnit('Unit IV', 'Graphs — BFS, DFS, Dijkstra, Bellman-Ford, MST', 14);
  addUnit('Unit V', 'Sorting — Merge, Quick, Heap, Counting, Radix', 10);
  addUnit('Unit VI', 'Dynamic Programming, Memoization, Backtracking', 12);
  renderUnits();
  
  updateAvailabilitySummary();
}
