# Vercel + Neon Postgres 연동 가이드

## 1. Neon을 Vercel 프로젝트에 연결
Vercel Marketplace에서 **Neon**을 설치하고 현재 프로젝트에 데이터베이스를 연결합니다. 한국 사용자가 주 대상이므로 Region은 **Singapore (Southeast Asia)**를 선택합니다. 연결이 완료되면 Vercel이 `DATABASE_URL` 환경변수를 Production·Preview·Development에 자동 등록합니다.

CLI를 쓸 경우에는 `vercel integration add neon --name aeg-hk-db`로도 만들 수 있습니다.

## 2. 테이블 생성
Neon Console의 **SQL Editor**에서 [`neon/schema.sql`](../../neon/schema.sql)을 실행합니다.

현재 프로토타입은 `intranet_app_state` 단일 행에 업무 데이터를 JSON으로 저장합니다. DB 연결 문자열은 Vercel API만 사용하며 브라우저로 전달되지 않습니다.

## 3. 로컬 개발 환경
Vercel 프로젝트를 연결한 뒤 다음 명령으로 로컬 환경변수를 가져옵니다.

```bash
vercel env pull .env.development.local
npm install
vercel dev
```

`npm start`는 정적 화면만 확인할 때 사용합니다. Neon API까지 확인하려면 Vercel Functions를 함께 실행하는 `vercel dev`를 사용합니다.

`DATABASE_URL`은 절대 Git에 커밋하거나 브라우저 코드에 넣지 않습니다. 예시는 [`.env.example`](../../.env.example)에만 제공합니다.

## 4. Google 로그인 및 승인 계정 설정
Vercel 환경변수에 아래 값을 Production·Preview·Development에 등록합니다.

| 이름 | 값 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Cloud의 OAuth 2.0 웹 클라이언트 ID |
| `APP_SESSION_SECRET` | 32자 이상 무작위 서버 비밀값 |
| `INTRANET_ALLOWED_EMAILS` | 승인할 Google 이메일을 쉼표로 구분한 목록 |

Google OAuth에는 Vercel 배포 URL을 Authorized JavaScript origin으로 등록합니다. Client secret은 현재 Google ID 토큰 로그인 방식에서 사용하지 않습니다.

## 5. 배포와 확인
1. 변경사항을 push하고 Vercel에서 배포합니다.
2. Neon SQL Editor에서 스키마를 실행합니다.
3. 배포 사이트에서 프로젝트·공지 등을 하나 추가한 뒤 새로고침해 데이터가 유지되는지 확인합니다.
4. Vercel Functions 로그에서 `/api/app-state` 요청이 성공하는지 확인합니다.

## 6. 동작 방식 및 제한
- 브라우저는 `/api/app-state`만 호출하고, Vercel 서버리스 함수가 `DATABASE_URL`로 Neon에 연결합니다.
- Google ID 토큰은 Vercel 서버에서 검증되고, 승인 이메일 목록을 통과한 사용자에게만 HttpOnly 세션 쿠키가 발급됩니다.
- `vercel.json`은 DB와 같은 Singapore Vercel Functions 리전(`sin1`)에서 `/api/app-state`를 실행하도록 고정합니다.
- Neon 설정이나 테이블이 준비되지 않은 로컬 환경에서는 기존 localStorage로 자동 폴백합니다.
- 현재는 검증용 공유 상태 저장소입니다. 운영 전에는 서버 검증 가능한 인증을 추가하고 사용자·프로젝트·근태·결재 테이블을 분리해야 합니다.
