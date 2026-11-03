const modal = document.getElementById('modal');
const form = document.getElementById('userForm');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');
const passwordInput = document.getElementById('passwordInput');

const params = new URLSearchParams(location.search);
let isEditing = false;   // false = הרשמה, true = עריכת הפרטים שלי

function goNext() {
  const next = params.get('next');
  location.href = next && !next.includes(':') ? next : 'links.html';
}



function openModal(editing) {
  form.reset();
  isEditing = editing;
  if (editing) {
    const user = getCurrentUser();
    form.name.value = user.name;
    form.email.value = user.email;
  }
  passwordInput.required = !editing;
  passwordInput.placeholder = editing ? 'השאירו ריק כדי לא לשנות' : '••••••••';
  modalTitle.textContent = editing ? 'עריכת פרטים' : 'הרשמה';
  submitBtn.textContent = editing ? 'שמירת שינויים' : 'יצירת חשבון';
  modal.hidden = false;
  form.name.focus();
}

function closeModal() {
  modal.hidden = true;
}

document.querySelectorAll('[data-open-register]').forEach(b =>
  b.addEventListener('click', e => { e.preventDefault(); openModal(false); }));
document.getElementById('editBtn').onclick = () => openModal(true);
document.getElementById('closeModal').onclick = closeModal;
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const body = { name: form.name.value, email: form.email.value };
  if (form.password.value) body.password = form.password.value;
  try {
    if (isEditing) {
      const user = await request(`/users/${getCurrentUser()._id}`, 'PUT', body);
      updateSessionUser(user);
      showMessage('הפרטים עודכנו');
      closeModal();
      showUserView();
    } else {
      const data = await request('/users', 'POST', body);
      setSession(data);
      showMessage(`ברוך הבא, ${data.user.name}! 🎉`);
      setTimeout(goNext, 700);
    }
  } catch (e) { showError(e); }
});



const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const data = await request('/users/login', 'POST', {
      email: loginForm.email.value,
      password: loginForm.password.value
    });
    setSession(data);
    showMessage(`שלום ${data.user.name}, התחברת בהצלחה`);
    setTimeout(goNext, 700);
  } catch (e) {
    showMessage(e.message === 'Invalid email or password' ? 'אימייל או סיסמה שגויים' : 'שגיאה: ' + e.message, true);
  }
});



async function showUserView() {
  const user = getCurrentUser();
  document.getElementById('userView').hidden = false;
  document.getElementById('profileAvatar').textContent = user.name[0].toUpperCase();
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileEmail').textContent = user.email;

  const links = await request('/links');
  document.getElementById('profileLinks').textContent = links.length;
  document.getElementById('profileClicks').textContent = links.reduce((sum, l) => sum + l.clicks.length, 0);

  const list = document.getElementById('recentLinks');
  list.innerHTML = '';
  if (links.length === 0) {
    list.append(el('div', { className: 'empty' },
      el('span', { className: 'big', textContent: '🔗' }), 'עדיין אין קישורים - ',
      el('a', { href: 'links.html', textContent: 'צרו את הראשון' })));
    return;
  }
  links.slice(-5).reverse().forEach(link => {
    list.append(el('div', { className: 'list-item' },
      el('div', { className: 'icon', textContent: '🔗' }),
      el('div', { className: 'grow' },
        el('div', { className: 'title', textContent: shortUrl(link.originalUrl, 40), dir: 'ltr', style: 'text-align:right' }),
        el('div', { className: 'sub ltr mono', textContent: `${API}/${link._id}`, style: 'text-align:right' })
      ),
      el('span', { className: 'badge', textContent: `${link.clicks.length} קליקים` }),
      el('a', { className: 'btn btn-sm', textContent: '📊', title: 'סטטיסטיקות', href: `stats.html?link=${link._id}` })
    ));
  });
}

document.getElementById('deleteBtn').onclick = async () => {
  if (!confirm('למחוק את החשבון? כל הקישורים והנתונים שלך יימחקו לצמיתות.')) return;
  try {
    await request(`/users/${getCurrentUser()._id}`, 'DELETE');
    logout();
  } catch (e) { showError(e); }
};



if (getCurrentUser()) {
  showUserView().catch(showError);
} else {
  document.getElementById('guestView').hidden = false;
  if (params.get('expired')) showMessage('פג תוקף ההתחברות - התחברו מחדש', true);
  else if (params.get('next')) showMessage('צריך להתחבר כדי להמשיך');
  if (location.hash === '#register') openModal(false);
}
