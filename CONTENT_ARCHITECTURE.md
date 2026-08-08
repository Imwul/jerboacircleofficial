# Jerboa Circle Content Architecture

## 원칙

Jerboa Circle의 공개 기록, 원전 자료, 참여자 기록을 한 목록으로 합치지 않는다. 같은 세계 안에서 서로 연결하되 각 장부의 질문과 공개 범위를 분리한다.

## 공개 영역

| 영역 | 답하는 질문 | 기본 단위 | 공개 범위 |
| --- | --- | --- | --- |
| Archive | 어떤 프로그램이 있었고 무엇을 읽었는가 | Programme | 공개 발행본만 |
| Collection | 어떤 편집 맥락으로 프로그램을 묶는가 | Programme 묶음 | public collection만 |
| Catalogue | 프로그램을 만든 책·작품·인용·도판·장소는 무엇인가 | Reference | 공개 자료만 |
| Archive detail | 한 프로그램의 설명·여정·도판·자료 관계는 무엇인가 | Programme folio | 공개 발행본만 |
| Catalogue detail | 원전의 서지·권리·인용·사용 프로그램은 무엇인가 | Source folio | 공개 자료만 |

Archive는 사건과 프로그램의 기록철이다. Catalogue는 그 기록을 만든 원전과 도판의 도록이다. 프로그램의 `referenceIds`가 둘을 잇고 Catalogue의 “사용된 프로그램”이 역방향을 보여준다. source가 없는 프로그램도 발행할 수 있지만 권장 확인으로 표시한다.

## Archive 탐색

- 공개 filter: 검색, 현재/예정/보존 상태, season, public collection, type, subject, sort, bookmark.
- 내부 `workflowStatus`와 private 상태는 공개 filter에 노출하지 않는다.
- query는 URL에 저장해 새로고침·공유·뒤로가기를 견딘다.
- 알 수 없는 filter 값은 안전하게 All로 수렴하고, zero result에는 한 문장과 “필터 지우기”를 제공한다.
- 상세 진입 전 scroll 위치를 history에 남기고 돌아왔을 때 복원한다.
- 항목 계층은 제목 → collection/edition → summary → date/type → relation metadata 순서다.

## Catalogue 탐색

- Reference 종류는 book, artwork, quotation, image, place, theme와 운영자가 추가한 종류다.
- 검색과 kind만 공개한다. 프로그램 운영 상태는 자료 도록의 filter가 아니다.
- 상세에서 creator, date, edition, locator, language, rights, citation, source URL을 provenance로 묶는다.
- parent/child 자료와 실제 사용 프로그램만 직접 관계로 표시한다.
- Archive와 기능이 겹쳐 보여도 합치지 않는다. Programme와 Source는 수명주기와 책임이 다르다.

## 참여자 영역

| 방 | 역할 | 다음 이동의 이유 |
| --- | --- | --- |
| Reader | 참여자 입장과 현재 읽기 맥락 | 일정과 기록을 열기 위한 문턱 |
| Itinerary | 신청, 일정, 출석, 다음 프로그램 | 읽을 것과 다음 행동을 확인 |
| Folio | 개인 기록과 신청 이력 | 내가 남긴 것을 검토 |
| Cabinet | 수집한 사물·책·이미지·메모 | 개인 기록을 자료 관계로 확장 |
| Keeper Desk | 1인 운영자의 참여자 관리 | 권한이 있을 때만 노출 |

Reader는 현재 별도 데이터 도구가 아니라 입장과 읽기 문맥의 이름이다. 기능이 없는 별도 탭을 추가하지 않고 Itinerary, Folio, Cabinet의 실제 흐름을 우선한다.

## Cabinet 데이터 계약

Curiosity는 다음 필드를 안정적으로 가진다.

`title`, `type`, `source`, `acquired`, `date`, `place`, `contributor`, `tags`, `relatedEntryIds`, `image`, `note`

- 관계는 `relatedEntryIds`의 direct relation만 사용한다.
- 같은 태그라는 이유만으로 관계를 자동 생성하지 않는다.
- self-reference, duplicate, missing ID는 제거한다.
- 다른 참여자의 private 항목은 관계 후보와 상세에서 제외한다.
- 다른 참여자의 public 항목은 직접 선택했을 때만 연결한다.
- 원형 관계는 허용하되 한 단계만 따라가므로 무한 탐색하지 않는다.

## 상태와 주소

- Members 방: `?room=cabinet`, `?room=folio`, 관리자에게만 `?room=keeper`.
- Cabinet: scope, shelf, query, theme, medium, century, region, sort, page, curiosity ID를 URL/history에 보존한다.
- Archive: q, status, season, collection, kind, theme, sort, view와 복귀 scroll을 URL/history에 보존한다.
- private record ID와 제목은 public API, 404 본문, 관계 응답에 노출하지 않는다.
