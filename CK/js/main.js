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

    logo.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default link behavior
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
  const currentPath = window.location.pathname.split('/').pop() || 'home.html';
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
