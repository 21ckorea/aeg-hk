# 3단계 산출물: 프로젝트 구조안

## 1. 최상위 구조
```text
src/
  app/
    (auth)/
    (dashboard)/
    admin/
    api/
  components/
    layout/
    ui/
    features/
  lib/
    neon/
    auth/
    utils/
  hooks/
  types/
  styles/
  public/
```

## 2. 주요 폴더 역할
- app: 라우팅 및 페이지 구성
- components: 공통 UI 및 기능별 컴포넌트
- lib: Neon DB, 인증, 공통 유틸리티
- hooks: 커스텀 훅
- types: 타입 정의
- public: 이미지, 아이콘, PWA 리소스

## 3. 초기 개발 우선순위
1. 인증 관련 페이지 및 훅
2. 공통 레이아웃
3. 대시보드 페이지
4. 타임시트 페이지
5. 근태/결재/게시판 페이지
6. 관리자 페이지
