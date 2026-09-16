document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMessage');

            if (user === 'admin' && pass === 'admin') {
                errorMsg.style.display = 'none';
                window.location.href = 'admin.html';
            } else if (user && pass) {
                // Any other non-empty credentials act as a normal student login
                errorMsg.style.display = 'none';
                window.location.href = 'home.html';
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