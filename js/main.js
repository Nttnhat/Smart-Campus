document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  console.log('App initialized');

  // Sidebar toggle logic
  const logo = document.querySelector('.logo');
  const navLinksContainer = document.querySelector('.nav-links');
  
  if (logo && navLinksContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // Chỉ chặn điều hướng + mở menu kéo ra khi ở màn hình hẹp (khớp @media (max-width:768px)
    // trong css/style.css, nơi .nav-links mới là menu dạng drawer). Ở desktop, .nav-links đã hiện
    // sẵn nằm ngang trong header nên logo bấm vào phải điều hướng về home.php như một link bình
    // thường - trước đây preventDefault() luôn luôn chạy khiến logo không bấm đi đâu được cả.
    logo.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return; // để link tự điều hướng
      e.preventDefault();
      navLinksContainer.classList.toggle('active');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      navLinksContainer.classList.remove('active');
      overlay.classList.remove('active');
    });
  }

  // Handle dummy map marker clicks
  const markers = document.querySelectorAll('.dummy-marker');
  markers.forEach(marker => {
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      const locationName = e.target.getAttribute('title') || 'Location';
      alert(`Clicked on ${locationName}`);
    });
  });

  // Handle active link state
  const currentPath = window.location.pathname.split('/').pop() || 'home.php';
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
