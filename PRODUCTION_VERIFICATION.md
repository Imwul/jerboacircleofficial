# Jerboa Circle Phase 2 Production Verification

검증일: 2026-08-08 (KST)
대상: `https://jerboacircleofficial.vercel.app`
전용 기록: `[STAGING] Jerboa Publication Lifecycle` (`unwritten-folio-msk5ysav`)

## 최종 상태

- 전용 기록은 `archived / private`로 남겼다.
- 공개 Archive, 상세 주소, `archive.json`, `sitemap.xml`, `feed.xml`에는 노출되지 않는다.
- 상세 주소는 `404`와 `noindex, nofollow`를 반환하며 canonical과 `og:url`을 내보내지 않는다.
- 실제 운영 콘텐츠는 수정하지 않았다.
- 검증을 위해 잠시 사용한 별도 입장 환경 변수는 테스트 직후 삭제했다.

## 공개 수명주기

| 단계 | 예상 | 실제 | 공개 HTTP/API | 재현 |
| --- | --- | --- | --- | --- |
| 새 기록 생성 | 비공개 초안 | `draft / private` | 상세 `404` | 예 |
| 자동 임시 저장 | 이 기기에 보존 | 자동 저장 시각 표시 | 공개 변화 없음 | 예 |
| 새로고침 복원 | 제목·본문·위치 복원 | 같은 기록과 입력 복원 | 공개 변화 없음 | 예 |
| 공동 장부 저장 | 서버 보존, 비공개 유지 | 저장 완료와 서버 시각 표시 | 목록 없음, 상세 `404` | 예 |
| 첫 발행 | 공개본과 발행 지문 생성 | `df549cc4` 생성 | 목록·상세·사이트맵·피드 반영 | 예 |
| 3분 예약 시작 | 경계 전 숨김 | 18:46 KST 전 숨김 | 목록 없음, 상세 `404/noindex` | 예 |
| 예약 시작 경계 | 재배포 없이 공개 | 18:46 KST 이후 공개 | 네 공개 표면 모두 반영 | 예 |
| 수정 후 재게시 | 새 발행본과 본문 갱신 | `f155d85f` 생성 | API와 HTML 설명 갱신 | 예 |
| 3분 예약 종료 | 경계 전 공개 유지 | 18:51 KST 전 `200` | 네 공개 표면 유지 | 예 |
| 예약 종료 경계 | 재배포 없이 제거 | 18:51 KST 이후 제거 | 상세 `404/noindex` | 예 |
| 다시 게시 | 공개 복구 | `7b7ecff8` 생성 | 목록과 상세 `200` | 예 |
| 게시 취소 | 공개 제거, 이력 보존 | `archived / private` | 목록 없음, 상세 `404` | 예 |

예약 공개와 종료는 빌드 결과가 아니라 요청 시각의 서버 판정으로 바뀌었다. Archive, 상세, API, 사이트맵, 피드가 같은 판정을 사용했다.

## 충돌과 복구

- 같은 기록을 두 탭에서 열고 A를 먼저 저장한 뒤 B를 저장했다.
- B에는 서버판/내 임시 저장 선택, 차이 비교, 로컬 복구 파일 받기가 나타났다.
- 서버판을 선택해 병합했으며 자동 덮어쓰기는 발생하지 않았다.
- 운영 기록에 `conflict-resolved`, `sync`, `publish`, `unpublish`가 순서대로 남았다.
- 발행 이력 3개와 초안 revision 이력이 모두 유지됐다.
- 자동 백업 8개가 운영 화면에서 열람·복원 가능한 상태였다.

## 이미지 업로드

| 입력 | 결과 | 저장 형식/정책 |
| --- | --- | --- |
| JPG | 성공 | 최적화 후 공동 저장소 URL |
| 한글 파일명 PNG | 성공 | 안전한 pathname으로 정규화 |
| WebP | 성공 | WebP URL 유지 |
| 5000x5000 PNG | 성공 | 클라이언트 축소 후 업로드 |
| 700x3600 JPG | 성공 | 세로 비율 유지 |
| 4200x600 특수문자 PNG | 성공 | 안전한 파일명으로 정규화 |
| 같은 이름·같은 바이트 | 성공 | 같은 digest URL 재사용 |
| alt 공백 | 성공 | 프로그램 제목 기반 alt 자동 입력 |
| source/caption 없음 | 성공 | 프로그램 포스터 발행을 막지 않음 |

- 같은 파일을 두 번 올렸을 때 Blob URL이 같아 중복 객체가 생기지 않았다.
- 교체되거나 충돌에서 버린 미공유 파일은 삭제되었다. cache-busting GET으로 `404`를 확인했다.
- 현재 최종 포스터만 기록에 연결되어 있다.
- 이미 조회한 immutable URL은 edge cache TTL 동안 과거 응답을 줄 수 있다. 삭제 검증은 새 query로 수행해야 한다.
- 업로드 중 실제 회선 차단은 simulation-only다. 업로드 후 저장 충돌과 취소 정리는 production에서 검증했다.

## 공개 경로와 메타데이터

- Home, Archive, Catalogue, 공개 상세, Members, Cabinet, Folio, Keeper, Godmode의 예상 경로는 모두 `200`이었다.
- 제거·비공개·알 수 없는 Archive, Catalogue, 일반 경로는 모두 실제 `404`였다.
- 공개 상세에는 title, description, canonical, `index, follow`, Open Graph, Twitter/X, 대표 이미지가 있었다.
- 비공개/없는 상세에는 `noindex, nofollow`가 있었고 canonical 및 `og:url`은 없었다.
- 공개 이미지 5개를 GET으로 검사해 모두 `200`과 올바른 image content type을 확인했다.
- Wellcome 원문 7개는 `200`이었다. Met 7개는 자동 검사에 `429`를 반환해 링크 파손으로 판정하지 않고 수동 확인 대상으로 남겼다.

## 모바일과 접근성

다음 10개 viewport와 8개 핵심 경로, 총 80개 조합을 browser emulation으로 확인했다.

`360x640`, `375x812`, `390x844`, `430x932`, `768x1024`, `1024x768`, `1366x768`, `1440x900`, `1920x1080`, `2560x1080`

- 문서 루트 overflow와 비스크롤 영역의 잘린 컨트롤은 발견되지 않았다.
- 닫힌 `details`의 작업 버튼은 접근성 트리에 남지 않았다.
- modal focus trap, label, aria-live, reduced motion, safe area와 visual viewport 대응 코드를 확인했다.
- Cabinet 검색 → 상세 → 뒤로가기에서 query, page, scroll을 보존했다.
- Cabinet → Folio → 뒤로가기에서도 Cabinet 문맥을 보존했다.
- iOS Safari/Android Chrome 실기기, 실제 모바일 키보드, 실제 파일 선택기는 simulation-only다.

## 성능과 자동 점검

- Members, Keeper, Catalogue는 route-level lazy loading이다. 공개 첫 묶음에 Keeper/Godmode 화면 코드는 포함되지 않는다.
- production `dist`는 약 9.8 MB이고 asset budget 집계는 8.79 MB다. 초기 JS는 약 240 KB, 가장 큰 초기 글꼴은 약 1.75 MB다.
- 운영 이미지 중 큰 PNG가 약 2.16 MB와 1.57 MB로 남아 있어 다음 이미지 이전 때 WebP 변환을 권장한다.
- `npm run check`: 단위 테스트 26개, lint, production build, 29 static routes, public contract, performance budget 통과.
- 자동화: 공개 판정 matrix, schedule boundary, 404 metadata, public snapshot 최소화, Cabinet 권한/관계, 이미지 공개 계약.
- production 수동 검증: autosave, 새로고침 복원, server save, publish/unpublish, 두 탭 충돌, scroll restore, 이미지 업로드/정리.

## 확인하지 못한 항목

- 실제 iOS/Android 기기와 저속·불안정 셀룰러 회선
- 운영 브라우저를 물리적으로 offline으로 전환한 end-to-end 재연
- Met의 자동 링크 검사 제한(`429`) 이후의 사람 눈 수동 점검
- 외부 inbound link와 검색 유입은 analytics 데이터가 없어 판별하지 못함
