# [FABLE→TT] W0b 완료 보고 — 고블린 시장 내부 이동 셸 (2026-09-25)

검증 수준: CLAUDE-VERIFIED(티티 독립 QA 아님). GM-04~GM-11은 **임시 장면(단색 STORY_STUB)**이다. 최종 맵이나 그림이 완성된 것이 아니다. 설계와 확정 사항은 [GM_MARKET_SHELL_PLAN.md](../plans/GM_MARKET_SHELL_PLAN.md) §7.

## 1. 상태
```yaml
status: SHIPPED — live, 전체 회귀 통과
commit: bacbe52a5ca1486e37b4023a84b886ac3d4e3e0b (origin/main)
gh_pages: 36771db (앱) → 0584bb8 (/qa/w0b 스크린샷만 추가, 번들 동일)
live_bundle: index-BdGf1E04.js
save_schema: v6 그대로 (장소 ID 8개 추가만)
new_art_assets: 0
vitest: 17 files 전부 통과
live_e2e: 362/362, 페이지 오류 0, 누른 선택지 전부 화면 안
```

## 2. 확정 사항 반영
| 티티 결정 | 구현 |
|---|---|
| ① GM-03 북/서/동을 출구로. 치운 게 아니라 실제 좁은 틈 | 서 `gm03_west_pile`(0,2), 동 `gm03_east_barricade`(8,2)는 장애물 칸 자체가 '…옆 틈' 출구. 북쪽 **수레(4,0)는 조사 대상 그대로** 두고, 왼쪽 빈 칸 `gm03_north_gap`(2,0)을 '수레 옆 틈' 출구로 둠. 수레 문구: "짐꾼들은 '오늘은 못 치워!'라며 손을 내젓는다. 수레 왼쪽, 등불 기둥 옆으로 사람 하나 지나갈 좁은 틈이 있다." **그리즐의 부탁 짐꾼 대화의 선택지·효과·보상은 코드 변경 없음**(대화가 이동을 일으키지 않는다는 기존 테스트 유지) |
| ② GM-11은 GM-04와만 | `gm11_west` ↔ `gm04_east`. GM-02 출구 추가 없음 |
| ③ GM-04↔GM-08만, GM-08↔GM-10 뒷계단 없음 | 상점가 ↔ 클럽 뒷길 순환. 승부장은 GM-09 공개 입구로만 |
| ④ GM-06 문은 처음부터 보이고 누구나 출입, 중립 표기 | 뒷골목 '반쯤 열린 창고 문' → 장소 '허름한 잡화 창고'. 빈 계산대·먼지 앉은 선반만 있고 거래·비밀·플래그 없음. 나중의 조건부 상호작용 자리: `gm06_counter`, `gm06_shelf` |

## 3. 연결 그래프 (실제 id · 도착 칸, 모두 문↔문 왕복)
```
central_market ─(gm03_north_gap 2,0 → 3,5)─ gm07_street ─(gm07_south 3,6 → 2,1)
central_market ─(gm03_west_pile 0,2 → 5,3)─ gm05_alley ─(gm05_east 6,3 → 0,4)
central_market ─(gm03_east_barricade 8,2 → 1,3)─ gm04_shops ─(gm04_west 0,3 → 8,4)
gm07_street ─(gm07_north 3,0 → 3,4)─ gm09_gate ─(gm09_south 3,5 → 3,1)
gm09_gate ─(gm09_arena_gate 6,2 → 1,2)─ gm10_arena ─(gm10_exit 0,2 → 5,2)
gm07_street ─(gm07_club_door 6,3 → 1,3)─ gm08_club ─(gm08_west 0,3 → 5,3)
gm04_shops ─(gm04_club_back 3,0 → 3,4)─ gm08_club ─(gm08_south 3,5 → 3,1)
gm04_shops ─(gm04_east 6,3 → 1,2)─ gm11_rest ─(gm11_west 0,2 → 5,3)
gm05_alley ─(gm05_back_door 1,0 → 3,3)─ gm06_storeroom ─(gm06_exit 3,4 → 1,1)
(기존) market ↔ central_market · market ↔ market_road ↔ port … (W0) 그대로
```
지역 지도(지도 → 지역 지도)에 시장 장소 12곳이 모두 노드로 표시된다. 가 본 곳과 그 이웃만 보인다.

## 4. 공용 접근 vs 조건부
| 장소 | 지금 누구나 | 조건부로 남긴 것 |
|---|---|---|
| GM-04 상점가 | 감정사·잡화 진열대 한 줄 | S01 후속·S02·S04 |
| GM-05 뒷골목 | 빈 상자, 창고 문 | S05·S09 |
| GM-06 허름한 잡화 창고 | 빈 계산대·선반 | 비밀 거래 내용 전부 |
| GM-07 승부사 거리 | 포스터·작은 승부판·구경꾼 | S03·S06 |
| GM-08 포커 클럽 | 딜러("예약 손님만")·빈 테이블 | S07 실제 게임 |
| GM-09 왕의 관문 | 접수원("오늘 명단은 닫혔어")·관객 | 도전 접수 |
| GM-10 왕고블린 승부장 | 빈 무대·관객석 | 보스전 (규칙 미확정) |
| GM-11 휴게소 | 손님·긴 의자 | S08 |

모든 대사는 효과·기록·플래그가 없다(테스트로 확인). 왕고블린의 정체나 THE UNSEEN HAND 단서는 들어 있지 않다.

## 5. 검증
```yaml
vitest:
  world.test (W0b): 중앙 장터 → GM-07 → 09 → 10 → 08 → 04 → 11 → 05 → 06 → 중앙 장터 도보(USE_EXIT)
    - 새로 생기는 플래그는 기존 GM-03 규칙(travel_count·S01·벽보)뿐
    - 승부장 후문 없음, 휴게소는 상점가로만, GM-02 출구 없음, GM-06 이름에 '숨겨진·거래' 없음
  navigation.test: 틈 출구 3곳의 목적지, 수레는 poi(조사만·이동 없음·'못 치워'+'좁은 틈' 문구), 인접 빈 칸, 지역 지도 노드
  favor.test: 그리즐의 부탁 수레·짐꾼 대화 전부 그대로 통과
live_e2e (390x844 / 844x390 / 667x375):
  w0b 14/14:
    - GM-02 → GM-03 → 수레 옆 틈 → GM-07 → GM-09 → GM-10(빈 무대 한 줄) → 되돌아 GM-08 → 뒷길 GM-04 → GM-11
    - → 되돌아 → 바리케이드 틈 GM-03 → 짐 더미 틈 GM-05 → GM-06(빈 계산대 한 줄) → 되돌아 GM-03 → GM-02
    - 이야기 상태 없음, 새로고침 후 위치·방문 유지
  regressions: w0 21, p9(EP1) 31, p8 34, p7 14, p6 23, p5 19, p4 38, p3c 32, p3(그리즐의 부탁) 56, p3b 26, p4-confirm 5, p0(S01) 49
  total: 362/362
```
**직접 확인 (치트 없음):** 입구 장터 오른쪽 위 '기둥 옆 골목' → 중앙 장터 → 위쪽 수레 왼쪽 틈 → 승부사 거리 → 위 '왕의 관문' → 오른쪽 '승부장 문'. 중앙 장터 왼쪽 짐 더미 틈 → 뒷골목 → 위 '반쯤 열린 창고 문'. 중앙 장터 오른쪽 바리케이드 틈 → 상점가 → 오른쪽 '시장 휴게소', 위 '클럽 뒷길'.

## 6. 스크린샷
![세로](https://thstjdals09-lang.github.io/bluff-quest/qa/w0b/w0b-portrait.png)
![가로](https://thstjdals09-lang.github.io/bluff-quest/qa/w0b/w0b-landscape.png)

## 7. 잔여
- GM-04~11의 사건(S02~S10), 왕고블린 인물·보스전, 클럽 게임은 비어 있다(기획 OPEN 또는 이후 패키지).
- 지역 지도는 12개 노드라 좁은 화면에서 이름표가 촘촘하다(기능 문제는 없음).
- 다음: 티티 지시대로 EP2 카지노 스토리. 셸 장소(casino_entry·casino_replay·casino_archive)에 K0~K4를 채운다.
