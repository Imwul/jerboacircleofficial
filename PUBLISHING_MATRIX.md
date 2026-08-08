# Jerboa Circle Publishing Matrix

모든 공개 표면은 `shared/publicationState.mjs`의 동일 판정을 사용한다. 현재 시각은 매 요청에서 평가하며 빌드 시각에 고정하지 않는다.

## 상태 조합

| visibility | workflowStatus | 시간/override | Archive | detail | API | sitemap/feed | robots |
| --- | --- | --- | --- | --- | --- | --- | --- |
| public | published | schedule 없음 | 노출 | `200` | 노출 | 노출 | `index, follow` |
| public | draft | 없음 | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| public | preview | 없음 | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| private | published | 없음 | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| private | draft/archived | 없음 | 숨김 | `404` | custom ID 제외 | 제외 | `noindex, nofollow` |
| unlisted | published | 없음 | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| public | published | `publishAt > now` | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| public | published | `publishAt <= now` | 노출 | `200` | 노출 | 노출 | `index, follow` |
| public | published | `unpublishAt <= now` | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| public | published | invalid schedule | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| public | published | start >= end | 숨김 | `404` | 제외 | 제외 | `noindex, nofollow` |
| any | any | bundled tombstone | 숨김 | `404` | suppression marker만 내부 사용 | 제외 | `noindex, nofollow` |
| public | published | valid server override | override 노출 | `200` | 공개 필드만 | 노출 | `index, follow` |
| private/archived | any | bundled override | bundled base도 숨김 | `404` | tombstone | 제외 | `noindex, nofollow` |

## Public snapshot 규칙

- 공개 record는 whitelist field만 포함한다.
- `publishAt`, `unpublishAt`, private memo, 내부 audit, draft metadata는 public snapshot에 포함하지 않는다.
- private custom ID는 tombstone조차 내보내지 않아 존재를 감춘다.
- bundled ID만 최소 tombstone으로 base record를 억제한다.
- Reference와 Collection도 삭제 marker와 private custom record를 공개 응답에서 제외한다.

## Production 예약 경계 검증

| 시각(KST) | 설정 | 실제 결과 |
| --- | --- | --- |
| 18:42 | `publishAt=18:46` 저장 | 네 공개 표면에서 숨김, detail `404` |
| 18:46 이후 | 재배포 없음 | Archive/API/detail/sitemap/feed 동시 노출 |
| 18:48 | `unpublishAt=18:51` 저장 | 공개 유지, detail `200` |
| 18:51 이후 | 재배포 없음 | 네 공개 표면에서 제거, detail `404` |

## 발행 작업 의미

- 임시 저장: 이 기기의 작업본만 갱신한다.
- 변경사항 저장: 공동 장부를 갱신한다. 공개 중인 기록이면 공개 데이터도 즉시 갱신된다.
- 게시/변경사항 게시: 검증 후 공개 상태로 만들고 immutable publication manifest를 추가한다.
- 게시 취소: `private / archived`로 전환하고 발행 이력은 보존한다.
- source 연결은 권장 사항이며 없어도 발행할 수 있다.
