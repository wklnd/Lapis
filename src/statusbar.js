let _currentFile = null;

export function initStatusBar() {
  updateStatus('', 0, 0);
}

export function updateStatus(filePath, words, chars) {
  _currentFile = filePath;
  const left  = document.getElementById('status-left');
  const right = document.getElementById('status-right');
  if (!left || !right) return;

  const name = filePath
    ? filePath.replace(/\\/g, '/').split('/').pop()
    : '';
    
  left.textContent  = name;
  right.innerHTML   = filePath
    ? `<span>${words} words</span><span>${chars} chars</span>`
    : '';
}

export function countAndUpdate(filePath, content) {
  const text  = content || '';
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;
  updateStatus(filePath, words, chars);
}