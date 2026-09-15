# OS 시작 자동 실행 옵션 설계

## 목표

사용자가 `컴퓨터를 켜면 찐막 시작` 옵션을 켜면 Windows 또는 macOS 로그인 시 찐막이 자동 실행되고 창을 표시하도록 한다. 기본값은 꺼짐이며, 옵션을 끄면 OS 로그인 항목도 해제한다.

## 범위

- 기존 게임 종료 옵션과 분리된 `앱 설정` 영역에 자동 실행 스위치를 추가한다.
- Electron의 OS 로그인 항목 API를 사용해 Windows/macOS 시작 등록을 관리한다.
- 앱 시작 시 OS 설정을 읽어 스위치 상태를 복원한다.
- 자동 실행과 일반 실행 모두 기존 창 표시 흐름을 사용한다.
- 데모 모드에서는 실제 OS 설정을 변경하지 않고 메모리 상태만 변경한다.
- 기존 트레이, 게임 감시, PC 종료 동작은 유지한다.

## 사용자 동작

앱 설정 영역은 다음 문구를 사용한다.

- 제목: `컴퓨터를 켜면 찐막 시작`
- 설명: `로그인할 때 찐막을 열고 창을 보여줘요`

스위치는 기존 게임 진행 상태와 독립적으로 조작할 수 있다. 단, 동일한 renderer 요청이 처리 중일 때만 잠시 비활성화한다. 설정 변경에 실패하면 현재 OS 설정을 다시 읽어 이전 상태를 표시하고 기존 요청 오류 안내를 사용한다.

## 데이터 흐름

1. 앱 준비 후 `app.getLoginItemSettings().openAtLogin`을 읽어 `startupEnabled` 상태를 초기화한다.
2. `get-state` 응답에 `startupEnabled`를 포함한다.
3. preload가 노출하는 `setStartup(enabled)`가 `set-startup` IPC를 호출한다.
4. 메인 프로세스는 요청을 검증하고, 실제 실행에서는 `app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: false })`를 호출한다.
5. 설정 변경 후 OS 설정을 다시 읽어 `startupEnabled`를 반환한다.
6. 데모 모드에서는 OS API를 호출하지 않고 전달된 boolean을 메모리 상태로 반환한다.

`openAsHidden: false`로 설정해 OS 로그인 자동 실행 시에도 기존 `ready-to-show` 창이 표시되게 한다. 트레이 생성과 감시 폴링은 일반 실행과 같은 경로로 실행한다.

## 구현 경계

- `packages/desktop/src/startup.cjs`: OS 로그인 설정의 읽기·쓰기 정책. Electron 함수는 인자로 주입해 단위 테스트한다.
- `packages/desktop/src/main.cjs`: `startupEnabled` 상태, 앱 준비 시 초기화, `set-startup` IPC, 기존 `state()` 응답 연결.
- `packages/desktop/src/preload.cjs`: `setStartup` 브리지 메서드.
- `packages/desktop/src/ui/index.html`: 앱 설정 스위치와 설명.
- `packages/desktop/src/ui/renderer.js`: 상태 렌더링, 스위치 요청, 실패 시 이전 상태 복원.

Windows/macOS 진입점과 OS별 롤 프로세스 어댑터는 수정하지 않는다. 개발 실행과 패키지 실행에서 Electron이 현재 앱을 다시 시작할 수 있도록 로그인 항목 경로/인자를 현재 실행 방식에 맞게 사용하되, 데모 모드에서는 등록하지 않는다.

## 오류 처리

- boolean이 아닌 IPC 입력은 기존 IPC 검증 방식으로 거부한다.
- OS 로그인 설정 API가 실패하면 IPC 요청을 거부하고 renderer의 기존 요청 오류 표시를 사용한다.
- 실패한 요청은 `startupEnabled`를 변경하지 않으며, renderer는 다음 state 렌더링에서 원래 상태로 돌아간다.
- 지원하지 않는 실제 OS에서의 실행은 기존 플랫폼 가드가 계속 처리한다.

## 검증 계획

- 단위 테스트: 실제 모드의 읽기·쓰기 호출, `openAsHidden: false`, 데모 모드의 OS API 미호출, boolean 검증 경계를 확인한다.
- 기존 회귀 테스트: 게임 컨트롤러, LCU, OS 어댑터, 창 닫기 정책 테스트를 유지한다.
- UI 스모크 테스트: macOS·Windows 데모에서 초기 OFF 상태, ON 전환, 상태 반영, OFF 복귀를 확인한다. 데모 실행은 실제 로그인 항목을 변경하지 않는다.
- 문서 검증: README에 자동 실행 옵션과 로그인 시 창 표시 동작을 설명한다.
