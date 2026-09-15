function getStartupEnabled({ demo, getLoginItemSettings }) {
  if (demo) return false;
  return Boolean(getLoginItemSettings()?.openAtLogin);
}

function setStartupEnabled({ demo, enabled, launchOptions = {}, setLoginItemSettings, getLoginItemSettings }) {
  if (typeof enabled !== 'boolean') throw new TypeError('시작 설정은 boolean이어야 해요.');
  if (demo) return enabled;
  setLoginItemSettings({ ...launchOptions, openAtLogin: enabled, openAsHidden: false });
  return getStartupEnabled({ demo: false, getLoginItemSettings });
}

module.exports = { getStartupEnabled, setStartupEnabled };
