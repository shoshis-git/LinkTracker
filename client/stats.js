const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const COLORS = ['#8b5cf6', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#fb923c', '#60a5fa', '#f87171', '#a3e635', '#e879f9'];


Chart.defaults.color = '#9b99c2';
Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
Chart.defaults.font.family = 'Rubik, Arial, sans-serif';
Chart.defaults.plugins.tooltip.backgroundColor = '#1b1b3d';
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 10;

const linkSelect = document.getElementById('linkSelect');

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



async function loadLinkStats(linkId) {
  const stats = await request(`/links/${linkId}/stats`);
  charts.byTarget.data = {
    labels: Object.keys(stats.byTarget),
    values: Object.values(stats.byTarget)
  };
  drawChart('byTarget');
}


function buildByLink(links) {
  return {
    labels: links.map(l => shortUrl(l.originalUrl, 22)),
    values: links.map(l => l.clicks.length)
  };
}


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

async function loadMyLinks() {
  const links = await request('/links');

  linkSelect.innerHTML = '';
  linkSelect.add(new Option('בחרו קישור', ''));
  links.forEach(l => {
    const option = new Option(shortUrl(l.originalUrl, 40), l._id);
    option.dataset.badge = `${l.clicks.length} קליקים`;
    linkSelect.add(option);
  });

  charts.byLink.data = buildByLink(links);
  charts.byDay.data = buildByDay(links);
  charts.byTarget.data = null;
  updateKpis(links, charts.byDay.data);
  document.getElementById('byTargetEmpty').textContent = 'בחרו קישור';
  drawChart('byLink');
  drawChart('byDay');
  drawChart('byTarget');

 
  if (links.length === 1) {
    linkSelect.value = links[0]._id;
    await loadLinkStats(links[0]._id);
  }
}

async function init() {
  await loadMyLinks();

  const linkId = new URLSearchParams(location.search).get('link');
  if (linkId) {
    linkSelect.value = linkId;
    if (linkSelect.value) await loadLinkStats(linkId);
  }
}

linkSelect.addEventListener('change', () => {
  if (linkSelect.value) loadLinkStats(linkSelect.value).catch(showError);
});

document.querySelectorAll('.typeSelect').forEach(select => {
  select.addEventListener('change', () => drawChart(select.dataset.chart));
  fancySelect(select);
});
fancySelect(linkSelect);

if (requireLogin()) init().catch(showError);
