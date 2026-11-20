<?php
// Menu người dùng ở góc phải header, dùng chung cho mọi trang công khai.
// Yêu cầu: config/auth.php đã được require ở đầu trang.
// - Khách: nút "Đăng nhập" (không bắt buộc, mọi tính năng bản đồ vẫn dùng được).
// - Sinh viên: tên + link Hồ sơ + Đăng xuất.
// - Admin: thêm lối tắt về trang quản trị.
$__userName = current_user_name();
$__isAdmin = (bool) current_admin_id();
$__token = urlencode(csrf_token());
$__initials = $__userName
    ? mb_strtoupper(implode('', array_map(fn ($w) => mb_substr($w, 0, 1), array_slice(preg_split('/\s+/u', trim($__userName)), -2))))
    : 'SV';
?>
<div class="user-menu">
    <?php if ($__isAdmin): ?>
        <a href="admin.php" class="user-menu-link" title="Về trang quản trị"><div class="avatar admin-avatar">AD</div></a>
    <?php endif; ?>
    <?php if ($__userName): ?>
        <a href="profile.php" class="user-menu-link" title="Hồ sơ của tôi">
            <span class="user-menu-name"><?php echo htmlspecialchars($__userName); ?></span>
            <div class="avatar"><?php echo htmlspecialchars($__initials); ?></div>
        </a>
        <a href="api/logout.php?role=user&amp;t=<?php echo $__token; ?>" class="user-menu-logout">Đăng xuất</a>
    <?php elseif (!$__isAdmin): ?>
        <span class="user-menu-guest" title="Bạn đang dùng với tư cách khách">Khách</span>
        <a href="login.php" class="user-menu-login">Đăng nhập</a>
    <?php endif; ?>
</div>
