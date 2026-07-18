'use strict';

/* ── bindScrollOverflow (inlined from bind-scroll-overflow.js) ── */
function bindScrollOverflow(el) {
  if (!el || typeof el.addEventListener !== 'function') return;

  const update = () => {
    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;
    const tokens = [];
    if (scrollTop > 1) tokens.push('top');
    if (scrollTop + clientHeight < scrollHeight - 1) tokens.push('bottom');
    if (scrollLeft > 1) tokens.push('left');
    if (scrollLeft + clientWidth < scrollWidth - 1) tokens.push('right');
    el.dataset.overflow = tokens.length ? tokens.join(' ') : 'none';
  };

  el.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(update).observe(el);
  }
  update();
}

function bindAllScrollOverflow(selector, root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll(selector).forEach(bindScrollOverflow);
}

/* ── Data ── */
const PROJECTS = [
  { slug: 'acme-api', name: 'Acme API', env: 'Production' },
  { slug: 'billing-svc', name: 'Billing Service', env: 'Production' },
  { slug: 'analytics-hub', name: 'Analytics Hub', env: 'Staging' },
  { slug: 'auth-gateway', name: 'Auth Gateway', env: 'Production' },
  { slug: 'webhooks-relay', name: 'Webhooks Relay', env: 'Development' },
];

const SESSIONS = [
  { id: 's1', device: 'Chrome on Windows', meta: '192.168.1.42 · Active now' },
  { id: 's2', device: 'Safari on macOS', meta: '10.0.0.15 · 2 hours ago' },
  { id: 's3', device: 'Firefox on Linux', meta: '172.16.0.8 · Yesterday' },
  { id: 's4', device: 'Chrome on Android', meta: 'Mobile · 3 days ago' },
  { id: 's5', device: 'Edge on Windows', meta: 'Office PC · 1 week ago' },
  { id: 's6', device: 'Safari on iPhone', meta: 'Mobile · 2 weeks ago' },
  { id: 's7', device: 'Chrome on macOS', meta: 'Home laptop · 3 weeks ago' },
  { id: 's8', device: 'Firefox on Windows', meta: 'VM · 1 month ago' },
  { id: 's9', device: 'Opera on Linux', meta: 'Dev machine · 2 months ago' },
];

let sessions = [...SESSIONS];
let pendingRevokeId = null;

/* ── DOM refs ── */
const views = {
  dashboard: document.getElementById('view-dashboard'),
  projects: document.getElementById('view-projects'),
  projectDetail: document.getElementById('view-project-detail'),
  settings: document.getElementById('view-settings'),
};

const pageTitle = document.getElementById('page-title');
const projectList = document.getElementById('project-list');
const projectsEmpty = document.getElementById('projects-empty');
const projectSearch = document.getElementById('project-search');
const sessionList = document.getElementById('session-list');
const revokeModal = document.getElementById('revoke-modal');
const toastContainer = document.getElementById('toast-container');

const settingsPanels = {
  profile: document.getElementById('settings-profile'),
  sessions: document.getElementById('settings-sessions'),
  connections: document.getElementById('settings-connections'),
};

/* ── Theme ── */
const THEME_KEY = 'acme-theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

/* ── Toast ── */
function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ── Router ── */
function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/dashboard';
  const parts = hash.split('/').filter(Boolean);
  return { parts, raw: hash };
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    const r = link.dataset.route;
    const active =
      (r === '/dashboard' && route.parts[0] === 'dashboard') ||
      (r === '/projects' && route.parts[0] === 'projects') ||
      (r === '/settings' && route.parts[0] === 'settings');
    link.classList.toggle('active', active);
  });
}

function setActiveSettingsTab(tab) {
  document.querySelectorAll('.settings-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.settings === tab);
  });
  Object.entries(settingsPanels).forEach(([key, panel]) => {
    panel.hidden = key !== tab;
  });
}

function showView(name) {
  Object.values(views).forEach((v) => { v.hidden = true; });
  if (views[name]) views[name].hidden = false;
}

function renderProjectList(filter = '') {
  const q = filter.trim().toLowerCase();
  const filtered = PROJECTS.filter(
    (p) => p.slug.includes(q) || p.name.toLowerCase().includes(q),
  );

  projectList.innerHTML = '';
  if (filtered.length === 0) {
    projectsEmpty.hidden = false;
    projectList.hidden = true;
    return;
  }

  projectsEmpty.hidden = true;
  projectList.hidden = false;

  filtered.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'project-row';
    li.innerHTML = `
      <a href="#/projects/${p.slug}"><code>${p.slug}</code> — ${p.name}</a>
      <span class="project-meta">${p.env}</span>
    `;
    projectList.appendChild(li);
  });
}

function renderSessions() {
  sessionList.innerHTML = '';
  sessions.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'session-item';
    li.dataset.sessionId = s.id;
    li.innerHTML = `
      <div class="session-info">
        <div class="session-device">${s.device}</div>
        <div class="session-meta">${s.meta}</div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm session-revoke">Revoke</button>
    `;
    sessionList.appendChild(li);
  });

  bindAllScrollOverflow('.scroll-region', document.getElementById('settings-sessions'));
}

function navigate() {
  const route = parseRoute();
  setActiveNav(route);

  const [section, ...rest] = route.parts;

  switch (section) {
    case 'dashboard':
    default:
      pageTitle.textContent = 'Dashboard';
      showView('dashboard');
      break;

    case 'projects':
      if (rest.length >= 1) {
        const slug = rest[0];
        pageTitle.textContent = 'Project Detail';
        showView('projectDetail');
        document.getElementById('project-slug-display').textContent = slug;
      } else {
        pageTitle.textContent = 'Projects';
        showView('projects');
        renderProjectList(projectSearch.value);
      }
      break;

    case 'settings': {
      pageTitle.textContent = 'Settings';
      showView('settings');
      const tab = rest[0] || 'profile';
      const validTab = ['profile', 'sessions', 'connections'].includes(tab) ? tab : 'profile';
      setActiveSettingsTab(validTab);
      if (validTab === 'sessions') renderSessions();
      break;
    }
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('popstate', navigate);

/* ── Project search ── */
projectSearch.addEventListener('input', () => {
  renderProjectList(projectSearch.value);
});

/* ── Project detail tabs ── */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      const show = panel.dataset.tabPanel === name;
      panel.hidden = !show;
      panel.classList.toggle('active', show);
    });
  });
});

/* ── Profile save ── */
const saveBtn = document.getElementById('save-profile');
const profileStatus = document.getElementById('profile-status');

saveBtn.addEventListener('click', () => {
  profileStatus.hidden = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save changes';
    profileStatus.hidden = false;
  }, 800);
});

/* ── Session revoke modal ── */
sessionList.addEventListener('click', (e) => {
  const btn = e.target.closest('.session-revoke');
  if (!btn) return;
  const item = btn.closest('.session-item');
  pendingRevokeId = item.dataset.sessionId;
  revokeModal.showModal();
});

document.getElementById('confirm-revoke').addEventListener('click', (e) => {
  if (pendingRevokeId) {
    sessions = sessions.filter((s) => s.id !== pendingRevokeId);
    pendingRevokeId = null;
    renderSessions();
    showToast('Session revoked');
  }
});

revokeModal.addEventListener('close', () => {
  pendingRevokeId = null;
});

/* ── Dashboard + projects list actions ── */
function onCreateProject() {
  showToast('Project creation started — check your email for next steps.');
}

document.getElementById('create-project-btn').addEventListener('click', onCreateProject);
document.getElementById('create-project-list-btn').addEventListener('click', onCreateProject);

/* ── Init ── */
initTheme();
renderSessions();
if (!location.hash) location.hash = '#/dashboard';
navigate();
