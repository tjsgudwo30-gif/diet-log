# WEIGHT/LOG — Personal Diet Studio

개인용 다이어트 & 체중 기록 웹 앱. 브루탈리즘 / 에디토리얼 스타일의 벤토 그리드 대시보드.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Recharts 3 · Framer Motion · Lucide-react

## 기능

- **헤더** — 연/월 초대형 타이포, 날짜 이동(← →, 오늘로), 연속 기록일(Streak), 설정
- **오늘의 체중** — 숫자 클릭 인라인 수정, ±0.1kg 조정, 전일 대비 증감, 목표까지 남은 수치
- **트렌드 그래프** — 7일 / 30일 / 전체, 커스텀 툴팁(체중 + 식단·주사·메모 요약), 점 클릭 시 해당 날짜로 이동, 7일 이동평균 점선, 주사일 ◆ 마커
- **주간 지표** — 선택 날짜 기준 7일 평균 체중과 이전 7일 대비 Δ 7D AVG
- **데일리 로그** — 아침 / 점심 / 저녁 / 간식 / 운동 메모(인라인 수정), 원클릭 커스텀 태그
- **다이어트 주사** — 약품·용량·부위 기록, 태그가 한 기록으로 합쳐짐, 마지막 투약일 D+N, '지난번과 동일'
- **컨디션 메모** — 하루 한 줄(최대 200자), 컨디션 칩(회식, 붓기, 공복 상쾌…)
- **모바일** — 하단 고정 퀵 입력 바(체중 ± / 7개 탭 / 태그 / 메모), 주사 예정일 배너
- **데이터** — LocalStorage 자동 저장(손상 값 자동 보정·원본 복구 키 보관), JSON 백업·복원, 15일 샘플 데이터, 전체 초기화
- **PWA** — manifest, 앱 아이콘, 오프라인 서비스 워커(프로덕션 빌드에서만 등록)

## 구조

```
src/
  app/            layout(폰트·메타데이터), page, manifest.json, globals.css(디자인 토큰)
  components/
    Dashboard.tsx     페이지 상태(선택 날짜, 설정 모달), 전체 그리드 조립
    Header.tsx        01 헤더
    Hero.tsx          체중 히어로 + 증감/목표 카드
    TrendChart.tsx    Recharts 그래프 + 툴팁
    DailyLog.tsx      5개 카테고리 로그 + 태그
    QuickBar.tsx      모바일 하단 퀵 입력 바
    SettingsModal.tsx 목표 체중, 백업/복원, 샘플/초기화
    ui.tsx            AnimatedNumber, BrutalButton, Cell, Tag
  lib/
    types.ts   AppData 스키마, 카테고리, 기본 태그
    store.ts   useDietStore 훅(LocalStorage), 샘플 생성, 백업 파싱/검증
    date.ts    YYYY-MM-DD 키 유틸
public/
  icons/   SVG 원본 + PNG (npm run icons 로 재생성)
  sw.js    서비스 워커
```

## 디자인 토큰

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| paper | `#F4F4F0` | 배경 |
| ink | `#000000` | 텍스트, 2px 그리드 보더 |
| acid | `#CCFF00` | 포인트(감소, 선택, 오늘) |
| blaze | `#FF4D00` | 포인트(증가, 경고, 운동) |

폰트: Archivo(초대형 숫자, `.display-tight`), JetBrains Mono(메모), Noto Sans KR(한글).

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run icons    # public/icons/*.svg → PNG 재생성
```
