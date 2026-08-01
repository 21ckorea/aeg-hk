# 2단계 산출물: DB 스키마 초안

## 1. users
- id
- email
- name
- department_id
- role_id
- status
- created_at
- updated_at

## 2. departments
- id
- name
- parent_id
- created_at

## 3. roles
- id
- name
- level
- created_at

## 4. projects
- id
- name
- manager_id
- status
- start_date
- end_date
- created_at

## 5. timesheet_entries
- id
- user_id
- project_id
- work_date
- hours
- memo
- status
- created_at

## 6. attendance_records
- id
- user_id
- check_in_at
- check_out_at
- status
- created_at

## 7. approvals
- id
- user_id
- type
- title
- content
- status
- approver_id
- created_at

## 8. posts
- id
- user_id
- category
- title
- content
- is_notice
- created_at

## 9. comments
- id
- post_id
- user_id
- content
- created_at

## 10. files
- id
- owner_type
- owner_id
- file_path
- created_at

## 11. relationships
- users.department_id → departments.id
- users.role_id → roles.id
- projects.manager_id → users.id
- timesheet_entries.user_id → users.id
- timesheet_entries.project_id → projects.id
- attendance_records.user_id → users.id
- approvals.user_id → users.id
- approvals.approver_id → users.id
- posts.user_id → users.id
- comments.post_id → posts.id
- comments.user_id → users.id
