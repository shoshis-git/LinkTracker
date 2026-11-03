const API = 'http://localhost:3000';


function getSession() {
  return JSON.parse(localStorage.getItem('session') || 'null');
}

function getCurrentUser() {
  return getSession()?.user || null;
}

function setSession({ token, user }) {
  localStorage.setItem('session', JSON.stringify({ token, user: { _id: user._id, name: user.name, email: user.email } }));
  renderNav();
}

function updateSessionUser(user) {
  const session = getSession();
  if (session) setSession({ token: session.token, user });
}

function logout() {
  localStorage.removeItem('session');
  location.href = 'index.html';
}
function requireLogin() {
  if (getSession()) return true;
  const here = location.pathname.split('/').pop() + location.search;
  location.href = 'users.html?next=' + encodeURIComponent(here);
  return false;
}



async function request(path, method = 'GET', body) {
  const session = getSession();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (session) headers['Authorization'] = 'Bearer ' + session.token;

  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);

  if (res.status === 401 && session) {
    localStorage.removeItem('session');
    location.href = 'users.html?expired=1';
  }
  if (!res.ok) throw new Error((data && data.message) || res.status);
  return data;
}




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

// מחליף <select> רגיל בתפריט נפתח מעוצב.
// ה-select המקורי נשאר (מוסתר) ומחזיק את הערך, כך שקוד שקורא select.value או מאזין ל-change ממשיך לעבוד.
// אפשר להוסיף לכל option את data-badge כדי להציג תגית בצד
function fancySelect(select) {
  const wrapper = el('div', { className: 'fselect' });
  const button = el('button', { type: 'button', className: 'fselect-btn' });
  const menu = el('div', { className: 'fselect-menu' });
  select.after(wrapper);
  wrapper.append(button, menu, select);
  select.hidden = true;

  function render() {
    const current = select.options[select.selectedIndex];
    button.replaceChildren(
      el('span', { className: 'fselect-label', textContent: current ? current.text : '', dir: 'auto' }),
      el('span', { className: 'fselect-arrow', textContent: '▾' })
    );
    menu.replaceChildren(...[...select.options].map(option => {
      const item = el('div', {
        className: 'fselect-item' + (option.selected ? ' selected' : '') + (option.value === '' ? ' placeholder' : '')
      }, el('span', { className: 'fselect-label', textContent: option.text, dir: 'auto' }));
      if (option.dataset.badge) item.append(el('span', { className: 'badge', textContent: option.dataset.badge }));
      item.onclick = () => {
        select.value = option.value;
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change'));
      };
      return item;
    }));
  }

  button.onclick = () => {
    document.querySelectorAll('.fselect.open').forEach(w => { if (w !== wrapper) w.classList.remove('open'); });
    wrapper.classList.toggle('open');
  };
  document.addEventListener('click', e => { if (!wrapper.contains(e.target)) wrapper.classList.remove('open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') wrapper.classList.remove('open'); });

  // מעדכנים את התצוגה כשמוסיפים אפשרויות, או כשהקוד משנה את select.value
  new MutationObserver(render).observe(select, { childList: true });
  const valueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(select, 'value', {
    get() { return valueProp.get.call(this); },
    set(v) { valueProp.set.call(this, v); render(); }
  });
  render();
}


function renderNav() {
  document.querySelector('.topbar')?.remove();
  const current = location.pathname.split('/').pop() || 'index.html';
  const user = getCurrentUser();

  const pages = [
    { href: 'index.html', text: 'בית' },
    { href: 'links.html', text: 'הקישורים שלי' },
    { href: 'stats.html', text: 'סטטיסטיקות' },
    { href: 'users.html', text: user ? 'החשבון שלי' : 'התחברות' }
  ];
  const links = pages.map(p =>
    el('a', { href: p.href, textContent: p.text, className: p.href === current ? 'active' : '' })
  );

  const chip = el('div', { className: 'userchip' });
  if (user) {
    chip.append(
      el('span', { textContent: 'שלום, ' + user.name }),
      el('a', { href: 'users.html', className: 'avatar', textContent: user.name[0].toUpperCase(),
        style: 'width:34px;height:34px;font-size:15px;text-decoration:none' }),
      el('button', { className: 'btn btn-sm', textContent: 'יציאה', onclick: logout })
    );
  } else {
    chip.append(el('a', { href: 'users.html#register', className: 'btn btn-sm btn-primary', textContent: 'הרשמה' }));
  }

  const header = el('header', { className: 'topbar' },
    el('div', { className: 'topbar-inner' },
      el('a', { href: 'index.html', className: 'logo' },
        el('img', { className: 'logo-mark', src: 'favicon.svg', alt: '' }),
        el('span', { className: 'gradient-text', textContent: 'TinyURL' })
      ),
      el('nav', { className: 'navlinks' }, ...links),
      chip
    )
  );
  document.body.prepend(header);
}

renderNav();
