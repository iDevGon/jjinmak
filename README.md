# 찐막

이번 판이, 오늘의 마지막. 다음 한 판이 끝나면 롤 클라이언트를 종료하는 macOS / Windows 데스크톱 앱입니다.

## 다운로드

[v0.1.0 프리릴리스](https://github.com/iDevGon/jjinmak/releases/tag/v0.1.0)에서 운영체제와 CPU에 맞는 ZIP을 내려받으세요.

| 환경 | 다운로드 |
|---|---|
| Windows 10/11 x64 | [Windows ZIP](https://github.com/iDevGon/jjinmak/releases/download/v0.1.0/jjinmak-0.1.0-windows-x64.zip) |
| Mac Apple Silicon (M 시리즈) | [Mac arm64 ZIP](https://github.com/iDevGon/jjinmak/releases/download/v0.1.0/jjinmak-0.1.0-macos-arm64.zip) |
| Mac Intel | [Mac x64 ZIP](https://github.com/iDevGon/jjinmak/releases/download/v0.1.0/jjinmak-0.1.0-macos-x64.zip) |

[SHA-256 체크섬](https://github.com/iDevGon/jjinmak/releases/download/v0.1.0/SHA256SUMS.txt)

초기 테스트용 릴리스입니다. 실제 롤 연동·앱 강제 종료·PC 종료는 실환경 검증 전이며,
Windows 배포자 서명과 Mac Developer ID 서명·공증은 포함하지 않습니다.

## 모노레포 구조

```text
apps/
  macos/       macOS 앱 진입점, 프로세스 감지·종료·전원 제어
  windows/     Windows 앱 진입점, 프로세스 감지·종료·전원 제어
packages/
  core/        LCU 통신, 게임 추적, 종료 제어·카운트다운
  desktop/     공통 Electron 실행기, preload, HTML/CSS 화면
scripts/       실행·패키징·양쪽 앱 UI 테스트
test/          공통 로직·플랫폼 어댑터 테스트
```

npm workspaces를 사용합니다. 공통 패키지는 `@jjinmak/core`, `@jjinmak/desktop`이며
앱은 각각 `@jjinmak/macos`, `@jjinmak/windows`입니다. 설치는 루트에서 한 번만 합니다.

## 배포 앱 실행

| 대상 | 실행 파일 |
|---|---|
| Windows x64 | `release/windows/찐막-win32-x64/찐막.exe` |
| Mac Apple Silicon | `release/macos/찐막-darwin-arm64/찐막.app` |
| Mac Intel | `release/macos/찐막-darwin-x64/찐막.app` |

Windows에서는 실행 폴더 전체를 복사하세요. Mac에서는 CPU에 맞는 `찐막.app`을 실행하세요.
ZIP을 받았다면 전체 압축을 먼저 풀어야 합니다. exe 파일만 따로 옮기면 실행되지 않습니다.
Windows는 10/11 x64 대상이며 배포자 서명은 없습니다. Mac 빌드는 로컬 개발용 ad-hoc 서명을 사용하며 Apple Developer ID 서명·공증은 하지 않았습니다.
이전 단일 앱 산출물은 `release/` 바로 아래에 남아 있을 수 있습니다. 최신 버전은 위 OS별 폴더를 사용하세요.

1. 필요하면 ‘디스코드도 종료’를 켭니다.
2. PC까지 끄려면 ‘진짜 찐막’을 켜고 안내를 확인합니다.
3. 가운데 큰 ‘찐막’ 버튼을 켭니다.
4. 롤에서 다음 게임을 시작합니다. 같은 게임의 종료를 연속으로 확인하면 자동으로 종료합니다.

활성화한 뒤 옵션을 변경하려면 먼저 찐막을 해제하세요. 앱을 재시작하면 버튼과 옵션은 모두 OFF입니다.
최소화하거나 창을 닫아도 앱과 감시는 계속 실행됩니다. Windows에서는 하단 트레이, Mac에서는 상단 메뉴바의 찐막 아이콘을 클릭하거나 아이콘 메뉴의 `찐막 열기`로 창을 다시 표시할 수 있습니다. 앱을 완전히 종료하려면 아이콘 메뉴의 `앱 종료`를 선택하세요. PC 종료 카운트다운은 앱의 `종료 취소` 버튼으로 취소할 수 있습니다.

### 동작 기준

- **활성화 후 시작하는 다음 한 판**에 적용하며 실행 후 자동 해제됩니다.
- 게임 도중 켜면 그 판은 건너뛰고 다음 판을 기다립니다.
- 연결 전에 켰다면 최초 연결 시 이미 시작한 판은 건너뜁니다. 로비에서 연결됨을 확인한 뒤 시작하는 것이 확실합니다.
- 닷지, 클라이언트 종료, 튕김, 연결 끊김을 게임 종료로 판정하지 않습니다.
- `InProgress`를 실제 관찰한 게임 ID와 종료 상태의 ID가 일치해야 합니다.
- `PreEndOfGame` 또는 `EndOfGame`을 두 번 연속 확인합니다. 폴링 간격은 연결 중 1.5초, 미연결 시 4초입니다.
- 다른 게임이 시작되면 잘못된 종료를 방지하기 위해 자동 해제합니다.
- TFT 및 관전은 제외합니다. 리메이크·사용자 설정·연습 모드가 동일한 게임 상태를 제공하면 한 판으로 처리합니다.
- Windows에서는 현재 세션의 `LeagueClient`, `LeagueClientUx`, `LeagueClientUxRender`만 종료합니다.
- macOS에서는 현재 사용자의 `LeagueClient`, `LeagueClientUx` 및 명시된 Helper 프로세스를 종료합니다.
- Riot Client와 Vanguard는 종료하지 않습니다.
- 디스코드 옵션은 현재 사용자/세션의 Discord 및 PTB·Canary 버전과 해당 Helper를 대상으로 합니다.
- ‘진짜 찐막’은 롤과 선택한 디스코드를 종료한 후 30초 카운트다운을 표시합니다. 취소해도 이미 종료한 앱은 다시 켜지지 않습니다.
- 카운트다운이 시작되면 최소화된 창을 복원하고 ‘종료 취소’ 버튼에 초점을 맞춥니다.
- 30초 후 시스템 종료를 요청합니다. **저장하지 않은 작업은 사라질 수 있습니다.**
- Windows는 `shutdown.exe /s /f /t 0`을 호출합니다. macOS는 고정된 `/sbin/shutdown -h now` 명령을 운영체제의 관리자 승인으로 실행합니다.
- **Mac은 종료 시 관리자 승인 창이 나타날 수 있으며, 승인해야 종료됩니다.** 취소하면 오류 안내만 표시하고 재시도하지 않습니다. 관리자 암호나 권한을 앱에 저장하지 않습니다.
- 앱 종료에 실패하면 PC 종료를 진행하지 않고 오류를 표시합니다. 프로세스 종료 자체에는 권한 상승을 요청하지 않습니다.

## 개발·모의 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm ci
npm start
```

`npm start`는 현재 OS의 앱을 선택해 **실제 롤에 연결**합니다. Linux는 지원하지 않습니다.
명시적으로 선택하려면 `npm run start:mac` 또는 `npm run start:win`을 사용합니다.
실제 앱·PC를 종료하지 않고 테스트하려면:

```sh
npm run demo
```

`npm run demo:mac`, `npm run demo:win`으로 각 앱의 모의 실행을 선택할 수 있습니다.
데모는 `--demo`에서만 켜집니다. 다른 OS용 앱을 실제 모드로 실행하면 시작을 거부합니다.

화면 아래 ‘모의 게임으로 테스트하기’를 열어 **찐막 켜기 → 게임 시작 → 게임 종료** 순서로 눌러보세요.
모의 실행의 종료 문구는 가상 실행 결과이며 실제 프로세스는 종료하지 않습니다.

```sh
npm test             # 게임 상태 판정·종료 제어·외부 연동 경계 테스트
npm run test:ui      # macOS·Windows 두 진입점의 모의 실행 UI 테스트
npm run package:win  # Windows x64
npm run package:mac  # Mac Apple Silicon (arm64)
npm run package:mac:intel  # Mac Intel (x64)
```

Mac 패키징은 macOS에서 실행하세요. 재빌드하면 해당 OS·CPU 실행 폴더의 기존 생성물을 교체합니다.
보관할 버전은 먼저 별도 복사하세요. 패키징은 임시 폴더에 앱과 공통 패키지를 복사하며,
배포 앱은 workspace symlink나 원래 소스 경로 없이 독립 실행됩니다.
Node/Electron 개발 의존성은 배포 앱에 포함되지 않으며 Electron 런타임은 포함됩니다.

## 실환경 검증 — 배포 전 필요

아래 항목은 모의 테스트로 증명할 수 없습니다. 두 OS 모두 실제 롤 연동·강제 종료 검증 전입니다.
개발 Mac에서는 실제 프로세스 탐색이 실행됨을 확인했지만 롤이 설치되어 있지 않아 연결은 검증하지 못했습니다.

- [ ] 최신 롤 클라이언트에서 ‘롤 연결됨’ 표시, 일반전·랭크·칼바람의 gameId와 종료 단계 확인.
- [ ] 정상 종료·항복·리메이크 후 정확히 한 번 종료되는지 확인.
- [ ] 닷지·게임 충돌·재접속·네트워크 단절 중 종료되지 않는지 확인.
- [ ] 게임 중 클라이언트 자동 닫기 설정을 켠 경우 감지 지속 여부 확인.
- [ ] 이미 진행 중인 게임에서 활성화하면 다음 게임부터 적용되는지 확인.
- [ ] Discord가 선택한 경우에만 종료되는지, 서로 다른 권한 실행 시 오류가 표시되는지 확인.
- [ ] 저장할 작업이 없는 테스트 PC에서 PC 종료 취소 및 실제 종료 확인.
- [ ] macOS 관리자 승인 성공·취소·시간 초과와 Apple Silicon/Intel 호환성 확인.
- [ ] 게임이 로컬 API의 종료 단계를 제공하지 않거나 놓쳤을 때 강제 종료하지 않는지 확인.

## 구현과 제약

`packages/core/src`: 한 판 추적·종료 판정·LCU 통신. `apps/*/platform.cjs`: OS별 프로세스 탐색과 종료.
`packages/desktop/src`: 격리된 Electron 화면과 제한된 IPC. 공통 패키지는 OS 어댑터를 직접 참조하지 않습니다.

LCU 인증 토큰은 메모리에만 보관하며 저장·로그 출력하지 않습니다. 자체 서명 TLS 예외는
`127.0.0.1`의 개별 LCU 요청에만 적용합니다. 외부 서버, 로그인, 데이터 전송은 없습니다.

Riot은 LCU를 외부 앱용으로 공식 지원하지 않습니다. 패치로 응답이나 연결 방식이 바뀌면
수정이 필요할 수 있습니다. 본 앱은 Riot의 승인 제품이 아니며 계정 제재 여부를 보장하지 않습니다.
LCU를 이용하는 앱은 Riot 개발자 포털에 사용 내용을 알리라는 공식 안내를 따라야 합니다.

참고: [Riot LCU 안내](https://developer.riotgames.com/docs/lol#league-client-api),
[Electron 보안 지침](https://www.electronjs.org/docs/latest/tutorial/security),
[Windows shutdown](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/shutdown).
