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

  const readMins = words > 0 ? Math.max(1, Math.round(words / (parseInt(localStorage.getItem('lapis-wpm') || '200')))) : 0;
  const readTime = readMins > 0 ? `${readMins} min read` : '';

  left.textContent  = name;
  right.innerHTML   = filePath
    ? `<span>${words} words</span><span>${chars} chars</span>${readTime ? `<span>${readTime}</span>` : ''}`
    : '';
}

export function countAndUpdate(filePath, content) {
  const text  = content || '';
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;
  updateStatus(filePath, words, chars);
}