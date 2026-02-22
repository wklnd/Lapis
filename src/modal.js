export function showModal({ title, desc = '', placeholder = '', confirmText = 'Confirm', defaultValue = '' }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const input   = document.getElementById('modal-input');
    document.getElementById('modal-title').textContent = title;
    const descEl = document.getElementById('modal-desc');
    descEl.style.display = desc ? '' : 'none';
    if (desc) descEl.textContent = desc;
    if (placeholder) {
      input.placeholder = placeholder;
      input.value = defaultValue;
      input.style.display = '';
      setTimeout(() => { input.focus(); input.select(); }, 50);
    } else {
      input.style.display = 'none';
    }
    document.getElementById('modal-confirm').textContent = confirmText;
    overlay.classList.add('open');

    const cleanup = val => {
      overlay.classList.remove('open');
      document.getElementById('modal-confirm').replaceWith(document.getElementById('modal-confirm').cloneNode(true));
      document.getElementById('modal-cancel').replaceWith(document.getElementById('modal-cancel').cloneNode(true));
      resolve(val);
    };
    document.getElementById('modal-confirm').onclick = () =>
      cleanup(input.style.display !== 'none' ? input.value.trim() : true);
    document.getElementById('modal-cancel').onclick = () => cleanup(null);
    input.onkeydown = e => {
      if (e.key === 'Enter') document.getElementById('modal-confirm').click();
      if (e.key === 'Escape') cleanup(null);
    };
  });
}