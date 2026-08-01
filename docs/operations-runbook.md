# 운영 점검 및 복구 절차

## 매 배포 후 확인

1. Vercel Production 배포가 `Ready`인지 확인합니다.
2. `https://도메인/api/health`가 `{"ok":true,"database":"connected"}`를 반환하는지 확인합니다.
3. 일반 계정과 관리자 계정으로 각각 로그인합니다.
4. 일반 계정의 결재 기안·근태·업무일지 저장, 관리자 계정의 공지·결재 처리를 확인합니다.

## 백업

Neon 콘솔에서 정기 백업 및 복구 가능 기간을 확인합니다. 주요 운영 변경 전에는 Neon SQL Editor에서 필요한 테이블을 CSV 또는 SQL 덤프로 내보냅니다.

## 장애 대응

- 화면에 서버 저장 실패 안내가 보이면 Vercel 환경 변수 `DATABASE_URL`과 Neon 프로젝트 상태를 확인합니다.
- `/api/health`가 503이면 Neon 연결 상태를 먼저 복구합니다.
- 로그인 오류는 Vercel Function Logs에서 `/api/auth-google` 요청을 확인하고, `GOOGLE_CLIENT_ID`, `APP_SESSION_SECRET`, 승인 이메일 변수를 점검합니다.
- 데이터 훼손은 Neon 콘솔의 백업 또는 시점 복구 기능으로 복구합니다.
