'use strict';
const api = window.jjinmak;
const $ = (id) => document.getElementById(id);
let current;
let busy = false;
let requestError = '';
const dialog = $('shutdown-dialog');

function text(id, value) { if ($(id).textContent !== value) $(id).textContent = value; }
function render(state) {
  const hadCountdown = current?.seconds !== null && current?.seconds !== undefined;
  current = state;
  const pending = state.seconds !== null;
  const locked = state.armed || state.arming || state.executing || pending || busy;
  document.body.classList.toggle('armed', state.armed);
  document.body.classList.toggle('shutdown-mode', state.options.shutdown);
  $('main-toggle').setAttribute('aria-pressed', String(state.armed));
  $('main-toggle').disabled = state.executing || pending || (busy && !state.arming);
  text('button-caption', pending ? 'PC 종료 대기 중' : state.executing ? '마무리하는 중' : state.arming ? '연결 확인 중 · 취소' : state.armed ? '켜짐 · 눌러서 해제' : '눌러서 켜기');
  $('discord').checked = state.options.discord;
  $('shutdown').checked = state.options.shutdown;
  $('discord').disabled = locked;
  $('shutdown').disabled = locked;
  $('platform-shutdown-note').hidden = state.platform !== 'darwin';
  $('connection').classList.toggle('connected', state.connected);
  text('connection-text', state.demo ? '모의 실행' : state.connected ? '롤 연결됨' : '롤 연결 대기');
  $('demo-banner').hidden = !state.demo;
  $('demo-controls').hidden = !state.demo;
  $('countdown').hidden = !pending;
  if (pending) text('seconds', String(state.seconds));
  text('options-hint', pending ? 'PC 종료를 취소하면 옵션을 바꿀 수 있어요.' : locked ? '옵션을 바꾸려면 먼저 찐막을 해제해 주세요.' : '옵션을 고른 뒤 찐막을 켜 주세요.');
  $('error').hidden = !(state.error || requestError);
  text('error', state.error || requestError);

  let title = '마지막 한 판, 정했나요?';
  let detail = '켜 두면 다음에 시작하는 한 판이 끝날 때 롤을 종료해요.';
  if (state.message) { title = state.demo ? '모의 실행 결과' : '오늘은 여기까지'; detail = state.message; }
  if (state.error) { title = '종료를 완료하지 못했어요'; detail = '아래 안내를 확인해 주세요.'; }
  if (state.arming) { title = '현재 게임 상태를 확인하고 있어요'; detail = '이미 시작한 판은 건너뛰어요.'; }
  if (state.armed) {
    title = state.gameId ? '이 판이 진짜 마지막이에요' : '다음 한 판을 기다리고 있어요';
    detail = state.gameId ? (state.options.shutdown ? '게임이 끝나면 롤을 닫고, 30초 뒤 PC도 종료해요.' : '게임이 끝나면 롤을 자동으로 종료해요.') :
      state.excludedId ? '이미 진행 중인 판은 건너뛰고, 다음 판부터 적용해요.' : '게임이 시작되면 찐막이 지켜볼게요.';
    if (!state.connected) { title = '롤 연결을 기다리고 있어요'; detail = '연결이 끊겨도 종료하지 않아요. 롤을 실행해 주세요.'; }
  }
  if (state.executing) {
    title = '오늘의 게임을 마무리하고 있어요';
    detail = state.platform === 'darwin' && state.message === 'PC를 종료하고 있어요.' ? '관리자 승인 창을 확인해 주세요. 승인하면 Mac이 종료돼요.' : state.message;
  }
  if (pending) { title = state.demo ? '모의 PC 종료를 예약했어요' : 'PC 종료를 예약했어요'; detail = '마음이 바뀌었다면 아래에서 취소할 수 있어요.'; }
  text('status-title', title);
  text('status-detail', detail);
  if (pending && !hadCountdown) {
    $('cancel-shutdown').focus();
    $('countdown').scrollIntoView({ block: 'nearest' });
  }
}

async function request(operation) {
  busy = true;
  requestError = '';
  if (current) render(current);
  try { render(await operation()); }
  catch {
    requestError = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
  } finally {
    busy = false;
    if (current) render(current);
  }
}

$('main-toggle').addEventListener('click', () => request(() => api.setArmed(!(current.armed || current.arming))));
$('discord').addEventListener('change', () => {
  const discord = $('discord').checked;
  void request(() => api.setOptions({ ...current.options, discord }));
});
$('shutdown').addEventListener('change', () => {
  if ($('shutdown').checked) {
    $('shutdown').checked = false;
    dialog.showModal();
  } else void request(() => api.setOptions({ ...current.options, shutdown: false }));
});
$('decline-shutdown').addEventListener('click', () => dialog.close());
$('confirm-shutdown').addEventListener('click', () => {
  dialog.close();
  void request(() => api.setOptions({ ...current.options, shutdown: true }));
});
$('cancel-shutdown').addEventListener('click', () => request(() => api.cancelShutdown()));
for (const button of document.querySelectorAll('[data-demo]')) {
  button.addEventListener('click', () => request(() => api.demoEvent(button.dataset.demo)));
}
api.onState(render);
void request(() => api.getState());
