import './style.css';
import { Simulation, DEFAULT_CONTROL } from './simulation.js';
import { createCity } from './city.js';

const $ = id => document.getElementById(id);
const number = n => new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(n);
const districts = {
  gateway: { n: '01', title: 'API gateway', description: 'Every request enters here. Accepted jobs are saved before they are sent to the queue.' },
  queue: { n: '02', title: 'Durable job queue', description: 'RabbitMQ holds work until a consumer acknowledges it. If consumers stop, accepted jobs accumulate here.' },
  workers: { n: '03', title: 'Worker district', description: 'Java consumers perform SHA-256 work. They acknowledge a message only after its result has been saved.' },
  database: { n: '04', title: 'Job archive', description: 'The H2 database stores jobs and the outbox on disk. Duplicate deliveries cannot overwrite a completed result.' },
};
let simulation = new Simulation();
let state = simulation.snapshot(), selected = 'gateway', live = false, busy = false;
let city, visualPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer, scenarioTimers = [], runningScenario = false, dialogView = '';
let lastTick = performance.now(), lastPaint = 0, polling = false;
const dialog = $('info-dialog');

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6500);
}
async function api(path, options = {}) {
  const response = await fetch('/api/' + path, { ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    let body; try { body = await response.json(); } catch {}
    throw new Error(body?.message || 'Backend returned HTTP ' + response.status + '.');
  }
  return response.json();
}
function stopScenario(showToast = false) {
  scenarioTimers.forEach(clearTimeout); scenarioTimers = []; runningScenario = false;
  $('scenario-banner').hidden = true; $('guided-button').disabled = false;
  if (showToast) toast('Walkthrough ended. The controls are yours.');
}
async function configure(patch, automated = false) {
  if (busy) return false;
  if (!automated && runningScenario) stopScenario();
  const next = { ...state.control, ...patch };
  busy = true;
  try {
    if (live) {
      document.querySelectorAll('.failure-button,.stepper button,#recover-button').forEach(b => b.disabled = true);
      await api('control', { method: 'POST', body: JSON.stringify(next) });
      state = await api('snapshot');
    } else { simulation.configure(next); state = simulation.snapshot(); }
    render();
    return true;
  } catch (e) { toast(e.message); render(); return false; }
  finally {
    busy = false; document.querySelectorAll('.failure-button,.stepper button,#recover-button').forEach(b => b.disabled = false);
  }
}
function selectDistrict(key) {
  if (!districts[key]) return;
  selected = key; city?.select(key); renderDistrict();
}
function renderDistrict() {
  const d = districts[selected], status = state.services[selected];
  $('district-index').textContent = d.n + ' /';
  $('district-title').textContent = d.title;
  $('district-description').textContent = d.description;
  $('district-status').textContent = status.toUpperCase();
  $('district-status').className = 'service-state ' + status;
  document.querySelectorAll('[data-district]').forEach(button => {
    button.classList.toggle('selected', button.dataset.district === selected);
    button.setAttribute('aria-pressed', String(button.dataset.district === selected));
    const status = state.services[button.dataset.district];
    button.querySelector('i').style.background = status === 'offline' ? 'var(--red)' : status === 'degraded' ? 'var(--orange)' : 'var(--mint)';
  });
}
function chart(id, key, baseline = 1) {
  const values = state.series.map(s => s[key]);
  const max = Math.max(baseline, ...values);
  const points = [0, ...values];
  const offset = Math.max(0, 60 - points.length);
  const path = points.map((n, i) => (i ? 'L' : 'M') + ((offset + i) / 60 * 220).toFixed(1) + ',' + (32 - n / max * 27).toFixed(1)).join(' ');
  $(id).setAttribute('d', path);
}
function renderEvents() {
  const important = state.events.filter(e => !e.jobId).slice(0, 3);
  const jobs = state.events.filter(e => e.jobId).slice(0, 3);
  const events = [...important, ...jobs].sort((a, b) => b.at - a.at || b.id - a.id).slice(0, 6);
  const fragment = document.createDocumentFragment();
  for (const event of events) {
    const row = document.createElement('div'); row.className = 'event-item ' + event.type;
    const icon = document.createElement('span'); icon.className = 'event-symbol';
    icon.textContent = event.type === 'outage' ? 'ϟ' : event.type === 'completed' ? '✓' : event.type === 'recovered' ? '↺' : '↗';
    const content = document.createElement('div'); content.append(document.createTextNode(event.message));
    const time = document.createElement('time'); time.dateTime = new Date(event.at).toISOString();
    time.textContent = new Date(event.at).toLocaleTimeString('en-GB', { hour12: false }) + (event.jobId ? ' / ' + event.jobId.slice(0, 12) : ' / SYSTEM');
    content.append(time); row.append(icon, content); fragment.append(row);
  }
  $('event-list').replaceChildren(fragment);
}
function render() {
  const m = state.metrics, c = state.control;
  $('metric-rps').textContent = number(m.requestsPerSecond);
  $('metric-queue').textContent = number(m.backlog);
  $('metric-latency').textContent = m.p95LatencyMs >= 1000 ? (m.p95LatencyMs / 1000).toFixed(1) : number(m.p95LatencyMs);
  $('latency-unit').textContent = m.p95LatencyMs >= 1000 ? 's' : 'ms';
  $('metric-success').textContent = m.successRate === 100 ? '100' : m.successRate.toFixed(1);
  $('total-submitted').textContent = number(m.submitted) + ' accepted';
  $('total-completed').textContent = number(m.completed) + ' completed';
  $('traffic-value').value = c.rate; $('traffic').value = c.rate;
  $('worker-count').value = String(c.workers).padStart(2, '0');
  $('worker-outage').setAttribute('aria-pressed', String(c.paused));
  $('traffic-surge').setAttribute('aria-pressed', String(c.rate >= 24));
  $('slow-workers').setAttribute('aria-pressed', String(c.delayMs >= 1600));
  $('gateway-outage').setAttribute('aria-pressed', String(c.gatewayDown));
  const offline = Object.values(state.services).includes('offline');
  const degraded = Object.values(state.services).includes('degraded') || m.backlog > 25;
  $('city-health').textContent = offline ? 'SERVICE INTERRUPTION' : degraded ? 'SYSTEM UNDER PRESSURE' : 'ALL SYSTEMS OPERATIONAL';
  $('city-health').className = 'health-pill' + (offline ? ' danger' : degraded ? ' warning' : '');
  const seconds = Math.floor(state.uptimeSec);
  $('session-time').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  $('mode-label').textContent = live ? 'LIVE JAVA BACKEND' : 'BROWSER DEMO';
  $('mode-note-text').textContent = live
    ? 'Live Java backend · Requests, queue depth and completions come from your running services.'
    : 'Browser simulation · Explore the lab here. The source includes the real Java + RabbitMQ stack.';
  chart('chart-rps', 'rps', 5); chart('chart-queue', 'queue', 8);
  chart('chart-latency', 'latency', 500); chart('chart-success', 'success', 100);
  renderDistrict(); renderEvents(); city?.update(state);
  if (dialog.open && dialogView === 'requests') renderRequests();
}

function showDialog(view) {
  dialogView = view;
  const body = $('dialog-body'); body.replaceChildren();
  if (view === 'requests') {
    $('dialog-title').textContent = 'Request inspector'; renderRequests();
  } else if (view === 'connection') {
    $('dialog-title').textContent = 'Choose your environment';
    body.innerHTML = '<p class="dialog-copy"><strong>Browser demo</strong> runs a deterministic queue simulation in this tab. It does not start a Java server or contact RabbitMQ.</p><p class="dialog-copy"><strong>Live Java mode</strong> reads the real API on the same origin. Download the project, install Docker Desktop, start the stack, then open its local address.</p><pre class="code-line">docker compose up --build\n\nOpen http://localhost:3000</pre><div class="dialog-callout">The Docker version connects automatically. The hosted preview stays in browser mode. Live mode never silently substitutes simulated metrics.</div><div class="dialog-actions"><a class="dialog-action" href="/downloads/blackout-source.zip" download>Download full project ↗</a><button class="dialog-action secondary" id="connect-live">Connect to this origin’s Java API</button><button class="dialog-action secondary" id="use-demo">Use browser demo</button></div>';
    $('connect-live').onclick = async () => {
      try {
        $('connect-live').disabled = true;
        const health = await api('health'); if (health.product !== 'BLACKOUT') throw new Error('This origin does not serve a BLACKOUT API.');
        const next = await api('snapshot'); stopScenario(); live = true; state = next; render(); dialog.close(); toast('Connected to the real Java backend.');
      } catch { toast('No Java backend on this origin. Start the included Docker stack, then open http://localhost:3000.'); }
      finally { if ($('connect-live')) $('connect-live').disabled = false; }
    };
    $('use-demo').onclick = () => { stopScenario(); live = false; simulation = new Simulation(); state = simulation.snapshot(); render(); dialog.close(); toast('New browser sandbox started.'); };
  } else {
    $('dialog-title').textContent = 'A city with a system underneath.';
    body.innerHTML = '<p class="dialog-copy">Each district represents a part of an asynchronous job pipeline. In the full stack, these are real Java services, a RabbitMQ broker and a disk-backed H2 database. Moving lights are a sampled view of accepted and completed jobs.</p><div class="architecture-flow"><div class="architecture-node"><small>01 / ACCEPT</small><strong>API gateway</strong><p>Spring Boot accepts work. Jobs and outbox entries are saved in one database transaction.</p></div><div class="architecture-node"><small>02 / ROUTE</small><strong>RabbitMQ</strong><p>The publisher waits for confirmation. Undelivered outbox entries are retried.</p></div><div class="architecture-node"><small>03 / COMPUTE</small><strong>Java workers</strong><p>Consumers perform SHA-256 work. Delays and consumer shutdowns are explicit lab controls.</p></div><div class="architecture-node"><small>04 / COMMIT</small><strong>Job archive</strong><p>Results are committed before acknowledgement. Repeated completion callbacks are idempotent.</p></div></div><div class="dialog-callout"><strong>The failure experiment:</strong> stop the workers, let the queue grow, then restore the grid. Accepted work stays queued while throughput drops. After recovery, the fleet drains the backlog.</div><p class="dialog-copy">The API exposes the latest metrics and bounded recent events. The city polls once per second. P95 latency includes time waiting in the queue; acceptance rate measures accepted requests, not completed jobs.</p><p class="dialog-copy"><strong>Current environment: </strong>' + (live ? 'a live Java backend.' : 'the browser simulation. The Java services are included in the download.') + '</p><div class="dialog-actions"><a class="dialog-action" href="/downloads/blackout-source.zip" download>Download source + setup guide ↗</a><button id="architecture-demo" class="dialog-action secondary">Try the guided outage</button></div>';
    $('architecture-demo').onclick = () => { dialog.close(); startScenario(); };
  }
  if (!dialog.open) dialog.showModal();
}
function renderRequests() {
  const body = $('dialog-body');
  if (!body.querySelector('.requests-table')) {
    body.innerHTML = '<p class="dialog-copy">Most recent 40 jobs · ' + (live ? 'Live results from the Java API.' : 'Browser simulation. Run the Java stack for real SHA-256 results.') + '</p><div class="table-wrap"><table class="requests-table"><thead><tr><th>REQUEST</th><th>STATE</th><th>TOTAL LATENCY</th><th>WORKER</th></tr></thead><tbody id="requests-body"></tbody></table></div><div id="request-empty" class="empty-state" hidden>No requests yet. Increase incoming traffic to create some work.</div><p class="dialog-copy">Queue time contributes to total latency. Jobs in progress have no final latency yet.</p>';
  }
  const fragment = document.createDocumentFragment();
  for (const job of state.jobs) {
    const row = document.createElement('tr');
    const values = [job.id.slice(0, 16), job.status, job.completedAt ? number(job.latencyMs) + ' ms' : '—',
      job.workerId || (job.status === 'PROCESSING' ? 'browser-model' : 'Awaiting worker')];
    values.forEach((value, i) => {
      const cell = document.createElement('td'); cell.textContent = value;
      if (i === 1) cell.className = job.status === 'COMPLETED' ? 'job-done' : 'job-queued';
      row.append(cell);
    });
    if (job.result) row.title = job.result;
    fragment.append(row);
  }
  $('requests-body').replaceChildren(fragment); $('request-empty').hidden = state.jobs.length > 0;
}
async function startScenario() {
  if (busy) return;
  stopScenario(); runningScenario = true; $('guided-button').disabled = true;
  const success = await configure({ ...DEFAULT_CONTROL, rate: 6, paused: true }, true);
  if (!success) { stopScenario(); return; }
  $('scenario-banner').hidden = false;
  function step(index, title, description) {
    $('scenario-index').textContent = index + ' / 03';
    $('scenario-title').textContent = title; $('scenario-description').textContent = description;
  }
  step('01', 'Cut the lights.', 'Consumers stop. Accepted jobs stay queued. Watch the orange backlog build.');
  scenarioTimers.push(setTimeout(async () => {
    if (!runningScenario) return;
    if (await configure({ rate: 24 }, true)) step('02', 'Turn up the pressure.', '24 requests per second. The gateway keeps accepting work while consumers are offline.');
    else stopScenario();
  }, 6000));
  scenarioTimers.push(setTimeout(async () => {
    if (!runningScenario) return;
    if (await configure({ rate: 3, paused: false, delayMs: 260, workers: 6, gatewayDown: false }, true))
      step('03', 'Bring the city back.', 'Six consumers are online. Watch completions rise and the backlog drain.');
    else stopScenario();
  }, 12000));
  scenarioTimers.push(setTimeout(() => {
    if (!runningScenario) return;
    stopScenario(); toast('Grid restored. Accepted work stayed queued through the outage.');
  }, 26000));
}

$('traffic').addEventListener('input', e => { $('traffic-value').value = e.target.value; });
$('traffic').addEventListener('change', e => configure({ rate: Number(e.target.value) }));
$('fewer-workers').onclick = () => configure({ workers: Math.max(1, state.control.workers - 1) });
$('more-workers').onclick = () => configure({ workers: Math.min(6, state.control.workers + 1) });
$('worker-outage').onclick = () => configure({ paused: !state.control.paused });
$('traffic-surge').onclick = () => configure({ rate: state.control.rate >= 24 ? 3 : 24 });
$('slow-workers').onclick = () => configure({ delayMs: state.control.delayMs >= 1600 ? 260 : 1600 });
$('gateway-outage').onclick = () => configure({ gatewayDown: !state.control.gatewayDown });
$('recover-button').onclick = async () => {
  if (await configure({ ...DEFAULT_CONTROL, workers: 4 })) toast('Services restored. Four workers are clearing the backlog.');
};
$('guided-button').onclick = startScenario;
$('stop-scenario').onclick = () => stopScenario(true);
document.querySelectorAll('[data-district]').forEach(b => b.onclick = () => selectDistrict(b.dataset.district));
['inspect-button', 'all-events'].forEach(id => { $(id).onclick = () => showDialog('requests'); });
$('nav-architecture').onclick = () => showDialog('architecture');
$('nav-operations').onclick = () => { dialog.close(); $('city-title').scrollIntoView({ behavior: visualPaused ? 'instant' : 'smooth', block: 'center' }); };
$('mode-button').onclick = () => showDialog('connection');
$('mode-details').onclick = () => showDialog('architecture');
$('close-dialog').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
$('reset-view').onclick = () => city?.reset();
$('orbit-button').onclick = () => { const next = $('orbit-button').getAttribute('aria-pressed') !== 'true'; city?.orbit(next); $('orbit-button').setAttribute('aria-pressed', String(next)); };
function updateMotion() {
  city?.motion(!visualPaused); $('motion-button').setAttribute('aria-pressed', String(visualPaused));
  $('motion-button').title = visualPaused ? 'Resume visual motion' : 'Pause visual motion';
}
$('motion-button').onclick = () => { visualPaused = !visualPaused; updateMotion(); };
try {
  city = createCity($('city-host'), selectDistrict); $('city-loading').remove(); updateMotion();
} catch (e) {
  $('city-loading').textContent = '3D rendering is unavailable. All controls and metrics still work below.';
  console.warn('WebGL unavailable:', e.message);
}
render();
if (window.BLACKOUT_RUNTIME?.mode === 'live' || new URLSearchParams(location.search).get('live') === '1') {
  live = true;
  api('snapshot').then(snapshot => { state = snapshot; render(); }).catch(() => {
    $('mode-label').textContent = 'BACKEND DISCONNECTED';
    $('mode-note-text').textContent = 'Java mode selected, but the API is not reachable. Waiting to reconnect. Metrics are not being simulated.';
    toast('Java backend unavailable. Check the API service or choose browser demo.');
  });
}
setInterval(async () => {
  const now = performance.now(), delta = Math.min(1000, Math.max(0, now - lastTick)); lastTick = now;
  if (!live) {
    simulation.advance(delta); state = simulation.snapshot();
    if (now - lastPaint > 400) { lastPaint = now; render(); }
  } else if (!polling && now - lastPaint > 950) {
    polling = true; lastPaint = now;
    try { state = await api('snapshot'); render(); }
    catch {
      $('mode-label').textContent = 'BACKEND DISCONNECTED';
      $('mode-note-text').textContent = 'Connection lost. Showing the last Java snapshot. Waiting to reconnect.';
    } finally { polling = false; }
  }
}, 100);
