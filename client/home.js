// אנימציה של מספר שעולה מ-0 עד הערך הסופי
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
  const [users, links] = await Promise.all([request('/users'), request('/links')]);
  const clicks = links.reduce((sum, link) => sum + link.clicks.length, 0);
  countUp('countUsers', users.length);
  countUp('countLinks', links.length);
  countUp('countClicks', clicks);
}

// בדף הבית לא מציגים שגיאה אם השרת כבוי - המונים פשוט נשארים 0
loadCounters().catch(() => {});
