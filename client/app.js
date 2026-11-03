const API = 'http://localhost:3000';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

const userSelect = document.getElementById('userSelect');
const linkSelect = document.getElementById('linkSelect');
const errorEl = document.getElementById('error');

// לכל גרף שומרים את הנתונים האחרונים ואת האובייקט של Chart.js,
// כדי שאפשר יהיה לצייר אותו מחדש כשמחליפים סוג גרף
const charts = {
  byTarget: { chart: null, data: null },
  byLink: { chart: null, data: null },
  byDay: { chart: null, data: null }
};

async function getJson(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function showError(e) {
  errorEl.textContent = 'שגיאה בטעינת נתונים: ' + e.message + ' (האם השרת רץ?)';
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    const text = u.hostname + u.pathname;
    return text.length > 30 ? text.slice(0, 30) + '…' : text;
  } catch {
    return url;
  }
}

function drawChart(key) {
  const { chart, data } = charts[key];
  if (chart) chart.destroy();
  charts[key].chart = null;

  const canvas = document.getElementById(key);
  const empty = document.getElementById(key + 'Empty');
  const hasData = data && data.values.some(v => v > 0);
  canvas.style.display = hasData ? 'block' : 'none';
  empty.style.display = hasData ? 'none' : 'block';
  if (!data) return;
  if (!hasData) { empty.textContent = 'אין עדיין קליקים'; return; }

  const type = document.querySelector(`.typeSelect[data-chart="${key}"]`).value;
  const multiColor = ['pie', 'doughnut', 'polarArea', 'bar'].includes(type);

  charts[key].chart = new Chart(canvas, {
    type,
    data: {
      labels: data.labels,
      datasets: [{
        label: 'קליקים',
        data: data.values,
        backgroundColor: multiColor ? data.labels.map((_, i) => COLORS[i % COLORS.length]) : 'rgba(78,121,167,0.3)',
        borderColor: multiColor ? '#fff' : '#4e79a7',
        fill: type === 'radar',
        tension: 0.3
      }]
    },
    options: {
      plugins: { legend: { display: !['bar', 'line', 'radar'].includes(type) } },
      scales: ['bar', 'line'].includes(type) ? { y: { beginAtZero: true, ticks: { precision: 0 } } } : {}
    }
  });
}

// גרף 1: קליקים על קישור אחד לפי מקור (target) - מה-endpoint של ספרינט 3
async function loadLinkStats(linkId) {
  const stats = await getJson(`/links/${linkId}/stats`);
  charts.byTarget.data = {
    labels: Object.keys(stats.byTarget),
    values: Object.values(stats.byTarget)
  };
  drawChart('byTarget');
}

// גרף 2: כמות קליקים כוללת לכל קישור של המשתמש
function buildByLink(links) {
  return {
    labels: links.map(l => shortUrl(l.originalUrl)),
    values: links.map(l => l.clicks.length)
  };
}

// גרף 3: כל הקליקים של כל הקישורים של המשתמש, לפי יום בשבוע
function buildByDay(links) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  links.forEach(link => {
    link.clicks.forEach(click => {
      counts[new Date(click.insertedAt).getDay()]++;
    });
  });
  return { labels: DAYS, values: counts };
}

async function loadUser(userId) {
  const links = await getJson(`/users/${userId}/links`);

  linkSelect.innerHTML = '<option value="">בחרי קישור</option>';
  links.forEach(l => {
    linkSelect.add(new Option(`${shortUrl(l.originalUrl)} (${l.clicks.length})`, l._id));
  });

  charts.byLink.data = buildByLink(links);
  charts.byDay.data = buildByDay(links);
  charts.byTarget.data = null;
  document.getElementById('byTargetEmpty').textContent = 'בחרי קישור';
  drawChart('byLink');
  drawChart('byDay');
  drawChart('byTarget');
}

async function loadUsers() {
  const users = await getJson('/users');
  users.forEach(u => {
    userSelect.add(new Option(`${u.name} (${u.email})`, u._id));
  });
}

userSelect.addEventListener('change', () => {
  errorEl.textContent = '';
  if (userSelect.value) loadUser(userSelect.value).catch(showError);
});

linkSelect.addEventListener('change', () => {
  errorEl.textContent = '';
  if (linkSelect.value) loadLinkStats(linkSelect.value).catch(showError);
});

document.querySelectorAll('.typeSelect').forEach(select => {
  select.addEventListener('change', () => drawChart(select.dataset.chart));
});

loadUsers().catch(showError);
