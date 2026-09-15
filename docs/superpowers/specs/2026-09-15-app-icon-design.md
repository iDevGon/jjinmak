# 찐막 앱 아이콘 디자인

## 목적

Electron 기본 아이콘을 찐막 앱의 정체성을 보여주는 아이콘으로 교체한다. Windows 작업표시줄·설치 앱과 macOS Dock·앱 번들에서 같은 인상을 유지하고, 작은 크기에서도 아이콘의 의미가 즉시 읽혀야 한다.

## 확정 방향

- 핵심 모티브: 전원 버튼 심볼
- 스타일: 선명한 플랫 아이콘
- 배경: 둥근 민트색 배지, 바깥 영역은 투명
- 심볼: 중앙의 짙은 흑연색 전원 버튼
- 텍스트: 없음
- 색상: UI 토큰의 민트 `#8BE5BC`, 흑연색 `#121819` / `#283335`
- 금지 요소: 그라디언트, 글로우, 그림자, 질감, 추가 오브젝트, 글자, 워터마크
- 마스터: 1024×1024 PNG, 투명 알파 채널

## 생성 및 산출물

내장 ImageGen으로 마스터 PNG를 생성한다. 출력은 다음 규격으로 파생한다.

- `packages/desktop/src/ui/app-icon.png`: 런타임 창 아이콘용 마스터
- `assets/jjinmak.ico`: Windows 패키징용 아이콘
- `assets/jjinmak.icns`: macOS 패키징용 아이콘

파생 포맷은 동일한 PNG 원본에서 결정적으로 만든다. 플랫폼별로 다른 시각 디자인을 생성하지 않는다.

## 프로젝트 연결

- `packages/desktop/src/main.cjs`의 `BrowserWindow` 설정에 PNG 아이콘 경로를 추가한다.
- `scripts/package.mjs`의 Electron Packager 설정에 플랫폼별 `.ico` 또는 `.icns` 경로를 추가한다.
- Windows/macOS 앱 진입점과 화면 UI는 수정하지 않는다.

## 검증 기준

1. 마스터 PNG가 1024×1024이고 투명 알파를 가진다.
2. 아이콘에 글자나 불필요한 요소가 없고, 16–32px 축소 상태에서도 전원 심볼이 식별된다.
3. 데모 Electron 실행에서 창 아이콘이 기본 Electron 아이콘이 아니다.
4. Windows와 macOS 패키징 설정이 각각 올바른 네이티브 아이콘 파일을 사용한다.
5. 기존 Node 테스트와 Electron smoke UI 테스트가 통과한다.

## 생성 프롬프트

```text
Use case: logo-brand
Asset type: Electron desktop application icon
Primary request: Create a crisp, minimal app icon for “찐막”, a desktop utility that helps end the last game session. Use a single bold power-button symbol as the only subject.
Scene/backdrop: transparent background outside the badge
Subject: a compact rounded mint badge with a centered dark graphite power symbol
Style/medium: clean flat raster icon, vector-like geometry, no text
Composition/framing: centered, symmetrical, generous padding, recognizable at 16–32px
Lighting/mood: flat, calm, decisive
Color palette: mint #8BE5BC and graphite #121819 / #283335
Materials/textures: solid fills only, no texture
Text (verbatim): ""
Constraints: no letters, no Korean text, no logo marks, no gradients, no glow, no shadow, no watermark
Avoid: photorealism, 3D rendering, extra objects, thin lines, busy details
```
