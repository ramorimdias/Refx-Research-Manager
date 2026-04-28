export interface Env {
  DB: D1Database
  ADMIN_TOKEN: string
}

type HeartbeatPayload = {
  install_id?: unknown
  app_version?: unknown
  platform?: unknown
  locale?: unknown
  event?: unknown
  session_started_at?: unknown
  sent_at?: unknown
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization, x-admin-token',
      ...(init?.headers ?? {}),
    },
  })
}

function html(markup: string, init?: ResponseInit) {
  return new Response(markup, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization, x-admin-token',
      ...(init?.headers ?? {}),
    },
  })
}

function readAdminToken(request: Request) {
  const authHeader = request.headers.get('authorization')?.trim()
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }

  return request.headers.get('x-admin-token')?.trim() ?? ''
}

function isNonEmptyString(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== 'string') return new Date().toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function normalizePlatform(value: string | null) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith('win')) return 'windows'
  if (normalized.startsWith('mac')) return 'macos'
  if (normalized.startsWith('linux')) return 'linux'
  return normalized
}

async function handleHeartbeat(request: Request, env: Env) {
  let payload: HeartbeatPayload

  try {
    payload = await request.json<HeartbeatPayload>()
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!isNonEmptyString(payload.install_id, 128)) {
    return json({ ok: false, error: 'invalid_install_id' }, { status: 400 })
  }

  const installId = payload.install_id.trim()
  const appVersion = isNonEmptyString(payload.app_version, 64) ? payload.app_version.trim() : null
  const platform = normalizePlatform(isNonEmptyString(payload.platform, 64) ? payload.platform.trim() : null)
  const locale = isNonEmptyString(payload.locale, 32) ? payload.locale.trim() : null
  const event = isNonEmptyString(payload.event, 32) ? payload.event.trim() : 'heartbeat'
  const sentAt = normalizeIsoDate(payload.sent_at)

  await env.DB
    .prepare(
      `INSERT INTO install_heartbeats (
        install_id,
        first_seen_at,
        last_seen_at,
        app_version,
        platform,
        locale,
        last_event
      ) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(install_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        app_version = excluded.app_version,
        platform = excluded.platform,
        locale = excluded.locale,
        last_event = excluded.last_event`,
    )
    .bind(installId, sentAt, appVersion, platform, locale, event)
    .run()

  return json({ ok: true })
}

async function handleStats(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN || readAdminToken(request) !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const [total, current, dau, wau, mau] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM install_heartbeats",
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM install_heartbeats WHERE datetime(last_seen_at) >= datetime('now', '-5 minutes')",
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM install_heartbeats WHERE datetime(last_seen_at) >= datetime('now', '-1 day')",
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM install_heartbeats WHERE datetime(last_seen_at) >= datetime('now', '-7 days')",
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM install_heartbeats WHERE datetime(last_seen_at) >= datetime('now', '-30 days')",
    ).first<{ count: number }>(),
  ])

  return json({
    ok: true,
    stats: {
      total_installs_seen: total?.count ?? 0,
      current_open_estimate: current?.count ?? 0,
      dau: dau?.count ?? 0,
      wau: wau?.count ?? 0,
      mau: mau?.count ?? 0,
    },
  })
}

async function handleBreakdown(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN || readAdminToken(request) !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const [versions, platforms, locales] = await Promise.all([
    env.DB
      .prepare(
        `SELECT COALESCE(app_version, 'unknown') AS label, COUNT(*) AS count
         FROM install_heartbeats
         GROUP BY COALESCE(app_version, 'unknown')
         ORDER BY count DESC, label ASC`,
      )
      .all(),
    env.DB
      .prepare(
        `SELECT COALESCE(platform, 'unknown') AS label, COUNT(*) AS count
         FROM install_heartbeats
         GROUP BY COALESCE(platform, 'unknown')
         ORDER BY count DESC, label ASC`,
      )
      .all(),
    env.DB
      .prepare(
        `SELECT COALESCE(locale, 'unknown') AS label, COUNT(*) AS count
         FROM install_heartbeats
         GROUP BY COALESCE(locale, 'unknown')
         ORDER BY count DESC, label ASC`,
      )
      .all(),
  ])

  return json({
    ok: true,
    breakdown: {
      versions: versions.results ?? [],
      platforms: platforms.results ?? [],
      locales: locales.results ?? [],
    },
  })
}

function renderAdminPage() {
  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Refx Usage Dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f141b;
        --panel: rgba(23, 29, 39, 0.92);
        --panel-soft: rgba(18, 23, 31, 0.7);
        --text: #edf2f7;
        --muted: #9fb0c1;
        --border: rgba(148, 163, 184, 0.18);
        --accent: #5ea3ff;
        --accent-2: #7ce3d6;
        --danger: #ff8c8c;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(94,163,255,0.12), transparent 28%),
          radial-gradient(circle at top right, rgba(124,227,214,0.10), transparent 24%),
          var(--bg);
        color: var(--text);
      }

      .wrap {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 40px;
      }

      .hero {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: end;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.05;
      }

      .sub {
        margin-top: 8px;
        color: var(--muted);
      }

      .toolbar, .panel, .stat {
        border: 1px solid var(--border);
        background: var(--panel);
        backdrop-filter: blur(14px);
        border-radius: 22px;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 14px;
        margin-bottom: 18px;
      }

      .field {
        flex: 1 1 320px;
      }

      label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 8px;
      }

      input {
        width: 100%;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--panel-soft);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }

      button {
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .primary {
        background: linear-gradient(135deg, var(--accent), #82b6ff);
        color: #08111f;
      }

      .secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--border);
      }

      .status {
        min-height: 22px;
        margin: 6px 2px 18px;
        color: var(--muted);
      }

      .status.error { color: var(--danger); }
      .status.ok { color: var(--accent-2); }

      .stats {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }

      .stat {
        padding: 18px;
      }

      .stat-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .stat-value {
        margin-top: 10px;
        font-size: 34px;
        font-weight: 700;
        line-height: 1;
      }

      .panels {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .panel {
        padding: 18px;
      }

      .panel h2 {
        margin: 0 0 14px;
        font-size: 15px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      td {
        padding: 10px 0;
        border-top: 1px solid var(--border);
        font-size: 14px;
      }

      td:last-child {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .empty {
        color: var(--muted);
        padding: 14px 0 4px;
      }

      @media (max-width: 900px) {
        .stats, .panels {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 640px) {
        .stats, .panels {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="hero">
        <div>
          <h1>Refx Usage Dashboard</h1>
          <div class="sub">Anonymous active install counts from your Cloudflare Worker.</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="field">
          <label for="token">Admin Token</label>
          <input id="token" type="password" placeholder="Paste your ADMIN_TOKEN" />
        </div>
        <div style="display:flex; gap:10px; align-items:end;">
          <button class="primary" id="load">Load stats</button>
          <button class="secondary" id="save">Remember token</button>
        </div>
      </div>

      <div class="status" id="status">Enter your admin token, then load the dashboard.</div>

      <div class="stats">
        <div class="stat"><div class="stat-label">Total Installs Seen</div><div class="stat-value" id="total">-</div></div>
        <div class="stat"><div class="stat-label">Current Open Estimate</div><div class="stat-value" id="current">-</div></div>
        <div class="stat"><div class="stat-label">Daily Active</div><div class="stat-value" id="dau">-</div></div>
        <div class="stat"><div class="stat-label">Weekly Active</div><div class="stat-value" id="wau">-</div></div>
        <div class="stat"><div class="stat-label">Monthly Active</div><div class="stat-value" id="mau">-</div></div>
      </div>

      <div class="panels">
        <div class="panel">
          <h2>Versions</h2>
          <div id="versions"></div>
        </div>
        <div class="panel">
          <h2>Platforms</h2>
          <div id="platforms"></div>
        </div>
        <div class="panel">
          <h2>Locales</h2>
          <div id="locales"></div>
        </div>
      </div>
    </div>

    <script>
      const tokenInput = document.getElementById('token');
      const statusEl = document.getElementById('status');
      const key = 'refx-usage-admin-token';

      const setStatus = (message, tone = '') => {
        statusEl.textContent = message;
        statusEl.className = tone ? 'status ' + tone : 'status';
      };

      const setCount = (id, value) => {
        document.getElementById(id).textContent = String(value ?? '-');
      };

      const renderRows = (id, rows) => {
        const host = document.getElementById(id);
        if (!rows || rows.length === 0) {
          host.innerHTML = '<div class="empty">No data yet.</div>';
          return;
        }

        host.innerHTML = '<table>' + rows.map((row) =>
          '<tr><td>' + row.label + '</td><td>' + row.count + '</td></tr>'
        ).join('') + '</table>';
      };

      const getHeaders = () => ({
        'x-admin-token': tokenInput.value.trim(),
      });

      async function readJsonResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        const raw = await response.text();

        if (!contentType.includes('application/json')) {
          throw new Error('Expected JSON but received: ' + raw.slice(0, 180));
        }

        try {
          return JSON.parse(raw);
        } catch (error) {
          throw new Error('Invalid JSON response: ' + raw.slice(0, 180));
        }
      }

      async function loadDashboard() {
        const token = tokenInput.value.trim();
        if (!token) {
          setStatus('Enter your admin token first.', 'error');
          return;
        }

        setStatus('Loading stats...');

        try {
          const [statsRes, breakdownRes] = await Promise.all([
            fetch('/usage/stats', { headers: getHeaders() }),
            fetch('/usage/breakdown', { headers: getHeaders() }),
          ]);

          if (statsRes.status === 401 || breakdownRes.status === 401) {
            setStatus('Unauthorized. Check your admin token.', 'error');
            return;
          }

          if (!statsRes.ok) {
            throw new Error('Stats request failed with ' + statsRes.status);
          }

          if (!breakdownRes.ok) {
            throw new Error('Breakdown request failed with ' + breakdownRes.status);
          }

          const statsPayload = await readJsonResponse(statsRes);
          const breakdownPayload = await readJsonResponse(breakdownRes);

          setCount('total', statsPayload.stats.total_installs_seen);
          setCount('current', statsPayload.stats.current_open_estimate);
          setCount('dau', statsPayload.stats.dau);
          setCount('wau', statsPayload.stats.wau);
          setCount('mau', statsPayload.stats.mau);

          renderRows('versions', breakdownPayload.breakdown.versions);
          renderRows('platforms', breakdownPayload.breakdown.platforms);
          renderRows('locales', breakdownPayload.breakdown.locales);

          setStatus('Dashboard loaded.', 'ok');
        } catch (error) {
          setStatus('Failed to load dashboard. ' + (error?.message || error), 'error');
        }
      }

      document.getElementById('load').addEventListener('click', loadDashboard);
      document.getElementById('save').addEventListener('click', () => {
        localStorage.setItem(key, tokenInput.value.trim());
        setStatus('Token remembered in this browser.', 'ok');
      });

      const savedToken = localStorage.getItem(key);
      if (savedToken) {
        tokenInput.value = savedToken;
      }
    </script>
  </body>
</html>`)
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type, authorization, x-admin-token',
          'access-control-max-age': '86400',
        },
      })
    }

    if (request.method === 'GET' && url.pathname === '/admin') {
      return renderAdminPage()
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true })
    }

    if (request.method === 'POST' && url.pathname === '/usage/heartbeat') {
      return handleHeartbeat(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/usage/stats') {
      return handleStats(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/usage/breakdown') {
      return handleBreakdown(request, env)
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 })
  },
}
