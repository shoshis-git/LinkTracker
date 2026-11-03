function countUp(id, target) {
  const element = document.getElementById(id);
  const duration = 1200;
  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function loadCounters() {
  const summary = await request('/links/summary');
  countUp('countUsers', summary.users);
  countUp('countLinks', summary.links);
  countUp('countClicks', summary.clicks);
}


loadCounters().catch(() => {});
