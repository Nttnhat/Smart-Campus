// Trang này chỉ dùng để đăng nhập vào admin.php. Người dùng thường không cần đăng nhập, cứ vào
// thẳng home.php/navigation.php/campus-map.php... (không trang nào kiểm tra phiên đăng nhập).
document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMessage');

            if (user === 'admin' && pass === 'admin') {
                errorMsg.style.display = 'none';
                window.location.href = 'admin.php';
            } else {
                errorMsg.style.display = 'block';
                const container = document.querySelector('.login-form-container') || document.querySelector('.login-container');
                if (container) {
                    container.style.animation = 'none';
                    container.offsetHeight;
                    container.style.animation = 'shake 0.4s';
                }
            }
        });