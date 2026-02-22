export function initResize() {
  const handle  = document.getElementById('resize-handle');
  const sidebar = document.getElementById('sidebar');
  let dragging  = false;
  let startX    = 0;
  let startW    = 0;

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    handle.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW  = Math.min(500, Math.max(160, startW + delta));
    sidebar.style.width = newW + 'px';
  });

  handle.addEventListener('pointerup', () => {
    dragging = false;
    handle.classList.remove('dragging');
    localStorage.setItem('lapis-sidebar-width', sidebar.offsetWidth);
  });

  // Restore saved width
  const saved = localStorage.getItem('lapis-sidebar-width');
  if (saved) sidebar.style.width = saved + 'px';
}