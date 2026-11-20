<?php
require_once __DIR__ . '/config/auth.php';
// ?role=admin mở sẵn tab quản trị (admin.php chuyển hướng về đây khi chưa đăng nhập).
$initialTab = ($_GET['role'] ?? '') === 'admin' ? 'admin' : 'student';
$next = $_GET['next'] ?? '';
// Chỉ cho phép quay lại trang nội bộ (chặn open redirect).
if (!preg_match('/^[a-z\-]+\.php(\?[\w=&%\-.]*)?$/i', $next)) {
    $next = '';
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php echo csrf_meta(); ?>
    <title>Smart Campus | Đăng nhập</title>
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
        .login-tabs { display: flex; gap: .25rem; background: #eef2f7; border-radius: 999px; padding: .25rem; margin-bottom: 1.5rem; }
        .login-tab { flex: 1; border: 0; background: transparent; padding: .6rem .5rem; border-radius: 999px; font: inherit; font-weight: 600; color: #475569; cursor: pointer; }
        .login-tab[aria-selected="true"] { background: #fff; color: var(--secondary); box-shadow: 0 1px 4px rgba(15,23,42,.12); }
        .login-tab:focus-visible { outline: 3px solid var(--secondary); outline-offset: 2px; }
        .login-panel[hidden] { display: none; }
        .guest-link { display: block; text-align: center; margin-top: 1.25rem; color: var(--secondary); font-weight: 600; }
        .form-success { display: none; color: #15803d; background: #dcfce7; border-radius: 8px; padding: .6rem .8rem; margin-bottom: 1rem; font-size: .9rem; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    </style>
</head>
<body>

    <div class="login-wrapper">
        <div class="login-left">
            <div class="login-logo">
                <img src="image/logo.svg" alt="TDTU Logo" height="80">
            </div>
            <h1>BẢN ĐỒ<br>KHUÔN VIÊN<br>TDTU</h1>
        </div>

        <div class="login-right">
            <div class="lang-switch">
                <div class="lang-flag" style="background: #da251d; border: 1px solid #ccc; position: relative; display: flex; align-items: center; justify-content: center;" title="Tiếng Việt">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffcd00"><polygon points="12,2 14.7,9.5 22.9,9.5 16.3,14.2 18.9,21.8 12,17 5.1,21.8 7.7,14.2 1.1,9.5 9.3,9.5"></polygon></svg>
                </div>
            </div>

            <div class="login-form-container">
                <h2>XIN CHÀO!</h2>

                <div class="login-tabs" role="tablist" aria-label="Chọn kiểu đăng nhập">
                    <button type="button" class="login-tab" role="tab" id="tab-student" aria-controls="panel-student" data-tab="student">Người dùng</button>
                    <button type="button" class="login-tab" role="tab" id="tab-admin" aria-controls="panel-admin" data-tab="admin">Quản trị</button>
                </div>

                <form id="studentForm" class="login-panel" role="tabpanel" aria-labelledby="tab-student" data-panel="student" novalidate>
                    <div class="form-group">
                        <label class="sr-only" for="studentCode">MSSV</label>
                        <input type="text" id="studentCode" name="student_code" class="form-control" placeholder="Tài khoản người dùng" required autocomplete="username" inputmode="text">
                    </div>
                    <div class="form-group">
                        <label class="sr-only" for="studentPassword">Mật khẩu</label>
                        <input type="password" id="studentPassword" name="password" class="form-control" placeholder="Mật khẩu" required autocomplete="current-password">
                    </div>
                    <div class="error-message" role="alert"></div>
                    <button type="submit" class="btn-login">ĐĂNG NHẬP</button>
                </form>

                <form id="loginForm" class="login-panel" role="tabpanel" aria-labelledby="tab-admin" data-panel="admin" novalidate hidden>
                    <div class="form-group">
                        <label class="sr-only" for="username">Tên đăng nhập quản trị</label>
                        <input type="text" id="username" name="username" class="form-control" placeholder="Tên đăng nhập quản trị" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label class="sr-only" for="password">Mật khẩu quản trị</label>
                        <input type="password" id="password" name="password" class="form-control" placeholder="Mật khẩu quản trị" required autocomplete="current-password">
                    </div>
                    <div class="error-message" role="alert"></div>
                    <button type="submit" class="btn-login">ĐĂNG NHẬP QUẢN TRỊ</button>
                </form>

                <a class="guest-link" href="home.php">Tiếp tục với tư cách khách →</a>
            </div>
        </div>
    </div>

    <script>window.LOGIN_INITIAL_TAB = <?php echo json_encode($initialTab); ?>; window.LOGIN_NEXT = <?php echo json_encode($next); ?>;</script>
    <script src="js/api.js?v=<?php echo @filemtime(__DIR__.'/js/api.js') ?: time(); ?>"></script>
    <script src="js/login.js?v=<?php echo @filemtime(__DIR__.'/js/login.js') ?: time(); ?>"></script>
</body>
</html>
