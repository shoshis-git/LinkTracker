const API = 'http://localhost:3000';

// ---------- תקשורת עם השרת ----------

// שולח בקשה לשרת ומחזיר את ה-JSON. אם השרת החזיר שגיאה - זורק אותה עם ההודעה מהשרת
async function request(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || res.status);
  return data;
}

// ---------- יצירת אלמנטים ----------

// יוצר אלמנט HTML. טקסט נכנס דרך textContent ולא innerHTML, כדי שלא ירוץ כקוד
function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  Object.assign(element, props);
  children.forEach(c => element.append(c));
  return element;
}

function shortUrl(url, max = 34) {
  try {
    const u = new URL(url);
    const text = u.hostname.replace(/^www\./, '') + u.pathname;
    return text.length > max ? text.slice(0, max) + '…' : text;
  } catch {
    return url;
  }
}

// ---------- הודעות קופצות ----------

function showMessage(text, isError = false) {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = el('div', { className: 'toasts' });
    document.body.append(box);
  }
  const toast = el('div', { className: isError ? 'toast error' : 'toast', textContent: text });
  box.append(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showError(e) {
  showMessage(e instanceof TypeError ? 'אין חיבור לשרת - האם הוא רץ?' : 'שגיאה: ' + e.message, true);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  showMessage('הועתק ✓');
}

// ---------- משתמש מחובר (נשמר בדפדפן) ----------

function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

function setCurrentUser(user) {
  if (user) localStorage.setItem('currentUser', JSON.stringify({ _id: user._id, name: user.name }));
  else localStorage.removeItem('currentUser');
  renderNav();
}

// ---------- באנר עליון - משותף לכל העמודים ----------

const PAGES = [
  { href: 'index.html', text: 'בית' },
  { href: 'users.html', text: 'משתמשים' },
  { href: 'links.html', text: 'קישורים' },
  { href: 'stats.html', text: 'סטטיסטיקות' }
];

function renderNav() {
  document.querySelector('.topbar')?.remove();
  const current = location.pathname.split('/').pop() || 'index.html';

  const links = PAGES.map(p =>
    el('a', { href: p.href, textContent: p.text, className: p.href === current ? 'active' : '' })
  );

  const user = getCurrentUser();
  const chip = el('div', { className: 'userchip' });
  if (user) {
    chip.append(
      el('span', { textContent: 'שלום, ' + user.name }),
      el('div', { className: 'avatar', textContent: user.name[0].toUpperCase(), style: 'width:34px;height:34px;font-size:15px' }),
      el('button', { className: 'btn btn-sm', textContent: 'יציאה', onclick: () => setCurrentUser(null) })
    );
  } else {
    chip.append(el('a', { href: 'users.html', className: 'btn btn-sm btn-primary', textContent: 'התחברות' }));
  }

  const header = el('header', { className: 'topbar' },
    el('div', { className: 'topbar-inner' },
      el('a', { href: 'index.html', className: 'logo' },
        el('span', { className: 'logo-mark', textContent: '⚡' }),
        el('span', { className: 'gradient-text', textContent: 'TinyURL' })
      ),
      el('nav', { className: 'navlinks' }, ...links),
      chip
    )
  );
  document.body.prepend(header);
}

renderNav();
