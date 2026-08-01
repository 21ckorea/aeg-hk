# 관리자 계정 설정

관리자 권한은 브라우저의 역할 선택 기능이 아니라 서버와 Neon DB에서 판정합니다.

1. Vercel 환경 변수에 관리자 Google 이메일을 `INTRANET_ADMIN_EMAILS`로 등록합니다.
2. 해당 계정으로 회원가입을 완료한 뒤 로그아웃·재로그인합니다.

예시는 다음과 같습니다.

```text
INTRANET_ADMIN_EMAILS=admin@example.com
```

환경 변수를 사용할 수 없는 경우에는 `neon/migrations/003_admin_setup.sql`의 이메일을 변경해 Neon SQL Editor에서 실행합니다. 이후 다시 로그인하면 됩니다.

누구나 Google 계정으로 회원가입을 신청할 수 있으며, 신규 계정은 `승인 대기` 상태로 저장됩니다. 관리자는 인트라넷의 `관리자 설정` 메뉴에서 계정을 `승인됨`으로 바꿔 접근을 허용합니다. 비활성 계정은 다음 로그인부터 차단됩니다.
