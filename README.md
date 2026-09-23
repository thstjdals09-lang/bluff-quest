# BLUFF QUEST — First Playable Prototype

포커의 블러프·상대 읽기·위험과 보상을 판타지 세계의 심리전 어드벤처로 재해석한 싱글플레이 게임의 첫 번째 Vertical Slice입니다. (BLUFF QUEST는 임시 작업명)

기획 기준 문서: `BLUFF_QUEST_GDD_v0.2.md` (저장소 루트)

## 실행 방법

```bash
npm install
npm run dev        # http://localhost:5199
```

- 타입체크: `npm run typecheck`
- 테스트: `npm test`
- 프로덕션 빌드: `npm run build` → `dist/`

## 조작

- 이동: 방향키 / WASD / 화면 D패드 (모바일)
- 상호작용: E, Space, Enter 또는 하단 상호작용 버튼 (대상에 인접했을 때)

## 개발자 툴

- 개발 서버(`npm run dev`)에서는 화면 우하단 **DEV** 버튼이 자동 노출됩니다.
- 프로덕션 빌드에서는 URL 뒤에 `?dev`를 붙여야 노출됩니다. (예: `https://.../index.html?dev`)
- 탭: A 상태 조회 / B 상태 제어 / C 대결 디버그(시나리오 강제 시작·내부 정보) / D 세이브(강제 저장·초기화·JSON 내보내기/가져오기) / E 이벤트·오류 로그

## 구조

```
src/
  game/            # 게임 로직 (UI와 분리, 순수 함수 위주)
    types.ts       # 상태·액션·콘텐츠 타입
    state.ts       # 순수 리듀서 (모든 상태 변경의 단일 통로)
    encounter.ts   # 대결 엔진 (결정론적 상태 기계, NPC 공용)
    save.ts        # localStorage 저장/복원/검증/백업
    rng.ts         # 시드 기반 PRNG
    log.ts         # 개발자 로그
    content/       # 콘텐츠 데이터 (코드 로직과 분리)
      scenarios.ts # 고블린 상자 대결 시나리오 4종
      world.ts     # 지역 맵·아이템·퀘스트 정의
      dialogues.ts # NPC·조사 대상 상호작용 트리
    __tests__/     # vitest 단위 테스트
  ui/              # React 컴포넌트 (렌더링만 담당)
```

## 세이브

- localStorage `bluff_quest_save`에 버전 필드를 포함해 자동 저장 (상태 변경 시·화면 이탈 시).
- 손상된 세이브는 백업 키로 옮긴 뒤 새 게임으로 안전하게 시작합니다.
- 진행 중인 대결(시나리오·공개된 단서)도 저장되어 재접속 시 그대로 이어집니다.
