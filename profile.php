<?php
require_once __DIR__ . '/config/auth.php';
// Hồ sơ chỉ dành cho sinh viên đã đăng nhập. Khách vẫn dùng bản đồ, nên chỉ chuyển sang đăng nhập.
if (!current_user_id()) {
    header('Location: login.php?next=profile.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php echo csrf_meta(); ?>
    <title>TDTU | Hồ sơ cá nhân</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>">
    <link rel="stylesheet" href="css/profile.css?v=<?php echo @filemtime(__DIR__.'/css/profile.css') ?: time(); ?>">
</head>
<body>
    <header class="app-header">
        <a href="home.php" class="logo">
            <img src="image/logo.svg" alt="TDTU Logo" height="24" style="margin-right: 8px;">
            <span class="logo-text">BẢN ĐỒ KHUÔN VIÊN TDTU</span>
        </a>
        <nav class="nav-links">
            <a href="home.php">Trang chủ</a>
            <a href="campus-map.php">Bản đồ</a>
            <a href="navigation.php">Tìm đường</a>
        </nav>
        <?php include __DIR__ . '/includes/user-menu.php'; ?>
    </header>

    <main class="profile-layout">
        <section class="profile-card" aria-labelledby="profileName">
            <div class="profile-avatar" id="profileInitials" aria-hidden="true">SV</div>
            <div>
                <h1 id="profileName">Đang tải…</h1>
                <p class="profile-meta">MSSV: <strong id="profileCode">—</strong></p>
                <p class="profile-meta">Tham gia: <span id="profileCreated">—</span></p>
            </div>
        </section>

        <section class="profile-panel" aria-labelledby="favTitle">
            <h2 id="favTitle">Địa điểm yêu thích</h2>
            <p class="panel-hint">Bấm ☆ trên trang Bản đồ để thêm địa điểm.</p>
            <ul class="profile-list" id="favoritesList"><li class="empty">Đang tải…</li></ul>
        </section>

        <section class="profile-panel" aria-labelledby="shareTitle">
            <h2 id="shareTitle">Chia sẻ vị trí</h2>
            <p class="panel-hint">Mời bạn bè bằng MSSV để cùng xem vị trí nhau trên bản đồ. Cả 2 phải đồng ý, tự hết hạn sau 4 giờ, dừng được bất kỳ lúc nào.</p>
            <form id="shareInviteForm" class="profile-form" novalidate>
                <label>MSSV bạn muốn mời<input type="text" id="shareInviteCode" required maxlength="20"></label>
                <p class="form-status" id="shareInviteStatus" role="status"></p>
                <button type="submit" class="btn btn-secondary">Gửi lời mời</button>
            </form>
            <ul class="profile-list" id="shareList"><li class="empty">Đang tải…</li></ul>
        </section>

        <section class="profile-panel" aria-labelledby="historyTitle">
            <h2 id="historyTitle">Lộ trình gần đây</h2>
            <ul class="profile-list" id="routesList"><li class="empty">Đang tải…</li></ul>
            <h2>Tìm kiếm gần đây</h2>
            <ul class="profile-list" id="searchesList"><li class="empty">Đang tải…</li></ul>
        </section>

        <section class="profile-panel" aria-labelledby="editTitle">
            <h2 id="editTitle">Cập nhật thông tin</h2>
            <form id="profileForm" class="profile-form" novalidate>
                <label>Họ và tên<input type="text" id="editFullName" required maxlength="150" autocomplete="name"></label>
                <label>Email<input type="email" id="editEmail" maxlength="150" autocomplete="email" placeholder="Không bắt buộc"></label>
                <fieldset>
                    <legend>Đổi mật khẩu (bỏ trống nếu không đổi)</legend>
                    <label>Mật khẩu hiện tại<input type="password" id="currentPassword" autocomplete="current-password"></label>
                    <label>Mật khẩu mới<input type="password" id="newPassword" minlength="8" autocomplete="new-password"></label>
                </fieldset>
                <p class="form-status" id="profileStatus" role="status"></p>
                <button type="submit" class="btn btn-secondary">Lưu thay đổi</button>
            </form>
        </section>
    </main>

    <script src="js/api.js?v=<?php echo @filemtime(__DIR__.'/js/api.js') ?: time(); ?>"></script>
    <script src="js/main.js?v=<?php echo @filemtime(__DIR__.'/js/main.js') ?: time(); ?>"></script>
    <script src="js/profile.js?v=<?php echo @filemtime(__DIR__.'/js/profile.js') ?: time(); ?>"></script>
</body>
</html>
