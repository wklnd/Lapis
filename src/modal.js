export function showModal({ title, desc = '', placeholder = '', confirmText = 'Confirm', defaultValue = '', options = null, inputLabel = '', selectLabel = '' }) {
  return new Promise(resolve => {
    const overlay     = document.getElementById('modal-overlay');
    const input       = document.getElementById('modal-input');
    const select      = document.getElementById('modal-select');
    const fieldName   = document.getElementById('modal-field-name');
    const fieldSelect = document.getElementById('modal-field-select');

    document.getElementById('modal-title').textContent = title;
    const descEl = document.getElementById('modal-desc');
    descEl.style.display = desc ? '' : 'none';
    if (desc) descEl.textContent = desc;

    const both = placeholder && options;

    // Input field
    if (placeholder) {
      document.getElementById('modal-input-label').textContent = inputLabel;
      document.getElementById('modal-input-label').style.display = inputLabel ? '' : 'none';
      input.placeholder = placeholder;
      input.value       = defaultValue;
      fieldName.style.display = '';
    } else {
      fieldName.style.display = 'none';
    }

    // Select field
    if (options) {
      document.getElementById('modal-select-label').textContent = selectLabel;
      document.getElementById('modal-select-label').style.display = selectLabel ? '' : 'none';
      select.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      fieldSelect.style.display = '';
    } else {
      fieldSelect.style.display = 'none';
    }

    document.getElementById('modal-confirm').textContent = confirmText;
    overlay.classList.add('open');
    setTimeout(() => (placeholder ? input : select).focus(), 50);

    const cleanup = val => {
      overlay.classList.remove('open');
      document.getElementById('modal-confirm').replaceWith(document.getElementById('modal-confirm').cloneNode(true));
      document.getElementById('modal-cancel').replaceWith(document.getElementById('modal-cancel').cloneNode(true));
      resolve(val);
    };

    document.getElementById('modal-confirm').onclick = () => {
      if (both)         cleanup({ name: input.value.trim(), template: select.value });
      else if (options) cleanup(select.value);
      else if (placeholder) cleanup(input.value.trim());
      else              cleanup(true);
    };
    document.getElementById('modal-cancel').onclick = () => cleanup(null);
    input.onkeydown = e => {
      if (e.key === 'Enter')  document.getElementById('modal-confirm').click();
      if (e.key === 'Escape') cleanup(null);
    };
  });
}