// web/app.js
const requestId = window.__HITL_REQUEST_ID__ || null;
const actionToken = window.__HITL_ACTION_TOKEN__ || null;
const app = document.getElementById('app');

// ── Theme ────────────────────────────────────────────────────────────────────

function getTheme() {
  return localStorage.getItem('hitl-theme') || 'dark';
}

function setTheme(theme) {
  localStorage.setItem('hitl-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function themeToggleHtml() {
  const label = getTheme() === 'dark' ? 'Dark' : 'Light';
  return `<span class="theme-toggle-label">${label}</span><button class="theme-toggle" id="theme-toggle" title="Toggle theme"></button>`;
}

function bindThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', () => { toggleTheme(); rerender(); });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(ts) {
  if (!ts) return '\u2014';
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date}, ${time}`;
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return fmt(ts);
}

function statusBadge(status) {
  return `<span class="status-badge status-${escHtml(status)}">${escHtml(status)}</span>`;
}

function rerender() {
  if (requestId) renderDetail();
  else renderDashboard();
}

// ── Detail view ──────────────────────────────────────────────────────────────

let timerInterval = null;
let descriptionPollInterval = null;

if (requestId) {
  document.title = `HITL \u2014 ${requestId.slice(0, 8)}`;
  renderDetail();
}

async function renderDetail() {
  const res = await fetch(`/api/requests/${requestId}`);
  if (!res.ok) {
    app.innerHTML = `<div class="empty-state fade-in"><div class="icon">\u26a0\ufe0f</div><p>Request not found.</p></div>`;
    return;
  }
  const r = await res.json();

  const resolvedHtml = r.resolvedAt
    ? `<div class="resolved-banner">
        <span class="icon">${r.status === 'approved' ? '\u2705' : '\u274c'}</span>
        <span>${r.status === 'approved' ? 'Approved' : 'Denied'} by <strong>${escHtml(r.resolvedBy)}</strong> on ${fmt(r.resolvedAt)}</span>
      </div>`
    : '';

  const actionsHtml = r.status === 'pending'
    ? `<div class="actions">
        <button class="btn-approve" id="btn-approve">Approve</button>
        <button class="btn-deny" id="btn-deny">Deny</button>
        <span class="timer" id="timer"></span>
      </div>`
    : resolvedHtml;

  app.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div class="header-icon">\u26a1</div>
        <h1>Approval Request</h1>
        <span class="subtitle">
          ${r.status === 'pending' ? '<span class="live-dot"></span> Awaiting decision' : ''}
          ${themeToggleHtml()}
        </span>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="id">${escHtml(r.id)}</span>
          ${statusBadge(r.status)}
        </div>

        <div class="card-body">
          <div class="field full">
            <div class="field-label">Command</div>
            <div class="field-value command-value">${escHtml(r.command)}</div>
          </div>

          <div class="field full" id="description-field">
            <div class="field-label">Description</div>
            <div class="field-value description-value">${r.description ? escHtml(r.description) : '<span class="description-loading">Generating\u2026</span>'}</div>
          </div>

          <div class="field-group">
            <div class="field">
              <div class="field-label">Tool</div>
              <div class="field-value mono">${escHtml(r.tool)}</div>
            </div>
            <div class="field">
              <div class="field-label">User</div>
              <div class="field-value">${escHtml(r.userId)}</div>
            </div>
          </div>

          <div class="field-group">
            <div class="field">
              <div class="field-label">Working Directory</div>
              <div class="field-value mono">${escHtml(r.workdir)}</div>
            </div>
            <div class="field">
              <div class="field-label">Requested</div>
              <div class="field-value">${fmt(r.requestedAt)}</div>
            </div>
          </div>
        </div>

        ${actionsHtml}
      </div>
    </div>`;

  bindThemeToggle();

  if (r.status === 'pending') {
    document.getElementById('btn-approve').addEventListener('click', () => act('approve'));
    document.getElementById('btn-deny').addEventListener('click', () => act('deny'));
    startTimer();
  }

  // Poll for description if not yet available
  if (descriptionPollInterval) clearInterval(descriptionPollInterval);
  if (!r.description) {
    descriptionPollInterval = setInterval(async () => {
      const dRes = await fetch(`/api/requests/${requestId}`);
      if (!dRes.ok) return;
      const updated = await dRes.json();
      if (updated.description) {
        clearInterval(descriptionPollInterval);
        const el = document.querySelector('.description-value');
        if (el) el.textContent = updated.description;
      }
    }, 2000);
  }
}

function startTimer() {
  try {
    const payload = JSON.parse(atob(actionToken.split('.')[1]));
    const tokenExpiresAt = payload.exp * 1000;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remaining = tokenExpiresAt - Date.now();
      const el = document.getElementById('timer');
      if (!el) { clearInterval(timerInterval); return; }
      if (remaining <= 0) {
        clearInterval(timerInterval);
        el.textContent = 'Token expired \u2014 refreshing\u2026';
        setTimeout(() => location.reload(), 1000);
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 1000);
  } catch { /* ignore timer errors */ }
}

async function act(action) {
  const btns = document.querySelectorAll('button:not(.theme-toggle)');
  btns.forEach(b => b.disabled = true);

  const res = await fetch(`/requests/${requestId}/${action}`, {
    method: 'POST',
    headers: { 'X-HITL-Web-Token': actionToken },
  });

  if (res.ok) {
    clearInterval(timerInterval);
    renderDetail();
  } else {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    btns.forEach(b => b.disabled = false);
    const timer = document.getElementById('timer');
    if (timer) { timer.textContent = `Error: ${err.error}`; timer.style.color = 'var(--red)'; }
  }
}

// ── Dashboard view ───────────────────────────────────────────────────────────

if (!requestId) {
  document.title = 'HITL Dashboard';
  renderDashboard();
  setInterval(renderDashboard, 5000);
}

async function renderDashboard() {
  const res = await fetch('/api/requests');
  const requests = res.ok ? await res.json() : [];

  if (!requests.length) {
    app.innerHTML = `
      <div class="fade-in">
        <div class="header">
          <div class="header-icon">\u26a1</div>
          <h1>HITL Dashboard</h1>
          <span class="subtitle"><span class="live-dot"></span> Listening ${themeToggleHtml()}</span>
        </div>
        <div class="card">
          <div class="empty-state">
            <div class="icon">\ud83d\udce5</div>
            <p>No approval requests yet.</p>
            <p style="margin-top:0.5rem; font-size:0.8rem; color:var(--text-dim)">Requests will appear here when Claude triggers a matched command.</p>
          </div>
        </div>
      </div>`;
    bindThemeToggle();
    return;
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const rows = requests.map(r => `
    <tr>
      <td><a href="/requests/${escHtml(r.id)}">${escHtml(r.id.slice(0, 8))}\u2026</a></td>
      <td class="tool">${escHtml(r.tool)}</td>
      <td class="cmd" title="${escHtml(r.command)}">${escHtml(r.command)}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="time">${relativeTime(r.requestedAt)}</td>
    </tr>`).join('');

  app.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div class="header-icon">\u26a1</div>
        <h1>HITL Dashboard</h1>
        <span class="subtitle">
          ${pendingCount ? `<span class="live-dot"></span> ${pendingCount} pending` : `${requests.length} requests`}
          ${themeToggleHtml()}
        </span>
      </div>

      <div class="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tool</th>
              <th>Command</th>
              <th>Status</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  bindThemeToggle();
}
