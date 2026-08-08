# Jerboa Circle Legacy URL Audit

검증일: 2026-08-08
대상: production 응답과 현재 canonical data

## 현재 공개 canonical

| 종류 | canonical path | 결과 |
| --- | --- | --- |
| Programme | `/archive/museum-after-hours/` | `200`, canonical 일치 |
| Programme | `/archive/unwritten-folio-mrw7vf2d/` | `200`, canonical 일치 |
| Programme | `/archive/unwritten-folio-ms5r3hvu/` | `200`, canonical 일치 |
| Reference | `/catalogue/the-odyssey/` | `200`, canonical 일치 |
| Reference | `/catalogue/parzival/` | `200`, canonical 일치 |
| Reference | `/catalogue/perceval-ou-le-conte-du-graal/` | `200`, canonical 일치 |

## 이전·제거 경로

| 이전 경로 | 분류 | 처리 | 근거 |
| --- | --- | --- | --- |
| `/archive/scintilla-animae/` | 제거된 bundled 기록 | `404`, `noindex`, canonical 없음 | 서버 tombstone |
| `/archive/reading-edge-room/` | 제거된 bundled 기록 | `404`, `noindex`, canonical 없음 | 서버 tombstone |
| `/archive/letters-unmade-places/` | 제거된 bundled 기록 | `404`, `noindex`, canonical 없음 | 서버 tombstone |
| `/archive/unwritten-folio-ms94yzm2/` | private staging 기록 | generic `404`, `noindex` | 내부 상태 비노출 |

검증된 대체 기록이 없으므로 제거된 세 경로를 임의로 현재 프로그램에 redirect하지 않았다. 제목 유사성만으로 redirect를 만들면 잘못된 역사 관계가 canonical로 굳어진다.

## 알 수 없는 경로

- 없는 Archive detail: `404`, `noindex, nofollow`, canonical 없음.
- 없는 Catalogue detail: `404`, `noindex, nofollow`, canonical 없음.
- 임의의 일반 경로: `404`, `noindex, nofollow`, canonical 없음.
- private, deleted, unknown의 내부 이유는 public 본문에 구분해 노출하지 않는다.

## 링크 검사

- 예상 공개·운영 경로는 모두 `200`이었다.
- 예상 404 경로는 모두 실제 `404`였고 soft 404가 없었다.
- redirect loop와 예기치 않은 redirect는 없었다.
- 공개 Programme 이미지 5개는 모두 GET `200`이었다.
- Wellcome Collection source URL 7개는 `200`이었다.
- Met source URL 7개는 자동 요청에 `429`를 반환했다. 객체 ID가 명시된 공식 경로지만 자동 상태는 미확정으로 남긴다.
- 공개 runtime 자료 3개에는 현재 외부 `sourceUrl`이 없다. Catalogue provenance는 값이 있을 때만 source 링크를 보여준다.

## Redirect 등록 기준

redirect는 다음 세 조건이 모두 확인될 때만 `old -> canonical` 표에 추가한다.

1. 동일 기록임을 운영자가 확인했다.
2. canonical record가 공개 상태다.
3. 날짜·판본·출처가 충돌하지 않는다.

analytics나 외부 검색 데이터가 없어 실제 inbound traffic은 확인하지 못했다. 다음 analytics 도입 시 404 path 빈도만 수집하고 query나 private 식별자는 수집하지 않는다.
