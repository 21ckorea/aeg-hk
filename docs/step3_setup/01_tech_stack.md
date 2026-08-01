# 3단계 산출물: 기술 스택 구성안

## 1. 프론트엔드
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui 또는 Radix UI
- React Hook Form
- Zod
- Recharts / ApexCharts

## 2. 백엔드 / 데이터베이스
- Neon Postgres (Vercel Marketplace 연동)
  - PostgreSQL
  - connection pooling
  - database branching (preview)
- Vercel Functions
- 인증 제공자 (Supabase Auth, Clerk 또는 Auth.js 중 선택)
- 파일 스토리지 (Vercel Blob 또는 S3 호환 스토리지)

## 3. 배포 / 운영
- Vercel
- PWA 지원
- Sentry
- Google Analytics / Mixpanel

## 4. 앱 확장
- PWA 우선 구현
- Capacitor로 모바일 앱 확장 가능
- Electron 또는 Tauri로 데스크톱 앱 확장 가능

## 5. 개발 원칙
- 웹 앱을 먼저 구현한다.
- 공통 컴포넌트와 디자인 시스템을 먼저 만든다.
- 권한 구조는 서버/DB 레벨까지 일관되게 반영한다.
