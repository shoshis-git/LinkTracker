const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const COLORS = ['#8b5cf6', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#fb923c', '#60a5fa', '#f87171', '#a3e635', '#e879f9'];

// עיצוב כהה לכל הגרפים
Chart.defaults.color = '#9b99c2';
Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
Chart.defaults.font.family = 'Rubik, Arial, sans-serif';
Chart.defaults.plugins.tooltip.backgroundColor = '#1b1b3d';
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 10;

const userSelect = document.getElementById('userSelect');
const linkSelect = document.getElementById('linkSelect');

// לכל גרף שומרים את הנתונים האחרונים ואת האובייקט של Chart.js,
// כדי שאפשר יהיה לצייר אותו מחדש כשמחליפים סוג גרף
const charts = {
  byTarget: { chart: null, data: null },
  byLink: { chart: null, data: null },
  byDay: { chart: null, data: null }
};

function gradientFill(canvas) {
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 300);
  g.addColorStop(0, 'rgba(139, 92, 246, 0.9)');
  g.addColorStop(1, 'rgba(34, 211, 238, 0.5)');
  return g;
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
  if (!hasData) { empty.textContent = 'אין עדיין קליקים 🤷'; return; }

  const type = document.querySelector(`.typeSelect[data-chart="${key}"]`).value;
  const round = ['pie', 'doughnut', 'polarArea'].includes(type);
  const palette = data.labels.map((_, i) => COLORS[i % COLORS.length]);

  let background = palette;
  if (type === 'bar' && key === 'byDay') background = gradientFill(canvas);
  if (type === 'line' || type === 'radar') background = 'rgba(139, 92, 246, 0.25)';

  charts[key].chart = new Chart(canvas, {
    type,
    data: {
      labels: data.labels,
      datasets: [{
        label: 'קליקים',
        data: data.values,
        backgroundColor: background,
        borderColor: round ? '#11112a' : '#8b5cf6',
        borderWidth: round ? 3 : 2,
        borderRadius: type === 'bar' ? 10 : 0,
        pointBackgroundColor: '#22d3ee',
        pointRadius: 5,
        fill: type === 'line' || type === 'radar',
        tension: 0.4,
        hoverOffset: 12
      }]
    },
    options: {
      maintainAspectRatio: false,
      cutout: type === 'doughnut' ? '62%' : undefined,
      plugins: {
        legend: {
          display: round,
          position: 'bottom',
          labels: { usePointStyle: true, padding: 16 }
        }
      },
      scales: ['bar', 'line'].includes(type)
        ? { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
        : type === 'radar'
          ? { r: { beginAtZero: true, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.08)' } } }
          : type === 'polarArea'
            ? { r: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.08)' } } }
            : {}
    }
  });
}

// ---------- בניית הנתונים ----------

// גרף 1: קליקים על קישור אחד לפי מקור (target) - מה-endpoint של ספרינט 3
async function loadLinkStats(linkId) {
  const stats = await request(`/links/${linkId}/stats`);
  charts.byTarget.data = {
    labels: Object.keys(stats.byTarget),
    values: Object.values(stats.byTarget)
  };
  drawChart('byTarget');
}

// גרף 2: כמות קליקים כוללת לכל קישור של המשתמש
function buildByLink(links) {
  return {
    labels: links.map(l => shortUrl(l.originalUrl, 22)),
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

function updateKpis(links, byDay) {
  const allClicks = links.flatMap(l => l.clicks);
  const unique = new Set(allClicks.map(c => c.ipAddress)).size;
  const max = Math.max(...byDay.values);
  document.getElementById('kpiClicks').textContent = allClicks.length;
  document.getElementById('kpiLinks').textContent = links.length;
  document.getElementById('kpiUnique').textContent = unique;
  document.getElementById('kpiDay').textContent = max > 0 ? byDay.labels[byDay.values.indexOf(max)] : '–';
}

async function loadUser(userId) {
  const links = await request(`/users/${userId}/links`);

  linkSelect.innerHTML = '';
  linkSelect.add(new Option('בחרו קישור', ''));
  links.forEach(l => {
    linkSelect.add(new Option(`${shortUrl(l.originalUrl, 30)} (${l.clicks.length})`, l._id));
  });

  charts.byLink.data = buildByLink(links);
  charts.byDay.data = buildByDay(links);
  charts.byTarget.data = null;
  updateKpis(links, charts.byDay.data);
  document.getElementById('byTargetEmpty').textContent = 'בחרו קישור';
  drawChart('byLink');
  drawChart('byDay');
  drawChart('byTarget');

  // אם יש קישור אחד בלבד - בוחרים אותו אוטומטית
  if (links.length === 1) {
    linkSelect.value = links[0]._id;
    await loadLinkStats(links[0]._id);
  }
}

async function init() {
  const users = await request('/users');
  users.forEach(u => userSelect.add(new Option(`${u.name} (${u.email})`, u._id)));

  // הגעה מעמוד הקישורים: stats.html?user=<id>&link=<id>, ואם אין - המשתמש המחובר
  const params = new URLSearchParams(location.search);
  const userId = params.get('user') || getCurrentUser()?._id;
  if (userId && users.some(u => u._id === userId)) {
    userSelect.value = userId;
    await loadUser(userId);
    if (params.get('link')) {
      linkSelect.value = params.get('link');
      await loadLinkStats(linkSelect.value);
    }
  }
}

userSelect.addEventListener('change', () => {
  if (userSelect.value) loadUser(userSelect.value).catch(showError);
});

linkSelect.addEventListener('change', () => {
  if (linkSelect.value) loadLinkStats(linkSelect.value).catch(showError);
});

document.querySelectorAll('.typeSelect').forEach(select => {
  select.addEventListener('change', () => drawChart(select.dataset.chart));
});

init().catch(showError);
