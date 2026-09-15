const ACTIVE = new Set(['GameStart', 'InProgress', 'Reconnect']);
const ENDED = new Set(['PreEndOfGame', 'EndOfGame']);

class SessionGuard {
  constructor() { this.disarm(); }

  disarm() {
    this.armed = false;
    this.gameId = null;
    this.excludedId = null;
    this.initialized = false;
    this.waitForLobby = false;
    this.confirmations = 0;
    this.options = { discord: false, shutdown: false };
    this.reason = '';
  }

  arm(snapshot, options) {
    this.disarm();
    this.armed = true;
    this.options = { discord: options.discord === true, shutdown: options.shutdown === true };
    this.baseline(snapshot);
  }

  baseline(snapshot) {
    if (!snapshot) return;
    this.initialized = true;
    if (ACTIVE.has(snapshot.phase) || ENDED.has(snapshot.phase)) {
      this.excludedId = snapshot.gameId;
      this.waitForLobby = !snapshot.gameId;
    }
  }

  observe(snapshot) {
    if (!this.armed) return null;
    if (!snapshot || !snapshot.supported) {
      this.confirmations = 0;
      return null;
    }
    if (!this.initialized) {
      this.baseline(snapshot);
      return null;
    }
    if (this.waitForLobby) {
      if (['None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'].includes(snapshot.phase)) {
        this.waitForLobby = false;
      }
      return null;
    }
    if (snapshot.phase === 'InProgress' && snapshot.gameId && snapshot.gameId !== this.excludedId) {
      if (this.gameId && this.gameId !== snapshot.gameId) {
        this.disarm();
        this.reason = '다른 게임이 감지되어 찐막을 해제했어요. 다시 켜 주세요.';
        return null;
      }
      this.gameId = snapshot.gameId;
    }
    if (!this.gameId || snapshot.gameId !== this.gameId || !ENDED.has(snapshot.phase)) {
      this.confirmations = 0;
      return null;
    }
    if (++this.confirmations < 2) return null;
    const action = { ...this.options };
    this.disarm();
    return action;
  }
}

module.exports = { SessionGuard };
