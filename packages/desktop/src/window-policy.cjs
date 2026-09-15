function interceptWindowClose({ event, window, quitting }) {
  if (quitting) return false;
  event.preventDefault();
  window.hide();
  return true;
}

module.exports = { interceptWindowClose };
