// Trang này chỉ dùng để đăng nhập vào admin.php (qua api/login.php + session PHP thật, bảng
// `admins` trong database). Người dùng thường không cần đăng nhập, cứ vào thẳng
// home.php/navigation.php/campus-map.php... (không trang nào kiểm tra phiên đăng nhập).
document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMessage');
            const submitBtn = e.target.querySelector('.btn-login');

            function showError() {
                errorMsg.style.display = 'block';
                const container = document.querySelector('.login-form-container') || document.querySelector('.login-container');
                if (container) {
                    container.style.animation = 'none';
                    container.offsetHeight;
                    container.style.animation = 'shake 0.4s';
                }
            }

            submitBtn.disabled = true;
            try {
                const body = new URLSearchParams({ username: user, password: pass });
                const res = await fetch('api/login.php', { method: 'POST', body });
                if (res.ok) {
                    errorMsg.style.display = 'none';
                    window.location.href = 'admin.php';
                } else {
                    showError();
                }
            } catch (_) {
                showError();
            } finally {
                submitBtn.disabled = false;
            }
        });