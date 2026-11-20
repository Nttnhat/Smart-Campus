// Trang đăng nhập 2 tab:
// - Sinh viên: api/user/login.php  (không bắt buộc - khách vẫn dùng bản đồ bình thường)
// - Quản trị:  api/login.php (bảng admins) -> admin.php
document.addEventListener('DOMContentLoaded', () => {
  const { apiFetch } = window.SCApi;
  const tabs = [...document.querySelectorAll('.login-tab')];
  const panels = [...document.querySelectorAll('.login-panel')];

  function selectTab(name) {
    tabs.forEach(t => {
      const active = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
    const firstInput = document.querySelector(`.login-panel[data-panel="${name}"] input`);
    if (firstInput) firstInput.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      selectTab(next.dataset.tab);
    });
  });
  selectTab(window.LOGIN_INITIAL_TAB || 'student');

  function showError(form, message) {
    const box = form.querySelector('.error-message');
    box.textContent = message;
    box.style.display = 'block';
    const container = document.querySelector('.login-form-container');
    if (container) {
      container.style.animation = 'none';
      void container.offsetHeight;
      container.style.animation = 'shake 0.4s';
    }
  }

  function clearError(form) {
    const box = form.querySelector('.error-message');
    box.textContent = '';
    box.style.display = 'none';
  }

  function goNext(fallback) {
    window.location.href = window.LOGIN_NEXT || fallback;
  }

  async function submitWith(form, url, data, fallback) {
    clearError(form);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await apiFetch(url, { method: 'POST', data });
      goNext(fallback);
    } catch (err) {
      showError(form, err.message || 'Không kết nối được máy chủ');
    } finally {
      button.disabled = false;
    }
  }

  const studentForm = document.getElementById('studentForm');
  studentForm.addEventListener('submit', e => {
    e.preventDefault();
    const code = studentForm.querySelector('#studentCode').value.trim();
    const password = studentForm.querySelector('#studentPassword').value;
    if (!code || !password) return showError(studentForm, 'Hãy nhập MSSV và mật khẩu');
    submitWith(studentForm, 'api/user/login.php', { student_code: code, password }, 'home.php');
  });

  const adminForm = document.getElementById('loginForm');
  adminForm.addEventListener('submit', e => {
    e.preventDefault();
    const username = adminForm.querySelector('#username').value.trim();
    const password = adminForm.querySelector('#password').value;
    if (!username || !password) return showError(adminForm, 'Hãy nhập tên đăng nhập và mật khẩu');
    submitWith(adminForm, 'api/login.php', { username, password }, 'admin.php');
  });
});
