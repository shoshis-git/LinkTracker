const modal = document.getElementById('modal');
const form = document.getElementById('userForm');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');
const passwordInput = document.getElementById('passwordInput');
const usersList = document.getElementById('usersList');

let editingId = null;   // null = הרשמה, אחרת = מזהה המשתמש שעורכים

// ---------- חלון קופץ ----------

function openModal(user) {
  form.reset();
  editingId = user ? user._id : null;
  if (user) {
    form.name.value = user.name;
    form.email.value = user.email;
  }
  passwordInput.required = !user;
  passwordInput.placeholder = user ? 'השאירו ריק כדי לא לשנות' : '••••••••';
  modalTitle.textContent = user ? 'עריכת משתמש' : 'הרשמה';
  submitBtn.textContent = user ? 'שמירת שינויים' : 'יצירת חשבון';
  modal.hidden = false;
  form.name.focus();
}

function closeModal() {
  modal.hidden = true;
}

document.getElementById('registerBtn').onclick = () => openModal();
document.getElementById('registerLink').onclick = e => { e.preventDefault(); openModal(); };
document.getElementById('closeModal').onclick = closeModal;
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const body = { name: form.name.value, email: form.email.value };
  if (form.password.value) body.password = form.password.value;
  try {
    if (editingId) {
      await request(`/users/${editingId}`, 'PUT', body);
      showMessage('המשתמש עודכן');
    } else {
      const user = await request('/users', 'POST', body);
      setCurrentUser(user);
      showMessage(`ברוך הבא, ${user.name}! 🎉`);
    }
    closeModal();
    loadUsers();
  } catch (e) { showError(e); }
});

// ---------- רשימת משתמשים ----------

async function loadUsers() {
  const users = await request('/users');
  document.getElementById('usersCount').textContent = users.length;
  usersList.innerHTML = '';

  if (users.length === 0) {
    usersList.append(el('div', { className: 'empty' },
      el('span', { className: 'big', textContent: '👤' }), 'עדיין אין משתמשים - היו הראשונים להירשם'));
    return;
  }

  users.forEach((user, i) => {
    const item = el('div', { className: 'list-item', style: `animation: rise .4s ${i * 0.05}s ease both` },
      el('div', { className: 'avatar', textContent: user.name[0].toUpperCase() }),
      el('div', { className: 'grow' },
        el('div', { className: 'title', textContent: user.name }),
        el('div', { className: 'sub ltr', textContent: user.email, style: 'text-align:right' })
      ),
      el('span', { className: 'badge', textContent: `${user.links.length} קישורים` }),
      el('div', { className: 'row' },
        el('a', { className: 'btn btn-sm', textContent: 'קישורים', href: `links.html?user=${user._id}` }),
        el('button', { className: 'btn btn-sm', textContent: 'עריכה', onclick: () => openModal(user) }),
        el('button', { className: 'btn btn-sm btn-danger', textContent: 'מחיקה', onclick: () => deleteUser(user) })
      )
    );
    usersList.append(item);
  });
}

async function deleteUser(user) {
  if (!confirm(`למחוק את ${user.name}? גם כל הקישורים שלו יימחקו.`)) return;
  try {
    await request(`/users/${user._id}`, 'DELETE');
    if (getCurrentUser()?._id === user._id) setCurrentUser(null);
    showMessage('המשתמש נמחק');
    loadUsers();
  } catch (e) { showError(e); }
}

// ---------- התחברות ----------

const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const user = await request('/users/login', 'POST', {
      email: loginForm.email.value,
      password: loginForm.password.value
    });
    setCurrentUser(user);
    showMessage(`שלום ${user.name}, התחברת בהצלחה`);
    loginForm.reset();
    setTimeout(() => location.href = `links.html?user=${user._id}`, 900);
  } catch (e) { showError(e); }
});

loadUsers().catch(showError);

// הגעה מכפתור "הרשמה" בדף הבית
if (location.hash === '#register') openModal();
