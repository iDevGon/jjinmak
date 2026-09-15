# 찐막
<!-- impeccable:product-schema 1 -->

## Platform
web

Electron 데스크톱 앱. 실제 운영 대상은 Windows와 macOS이며 npm workspaces로 앱을 분리한다.

## Stack
구현 선택: Electron + 로컬 HTML/CSS/JavaScript. 서버·계정·원격 코드 없음.

## Users
롤에서 다음 한 판을 마지막 판으로 정하고 싶은 사용자.

## Product Purpose
가운데 큰 원형 ‘찐막’ 버튼을 켜면 다음에 시작한 한 판이 끝났을 때 롤 클라이언트를 종료한다.
디스코드 종료 및 PC 종료(‘진짜 찐막’)를 각각 선택할 수 있다.

## Capabilities and Constraints
- 게임 시작 이후 같은 gameId의 종료 상태를 확인한 경우에만 1회 실행한다.
- 게임 중에 활성화하면 현재 판을 건너뛰고 다음 판을 기다린다.
- 닷지·연결 끊김·재접속·클라이언트 충돌은 종료 근거가 아니다.
- 기본은 OFF. 옵션도 앱 재시작 시 OFF. 실행 후 자동 해제.
- PC 종료는 30초 앱 내 카운트다운 후 실행하며 그동안 취소 가능하다.
- macOS 강제 시스템 종료는 운영체제의 관리자 승인이 필요할 수 있다.
- LCU는 공식 지원되지 않는 로컬 API. 두 운영체제의 실게임 검증이 별도로 필요하다.

## Brand Commitments
한글 앱 이름 ‘찐막’. 가운데 크고 동그란 토글 버튼.
사용자가 선택한 어두운 게이밍 스타일.

## Evidence on Hand
사용자가 제공한 다섯 가지 요구사항과 진행 승인. 게임 실환경 검증 결과는 아직 없음.
