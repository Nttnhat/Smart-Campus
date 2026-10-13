<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Campus | Chọn vai trò</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    <style>
        body { margin: 0; padding: 0; }
        .role-wrapper {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: var(--secondary);
            padding: 2rem;
            text-align: center;
        }
        .role-logo {
            margin-bottom: 2rem;
            background: white;
            padding: 1rem 2rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
        }
        .role-wrapper h1 {
            color: white;
            font-size: 1.9rem;
            font-weight: 800;
            margin: 0 0 2.5rem;
            letter-spacing: 1px;
        }
        .role-cards {
            display: flex;
            gap: 1.5rem;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 720px;
        }
        .role-card {
            width: 260px;
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-sm);
            padding: 2.5rem 1.5rem;
            text-decoration: none;
            color: inherit;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .role-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-md);
        }
        .role-card svg {
            color: var(--secondary);
            margin-bottom: 1rem;
        }
        .role-card h2 {
            margin: 0 0 0.5rem;
            font-size: 1.2rem;
            color: var(--secondary);
        }
        .role-card p {
            margin: 0;
            font-size: 0.9rem;
            color: #64748b;
        }
        @media (max-width: 600px) {
            .role-wrapper h1 { font-size: 1.5rem; }
        }
    </style>
</head>
<body>

    <div class="role-wrapper">
        <div class="role-logo">
            <img src="image/logo.svg" alt="TDTU Logo" height="70">
        </div>
        <h1>BẠN LÀ AI?</h1>

        <div class="role-cards">
            <a class="role-card" href="home.php">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <h2>Người dùng</h2>
                <p>Xem bản đồ và tìm đường trong khuôn viên, không cần đăng nhập.</p>
            </a>

            <a class="role-card" href="login.php">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <h2>Quản trị viên</h2>
                <p>Đăng nhập để quản lý dữ liệu địa điểm trên hệ thống.</p>
            </a>
        </div>
    </div>

</body>
</html>
