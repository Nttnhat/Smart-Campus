<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Campus | Đăng nhập Quản trị</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    <style>
        body { margin: 0; padding: 0; }
        .login-wrapper {
            display: flex;
            min-height: 100vh;
            background-color: #f5f5f5;
        }

        .login-left {
            flex: 0 0 45%;
            background-color: var(--secondary);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem;
            text-align: center;
            position: relative;
            overflow: hidden;
            border-top-right-radius: 40px;
            border-bottom-right-radius: 40px;
            box-shadow: 10px 0 20px rgba(0,0,0,0.1);
            z-index: 2;
        }

        .login-left::before {
            content: '';
            position: absolute;
            top: -10%; left: -10%;
            width: 300px; height: 300px;
            background: rgba(255,255,255,0.05);
            border-radius: 50%;
        }

        .login-right {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem;
            background-color: #f8fafc;
        }

        .login-logo {
            margin-bottom: 2rem;
            background: white;
            padding: 1rem 2rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
        }

        .login-left h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin: 0;
            line-height: 1.2;
            letter-spacing: 1px;
        }

        .login-form-container {
            width: 100%;
            max-width: 400px;
            background: white;
            padding: 3rem 2.5rem;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-sm);
        }

        .login-form-container h2 {
            text-align: center;
            color: var(--secondary);
            font-size: 2rem;
            margin-top: 0;
            margin-bottom: 1.5rem;
        }

        .social-login {
            display: flex;
            justify-content: center;
            margin-bottom: 2rem;
        }

        .social-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: #3b5998;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            transition: transform 0.2s;
        }

        .social-btn:hover {
            transform: scale(1.1);
        }

        .form-group {
            position: relative;
            margin-bottom: 1.5rem;
        }

        .form-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--secondary);
        }

        .form-control {
            width: 100%;
            padding: 1rem 1rem 1rem 3rem;
            border: 1px solid rgba(0,0,0,0.1);
            border-radius: var(--border-radius);
            font-size: 1rem;
            background: #f8fafc;
            transition: all 0.3s;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--secondary);
            background: white;
            box-shadow: 0 0 0 3px rgba(211, 17, 69, 0.1);
        }

        .btn-login {
            width: 100%;
            padding: 1rem;
            font-size: 1.1rem;
            background-color: var(--secondary);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-weight: 600;
            margin-top: 1rem;
            transition: background 0.3s;
        }

        .btn-login:hover {
            background-color: var(--secondary-hover);
        }

        .lang-switch {
            position: absolute;
            top: 2rem;
            right: 2rem;
            display: flex;
            gap: 0.5rem;
        }

        .lang-flag {
            width: 30px;
            height: 20px;
            background: #ddd;
            border-radius: 2px;
            cursor: pointer;
        }

        .error-message {
            color: var(--secondary);
            font-size: 0.85rem;
            margin-top: 0.5rem;
            display: none;
            text-align: center;
            font-weight: 500;
        }

        @media (max-width: 768px) {
            .login-wrapper {
                flex-direction: column;
            }
            .login-left {
                border-radius: 0;
                border-bottom-right-radius: 40px;
                border-bottom-left-radius: 40px;
                padding: 2rem;
            }
        }
    </style>
</head>
<body>

    <div class="login-wrapper">
        <div class="login-left">
            <div class="login-logo">
                <img src="image/logo.svg" alt="TDTU Logo" height="80">
            </div>
            <h1>CỔNG<br>QUẢN TRỊ<br>HỆ THỐNG</h1>
        </div>

        <div class="login-right">
            <div class="lang-switch">
                <div class="lang-flag" style="background: #da251d; border: 1px solid #ccc; position: relative; display: flex; align-items: center; justify-content: center;" title="Tiếng Việt">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffcd00"><polygon points="12,2 14.7,9.5 22.9,9.5 16.3,14.2 18.9,21.8 12,17 5.1,21.8 7.7,14.2 1.1,9.5 9.3,9.5"></polygon></svg>
                </div>
            </div>

            <div class="login-form-container">
                <h2>ĐĂNG NHẬP QUẢN TRỊ</h2>
                <p style="text-align:center; color: var(--secondary, #64748b); font-size: 0.9rem; margin-top: -1rem; margin-bottom: 1.5rem;">Chỉ dành cho quản trị viên hệ thống.</p>

                <form id="loginForm">
                    <div class="form-group">
                        <svg class="form-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <input type="text" id="username" class="form-control" placeholder="Tên đăng nhập quản trị" required autocomplete="off">
                    </div>

                    <div class="form-group">
                        <svg class="form-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <input type="password" id="password" class="form-control" placeholder="Mật khẩu quản trị" required>
                        <svg style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #999; cursor: pointer;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </div>

                    <div id="errorMessage" class="error-message">Tên đăng nhập hoặc mật khẩu không đúng!</div>

                    <button type="submit" class="btn-login">ĐĂNG NHẬP</button>
                </form>
            </div>
        </div>
    </div>

    <script src="js/login.js?v=<?php echo @filemtime(__DIR__.'/js/login.js') ?: time(); ?>"></script>
</body>
</html>
