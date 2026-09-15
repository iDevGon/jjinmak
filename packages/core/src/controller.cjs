const { EventEmitter } = require('node:events');
const { SessionGuard } = require('./core.cjs');

class Controller extends EventEmitter {
  constructor({ read, closeGames, shutdown, now = Date.now }) {
    super();
    this.read = read;
    this.closeGames = closeGames;
    this.shutdown = shutdown;
    this.now = now;
    this.guard = new SessionGuard();
    this.options = { discord: false, shutdown: false };
    this.snapshot = null;
    this.connected = false;
    this.arming = false;
    this.executing = false;
    this.deadline = null;
    this.generation = 0;
    this.inflight = null;
    this.polling = false;
    this.message = '';
    this.error = '';
  }
  state() {
    return {
      armed: this.guard.armed, gameId: this.guard.gameId,
      excludedId: this.guard.excludedId, options: { ...this.options },
      connected: this.connected, phase: this.snapshot?.phase || null,
      arming: this.arming, executing: this.executing,
      seconds: this.deadline === null ? null : Math.max(0, Math.ceil((this.deadline - this.now()) / 1000)),
      message: this.message, error: this.error,
    };
  }
  publish() { this.emit('change', this.state()); }
  setOptions(options) {
    if (this.guard.armed || this.arming || this.executing || this.deadline !== null) {
      throw new Error('찐막을 해제한 뒤 옵션을 바꿔 주세요.');
    }
    if (typeof options?.discord !== 'boolean' || typeof options?.shutdown !== 'boolean') {
      throw new Error('옵션 형식이 올바르지 않아요.');
    }
    this.options = { discord: options.discord, shutdown: options.shutdown };
    this.publish();
  }
  async refresh() {
    if (!this.inflight) {
      this.inflight = (async () => {
        try {
          this.snapshot = await this.read();
          this.connected = this.snapshot !== null;
        } catch {
          this.snapshot = null;
          this.connected = false;
        }
        return this.snapshot;
      })().finally(() => { this.inflight = null; });
    }
    return this.inflight;
  }
  async arm() {
    if (this.guard.armed || this.arming || this.executing || this.deadline !== null) return;
    const generation = ++this.generation;
    this.arming = true;
    this.message = '';
    this.error = '';
    this.publish();
    const snapshot = await this.refresh();
    if (generation !== this.generation) return;
    this.guard.arm(snapshot, this.options);
    this.arming = false;
    this.publish();
  }
  disarm() {
    ++this.generation;
    this.arming = false;
    this.guard.disarm();
    this.message = '찐막을 해제했어요.';
    this.publish();
  }
  async poll() {
    if (this.polling || this.executing || this.deadline !== null) return;
    this.polling = true;
    const generation = this.generation;
    try {
      const snapshot = await this.refresh();
      if (generation !== this.generation || this.arming) return;
      const action = this.guard.observe(snapshot);
      if (this.guard.reason) this.message = this.guard.reason;
      if (action) await this.perform(action);
    } finally {
      this.polling = false;
      this.publish();
    }
  }
  async perform(options) {
    this.executing = true;
    this.error = '';
    this.message = '게임이 끝났어요. 앱을 종료하고 있어요.';
    this.publish();
    try {
      await this.closeGames(options);
      this.message = options.discord ? '롤과 디스코드를 종료했어요. 오늘은 여기까지.' : '롤을 종료했어요. 오늘은 여기까지.';
      if (options.shutdown) this.deadline = this.now() + 30000;
    } catch {
      this.error = '앱 종료에 실패했어요. 롤·디스코드의 실행 권한을 확인한 뒤 직접 종료해 주세요. PC 종료도 취소했어요.';
      this.message = '';
    } finally {
      this.executing = false;
      this.publish();
    }
  }
  cancelShutdown() {
    if (this.deadline === null) return;
    this.deadline = null;
    this.message = 'PC 종료를 취소했어요. 롤은 이미 종료했어요.';
    this.publish();
  }
  async tick() {
    if (this.deadline === null) return;
    if (this.now() < this.deadline) { this.publish(); return; }
    this.deadline = null;
    this.executing = true;
    this.message = 'PC를 종료하고 있어요.';
    this.publish();
    try { await this.shutdown(); }
    catch { this.error = 'PC 종료에 실패했거나 권한 승인이 취소됐어요. 운영체제의 전원 메뉴에서 직접 종료해 주세요.'; }
    finally { this.executing = false; this.publish(); }
  }
}

module.exports = { Controller };
