const userSelect = document.getElementById('userSelect');
const form = document.getElementById('linkForm');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const targetsBox = document.getElementById('targetsBox');
const linksBox = document.getElementById('linksBox');

let editingId = null;

// ---------- שורות של מקורות (targets) בטופס ----------

function addTargetRow(name = '', value = '') {
  const nameInput = el('input', { placeholder: 'שם (פייסבוק)', value: name, className: 'targetName' });
  const valueInput = el('input', { placeholder: 'ערך (fb)', value: value, className: 'targetValue ltr' });
  const removeBtn = el('button', { type: 'button', textContent: '✕', className: 'btn btn-sm btn-danger' });
  const row = el('div', { className: 'target-row' }, nameInput, valueInput, removeBtn);
  removeBtn.onclick = () => row.remove();
  targetsBox.append(row);
}

function readTargets() {
  return [...targetsBox.querySelectorAll('.target-row')]
    .map(row => ({
      name: row.querySelector('.targetName').value.trim(),
      value: row.querySelector('.targetValue').value.trim()
    }))
    .filter(t => t.name && t.value);
}

// ---------- רשימת הקישורים ----------

function linkCard(link, i) {
  const shortLink = `${API}/${link._id}`;

  const chips = link.targetValues.map(t => {
    const url = `${shortLink}?${link.targetParamName}=${encodeURIComponent(t.value)}`;
    return el('span', { className: 'chip', title: 'לחצו להעתקה: ' + url, onclick: () => copyText(url) },
      t.name, el('code', { className: 'ltr', textContent: `?${link.targetParamName}=${t.value}` }), '📋');
  });

  return el('div', { className: 'glass link-card', style: `animation-delay:${i * 0.06}s` },
    el('div', { className: 'link-head' },
      el('div', { className: 'icon', textContent: '🔗' }),
      el('div', { className: 'grow' },
        el('a', { href: link.originalUrl, target: '_blank', textContent: shortUrl(link.originalUrl, 50), title: link.originalUrl, dir: 'ltr' }),
        el('div', { className: 'sub', textContent: `פרמטר: ${link.targetParamName} · ${link.targetValues.length} מקורות` })
      ),
      el('span', { className: 'badge', textContent: `${link.clicks.length} קליקים` })
    ),
    el('div', { className: 'short-box' },
      el('a', { href: shortLink, target: '_blank', textContent: shortLink, className: 'ltr mono' }),
      el('button', { className: 'btn btn-sm btn-primary', textContent: 'העתקה', onclick: () => copyText(shortLink) })
    ),
    chips.length ? el('div', { className: 'chips' }, ...chips) : '',
    el('div', { className: 'row' },
      el('a', { className: 'btn btn-sm', textContent: '📊 סטטיסטיקות', href: `stats.html?user=${userSelect.value}&link=${link._id}` }),
      el('button', { className: 'btn btn-sm', textContent: 'עריכה', onclick: () => startEdit(link) }),
      el('button', { className: 'btn btn-sm btn-danger', textContent: 'מחיקה', onclick: () => deleteLink(link) })
    )
  );
}

function emptyState(icon, text) {
  return el('div', { className: 'glass empty' }, el('span', { className: 'big', textContent: icon }), text);
}

async function loadLinks() {
  linksBox.innerHTML = '';
  if (!userSelect.value) {
    linksBox.append(emptyState('👆', 'בחרו משתמש כדי לראות את הקישורים שלו'));
    return;
  }
  const links = await request(`/users/${userSelect.value}/links`);
  if (links.length === 0) {
    linksBox.append(emptyState('🔗', 'עדיין אין קישורים - צרו את הראשון בטופס'));
    return;
  }
  links.reverse().forEach((link, i) => linksBox.append(linkCard(link, i)));
}

// ---------- טופס הוספה / עריכה ----------

function startEdit(link) {
  editingId = link._id;
  form.originalUrl.value = link.originalUrl;
  form.targetParamName.value = link.targetParamName;
  targetsBox.innerHTML = '';
  link.targetValues.forEach(t => addTargetRow(t.name, t.value));
  formTitle.textContent = 'עריכת קישור';
  submitBtn.textContent = 'שמירת שינויים';
  cancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  editingId = null;
  form.reset();
  targetsBox.innerHTML = '';
  formTitle.textContent = 'קישור חדש';
  submitBtn.textContent = '⚡ קיצור קישור';
  cancelBtn.hidden = true;
}

async function deleteLink(link) {
  if (!confirm(`למחוק את הקישור ל-${link.originalUrl}? כל הקליקים שלו יימחקו.`)) return;
  try {
    await request(`/links/${link._id}`, 'DELETE');
    showMessage('הקישור נמחק');
    if (editingId === link._id) resetForm();
    loadLinks();
  } catch (e) { showError(e); }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!userSelect.value) return showMessage('קודם בחרו משתמש', true);
  const body = {
    originalUrl: form.originalUrl.value,
    targetParamName: form.targetParamName.value.trim(),
    targetValues: readTargets()
  };
  try {
    if (editingId) {
      await request(`/links/${editingId}`, 'PUT', body);
      showMessage('הקישור עודכן');
    } else {
      const link = await request('/links', 'POST', { ...body, userId: userSelect.value });
      copyText(`${API}/${link._id}`).catch(() => {});
      showMessage('הקישור נוצר והועתק ללוח 🎉');
    }
    resetForm();
    loadLinks();
  } catch (e) { showError(e); }
});

document.getElementById('addTargetBtn').addEventListener('click', () => addTargetRow());
cancelBtn.addEventListener('click', resetForm);
userSelect.addEventListener('change', () => {
  resetForm();
  loadLinks().catch(showError);
});

async function init() {
  const users = await request('/users');
  users.forEach(u => userSelect.add(new Option(`${u.name} (${u.email})`, u._id)));

  // משתמש מה-URL (links.html?user=<id>), ואם אין - המשתמש המחובר
  const userId = new URLSearchParams(location.search).get('user') || getCurrentUser()?._id;
  if (userId && users.some(u => u._id === userId)) userSelect.value = userId;
  await loadLinks();
}

init().catch(showError);
