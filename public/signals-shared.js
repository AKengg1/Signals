/* signals-shared.js — loaded by every page */

// ── API ──────────────────────────────────────
const API_BASE = sessionStorage.getItem('signals_api') || 'http://localhost:3000';

async function api(path, options = {}) {
  const token = sessionStorage.getItem('signals_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(API_BASE + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  } catch (e) {
    if (e.message.includes('fetch') || e.message.includes('Failed') || e.message.includes('NetworkError')) return null;
    throw e;
  }
}

// ── Auth helpers ─────────────────────────────
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('signals_user') || 'null'); } catch { return null; }
}
function setSession(token, user) {
  sessionStorage.setItem('signals_token', token);
  sessionStorage.setItem('signals_user', JSON.stringify(user));
}
function clearSession() {
  sessionStorage.removeItem('signals_token');
  sessionStorage.removeItem('signals_user');
}
function requireAuth(role) {
  const u = getUser();
  if (!u) { window.location.href = 'auth.html'; return null; }
  if (role && u.role !== role && u.role !== 'admin') { window.location.href = 'auth.html'; return null; }
  return u;
}
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Toast ────────────────────────────────────
function toast(msg, type = 'success') {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toastWrap'; wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" width="15" height="15"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  el.innerHTML = icon + msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Modal ────────────────────────────────────
function openModal(title, body, btns = []) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFtr').innerHTML = btns.map(b => `<button class="btn ${b.cls}" onclick="${b.fn}">${b.label}</button>`).join('');
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ── Skill bar renderer ────────────────────────
function renderSkillBars(containerId, skills) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const colors = ['var(--cyan)', 'var(--green)', 'var(--violet)', 'var(--amber)', 'var(--red)'];
  el.innerHTML = skills.map((s, i) => {
    const name = s.name || s;
    const pct = s.proficiency || Math.floor(Math.random() * 30 + 60);
    return `<div class="skill-bar-wrap">
      <div class="skill-bar-header"><span>${name}</span><span>${pct}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:0%;background:${colors[i % colors.length]}" data-w="${pct}"></div></div>
    </div>`;
  }).join('');
  setTimeout(() => { el.querySelectorAll('.bar-fill').forEach(b => b.style.width = b.dataset.w + '%'); }, 100);
}

// ── Badge renderer ────────────────────────────
const BADGES = [
  { emoji: '🏆', name: 'Top Dev',    earned: true  },
  { emoji: '⚡', name: 'Fast Coder', earned: true  },
  { emoji: '🎯', name: 'Precision',  earned: true  },
  { emoji: '🌟', name: 'Legend',     earned: false },
  { emoji: '🔥', name: 'Streak',     earned: false },
  { emoji: '💎', name: 'Diamond',    earned: false },
];
function renderBadges(containerId, badges) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = badges.map(b => `<div class="badge-item ${b.earned ? 'earned' : ''}">
    <div class="bi-icon" style="${b.earned ? '' : 'opacity:.3'}">${b.emoji}</div>
    <div class="bi-name">${b.name}</div>
  </div>`).join('');
}

// ── Project card builder ──────────────────────
const TAG_COLORS = ['tag-cyan', 'tag-violet', 'tag-amber', 'tag-green', 'tag-red'];
function renderProjectGrid(containerId, projects, linkToModal = true) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!projects.length) {
    el.innerHTML = `<div class="loading-block" style="grid-column:1/-1;color:var(--text2)">No projects yet.</div>`;
    return;
  }
  el.innerHTML = projects.map(p => {
    const skills = (p.skills || []).slice(0, 3).map((s, i) => `<span class="tag ${TAG_COLORS[i % 5]}">${s.name || s}</span>`).join('');
    const statusTag = p.status === 'pending' ? `<span class="tag tag-amber">Under review</span>` : '';
    const clickFn = linkToModal ? `openProjectModal(${JSON.stringify(p).replace(/"/g, '&quot;')})` : '';
    return `<div class="proj-card" onclick="${clickFn}">
      <div class="proj-thumb">${p.emoji || '🚀'}</div>
      <div class="proj-body">
        <h4>${p.title}</h4>
        <p>${p.description}</p>
        <div class="tags-row" style="margin-bottom:8px">${skills}${statusTag}</div>
        <div class="proj-footer">
          <div class="pts-pill"><svg viewBox="0 0 24 24" fill="var(--amber)" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${p.merit_points || 0} pts</div>
          <div style="display:flex;gap:8px">
            ${p.github_url ? `<a href="${p.github_url}" onclick="event.stopPropagation()" style="font-size:11px;color:var(--text2)" target="_blank">GitHub</a>` : ''}
            ${p.demo_url   ? `<a href="${p.demo_url}"   onclick="event.stopPropagation()" style="font-size:11px;color:var(--cyan)" target="_blank">Live</a>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openProjectModal(p) {
  if (typeof p === 'string') p = JSON.parse(p);
  const skills = (p.skills || []).map((s, i) => `<span class="tag ${TAG_COLORS[i % 5]}">${s.name || s}</span>`).join('');
  openModal(p.title, `
    <div style="text-align:center;font-size:48px;padding:20px;background:var(--bg3);border-radius:var(--r);margin-bottom:16px">${p.emoji || '🚀'}</div>
    <div class="tags-row" style="margin-bottom:12px">${skills}</div>
    <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">${p.description}</p>
    <div style="display:flex;gap:16px;font-size:13px;padding-top:14px;border-top:1px solid var(--line)">
      <span style="color:var(--amber);font-weight:700">+${p.merit_points || 0} merit points</span>
      <span class="status-pill status-${p.status}">${p.status}</span>
    </div>
  `, [
    { label: 'Close', cls: 'btn-outline', fn: 'closeModal()' },
    ...(p.github_url ? [{ label: 'View on GitHub', cls: 'btn-primary', fn: `window.open('${p.github_url}','_blank');closeModal()` }] : [])
  ]);
}

// ── Candidate card builder ────────────────────
function renderCandidatesGrid(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!list.length) { el.innerHTML = `<div class="loading-block" style="grid-column:1/-1">No candidates found.</div>`; return; }
  el.innerHTML = list.map(c => {
    const topSkills = (c.skills || []).slice(0, 3).map(s => `<span class="tag tag-violet">${s.name || s}</span>`).join('');
    return `<div class="cand-card" onclick="openCandidateModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">
      <div class="cand-hdr">
        <div class="av av-md ${c.avatar_color || 'av-cyan'}" style="font-size:13px">${(c.anonymous_code || '??').slice(0, 2)}</div>
        <div>
          <div style="font-size:14px;font-weight:600;font-family:var(--font-display)">Candidate #${c.anonymous_code}</div>
          <div style="font-size:12px;color:var(--text2)">Rank #${c.global_rank || '—'} · ${c.project_count || 0} projects</div>
        </div>
        <span class="anon-badge">Anonymous</span>
      </div>
      <div class="tags-row">${topSkills}</div>
      <div class="cand-actions">
        <div class="pts-pill"><svg viewBox="0 0 24 24" fill="var(--amber)" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${(c.merit_points || 0).toLocaleString()}</div>
        <button class="btn btn-sm btn-outline" style="margin-left:auto" onclick="event.stopPropagation();toggleShortlist('${c.anonymous_code}',this)">Shortlist</button>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();goToMessages()">Message</button>
      </div>
    </div>`;
  }).join('');
}

function openCandidateModal(c) {
  if (typeof c === 'string') c = JSON.parse(c);
  const skills = (c.skills || []).map(s => `<span class="tag tag-violet">${s.name || s}</span>`).join('');
  openModal('Candidate #' + c.anonymous_code, `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
      <div class="av av-lg ${c.avatar_color || 'av-cyan'}" style="font-size:18px">${(c.anonymous_code || '??').slice(0, 2)}</div>
      <div>
        <div style="font-family:var(--font-display);font-size:16px;font-weight:700">Candidate #${c.anonymous_code}</div>
        <div style="font-size:12px;color:var(--green);margin-top:4px">✓ Anonymous — merit-based only</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--bg3);border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2);margin-bottom:4px">Rank</div><div style="font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--cyan)">#${c.global_rank || '—'}</div></div>
      <div style="background:var(--bg3);border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2);margin-bottom:4px">Points</div><div style="font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--amber)">${(c.merit_points || 0).toLocaleString()}</div></div>
      <div style="background:var(--bg3);border-radius:var(--r);padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2);margin-bottom:4px">Projects</div><div style="font-family:var(--font-display);font-size:20px;font-weight:700">${c.project_count || 0}</div></div>
    </div>
    <div class="tags-row" style="margin-bottom:16px">${skills}</div>
    <div style="font-size:11px;color:var(--text3);padding-top:14px;border-top:1px solid var(--line)">College, location, and personal details are hidden to ensure unbiased evaluation.</div>
  `, [
    { label: 'Close', cls: 'btn-outline', fn: 'closeModal()' },
    { label: 'Shortlist', cls: 'btn-green', fn: `toggleShortlist('${c.anonymous_code}',{textContent:'',className:''});closeModal()` },
    { label: 'Message', cls: 'btn-primary', fn: `closeModal();goToMessages()` }
  ]);
}

// ── Demo data ─────────────────────────────────
const DEMO = {
  student:   { id:1, email:'student@demo.com', role:'student',   full_name:'Arjun Kapoor',  anonymous_code:'A-047', merit_points:2840, global_rank:47, level:7, xp:2840, bio:'Full-stack developer passionate about building products.' },
  recruiter: { id:2, email:'recruiter@demo.com', role:'recruiter', full_name:'Priya Mehta',   company_name:'TechMate Solutions' },
  admin:     { id:3, email:'admin@demo.com',     role:'admin',     full_name:'Admin' },
};
const DEMO_PROJECTS = [
  { id:1, title:'E-commerce Dashboard',  description:'React + Node.js admin panel with real-time analytics.', skills:['React','Node.js','PostgreSQL'], merit_points:480, emoji:'🛒', github_url:'#', status:'approved' },
  { id:2, title:'ML Price Predictor',    description:'Python housing price prediction, 94% accuracy.',        skills:['Python','ML'],                 merit_points:420, emoji:'🤖', github_url:'#', status:'approved' },
  { id:3, title:'Design System Kit',     description:'Figma design system with 200+ components.',             skills:['UI/UX','Figma'],               merit_points:350, emoji:'🎨', github_url:'#', status:'pending'  },
  { id:4, title:'Task Manager App',      description:'Kanban board with drag-and-drop collaboration.',        skills:['React','TypeScript'],           merit_points:310, emoji:'📋', github_url:'#', status:'approved' },
];
const DEMO_CANDIDATES = [
  { user_id:1, anonymous_code:'A-047', merit_points:2840, global_rank:47,  level:7, avatar_color:'av-cyan',   project_count:8,  skills:[{name:'React',proficiency:92},{name:'Node.js',proficiency:78}] },
  { user_id:2, anonymous_code:'B-012', merit_points:3920, global_rank:12,  level:9, avatar_color:'av-green',  project_count:11, skills:[{name:'Python',proficiency:95},{name:'ML',proficiency:88}] },
  { user_id:3, anonymous_code:'C-089', merit_points:1980, global_rank:89,  level:5, avatar_color:'av-amber',  project_count:6,  skills:[{name:'UI/UX',proficiency:90},{name:'Figma',proficiency:85}] },
  { user_id:4, anonymous_code:'D-031', merit_points:3120, global_rank:31,  level:8, avatar_color:'av-violet', project_count:9,  skills:[{name:'React',proficiency:88},{name:'GraphQL',proficiency:75}] },
  { user_id:5, anonymous_code:'E-055', merit_points:2440, global_rank:55,  level:6, avatar_color:'av-green',  project_count:7,  skills:[{name:'Marketing',proficiency:85},{name:'SEO',proficiency:80}] },
  { user_id:6, anonymous_code:'F-018', merit_points:3560, global_rank:18,  level:8, avatar_color:'av-amber',  project_count:10, skills:[{name:'Node.js',proficiency:90},{name:'Docker',proficiency:82}] },
];
const DEMO_SKILLS = [
  { name:'React', proficiency:92 }, { name:'Node.js', proficiency:78 },
  { name:'Python', proficiency:65 }, { name:'UI/UX', proficiency:55 },
];
const CHALLENGES = [
  { id:1, title:'Build a REST API endpoint',   desc:'Create a CRUD API for a todo list using Node.js and Express with auth middleware.', skill:'Node.js',    difficulty:'medium', points:200, time:'90 min' },
  { id:2, title:'React state management',      desc:'Implement a shopping cart using React Context API with add/remove controls.',         skill:'React',      difficulty:'easy',   points:120, time:'45 min' },
  { id:3, title:'SQL query optimization',      desc:'Optimize 5 slow PostgreSQL queries using indexes and query restructuring.',           skill:'PostgreSQL', difficulty:'hard',   points:350, time:'120 min' },
  { id:4, title:'Design a mobile onboarding',  desc:'Create 3 onboarding screens in Figma with clear UX flow and accessibility.',          skill:'UI/UX',      difficulty:'medium', points:180, time:'60 min' },
];

function levelTitle(lvl) {
  return ['','Newcomer','Explorer','Builder','Coder','Craftsman','Expert','Rising Star','Senior','Lead','Legend'][Math.min(lvl, 10)] || 'Master';
}
function initials(name) { return (name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(); }

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
});