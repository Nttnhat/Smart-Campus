// Simple mock interaction for floor buttons
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // update header text
                const floorName = btn.childNodes[0].textContent.trim();
                document.querySelector('.floor-map-header h3').textContent = `Sơ đồ ${floorName} - Tòa A`;
                
                // In real app, load new floor plan here
            });
        });