-- ============================================================
-- 테스트용 더미 데이터 (쉽게 삭제 가능)
-- 삭제 방법: 아래 CLEANUP 섹션의 주석을 해제하고 실행하세요.
-- ============================================================

-- ── CLEANUP (삭제 시 이 블록 실행) ───────────────────────────
-- DELETE FROM notifications  WHERE ref_id LIKE 'DUMMY-%';
-- DELETE FROM usage_logs     WHERE record_id LIKE 'DUMMY-%';
-- DELETE FROM as_requests    WHERE record_id LIKE 'DUMMY-%';
-- DELETE FROM transit        WHERE record_id LIKE 'DUMMY-%';
-- DELETE FROM equipment      WHERE record_id LIKE 'DUMMY-%';
-- DELETE FROM app_users      WHERE email LIKE '%@dummy-test.com';
-- ─────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════
-- 1. 사용자 (app_users)
--    ※ id는 실제 auth.users에 없는 더미 UUID 사용
--    ※ 테스트 로그인은 관리자(admin / aj1234) 계정 사용
-- ══════════════════════════════════════════════════════════════
INSERT INTO app_users (id, google_id, email, name, phone, role, site_id, status, created_at, approved_at)
VALUES
  -- AJ 관리자
  ('00000000-0000-0000-0000-000000000001',
   'dummy_google_aj01', 'aj01@dummy-test.com', '김관리자', '010-1111-0001',
   'aj', 'ALL', 'active', now() - interval '30 days', now() - interval '30 days'),

  -- 협력사 담당자
  ('00000000-0000-0000-0000-000000000002',
   'dummy_google_partner01', 'partner01@dummy-test.com', '이협력사', '010-2222-0001',
   'partner', 'P4', 'active', now() - interval '20 days', now() - interval '19 days'),

  ('00000000-0000-0000-0000-000000000003',
   'dummy_google_partner02', 'partner02@dummy-test.com', '박파트너', '010-2222-0002',
   'partner', 'P5', 'active', now() - interval '15 days', now() - interval '14 days'),

  -- 기술인
  ('00000000-0000-0000-0000-000000000004',
   'dummy_google_tech01', 'tech01@dummy-test.com', '최기술인', '010-3333-0001',
   'tech', 'P4', 'active', now() - interval '10 days', now() - interval '10 days'),

  -- AS 기사
  ('00000000-0000-0000-0000-000000000005',
   'dummy_google_as01', 'as01@dummy-test.com', '정AS기사', '010-4444-0001',
   'as_tech', 'ALL', 'active', now() - interval '25 days', now() - interval '24 days'),

  -- 승인 대기 중 (pending 상태 테스트용)
  ('00000000-0000-0000-0000-000000000006',
   'dummy_google_pending01', 'pending01@dummy-test.com', '한대기자', '010-5555-0001',
   'partner', 'P4', 'pending', now() - interval '2 days', NULL)

ON CONFLICT (email) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 2. 장비 (equipment)
-- ══════════════════════════════════════════════════════════════
INSERT INTO equipment (equip_no, spec, model, site_id, site_name, company, status, record_id, in_date, created_at)
VALUES
  ('P4-8M-A001',  '8M',      'Genie GS-2632',   'P4', 'P4 복합동', '한국건설(주)',    'in_use',  'DUMMY-EQ-001', '2026-05-10', now() - interval '34 days'),
  ('P4-8M-A002',  '8M',      'Genie GS-2632',   'P4', 'P4 복합동', '한국건설(주)',    'in_use',  'DUMMY-EQ-002', '2026-05-10', now() - interval '34 days'),
  ('P4-10M-B001', '10M',     'JLG 3246ES',      'P4', 'P4 복합동', '대우건설(주)',    'in_use',  'DUMMY-EQ-003', '2026-05-15', now() - interval '29 days'),
  ('P4-10M-B002', '10M',     'JLG 3246ES',      'P4', 'P4 복합동', '대우건설(주)',    'stock',   'DUMMY-EQ-004', '2026-05-15', now() - interval '29 days'),
  ('P4-12M-C001', '12M',     'Haulotte H12SX',  'P4', 'P4 복합동', '현대건설(주)',    'in_use',  'DUMMY-EQ-005', '2026-05-20', now() - interval '24 days'),
  ('P4-16M-D001', '16M',     'Genie S-60X',     'P4', 'P4 복합동', '삼성물산(주)',    'in_use',  'DUMMY-EQ-006', '2026-05-22', now() - interval '22 days'),
  ('P4-16R-D002', '16M굴절', 'JLG 600AJ',       'P4', 'P4 복합동', '삼성물산(주)',    'stock',   'DUMMY-EQ-007', '2026-05-22', now() - interval '22 days'),
  ('P5-8M-A001',  '8M',      'Genie GS-2632',   'P5', 'P5 복합동', 'GS건설(주)',      'in_use',  'DUMMY-EQ-008', '2026-05-12', now() - interval '32 days'),
  ('P5-8M-A002',  '8M',      'Genie GS-2632',   'P5', 'P5 복합동', 'GS건설(주)',      'in_use',  'DUMMY-EQ-009', '2026-05-12', now() - interval '32 days'),
  ('P5-12M-B001', '12M',     'Haulotte H12SX',  'P5', 'P5 복합동', '롯데건설(주)',    'in_use',  'DUMMY-EQ-010', '2026-05-18', now() - interval '26 days'),
  ('P5-14M-C001', '14M',     'Genie S-45X',     'P5', 'P5 복합동', '포스코건설(주)', 'stock',   'DUMMY-EQ-011', '2026-05-25', now() - interval '19 days'),
  ('P5-20R-E001', '20M굴절', 'JLG 800AJ',       'P5', 'P5 복합동', 'DL이앤씨(주)',   'in_use',  'DUMMY-EQ-012', '2026-06-01', now() - interval '12 days')

ON CONFLICT (record_id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 3. 반입/반출 신청 (transit)
-- ══════════════════════════════════════════════════════════════
INSERT INTO transit (
  record_id, type, site_id, site_name, company,
  equip_specs, aj_equip,
  reporter_name, reporter_phone,
  manager_name, manager_phone, manager_location,
  requested_date, scheduled_date, vehicle_info, driver_info,
  status, note, change_log, created_at
)
VALUES
  -- 반입 완료
  ('DUMMY-TR-001', 'in', 'P4', 'P4 복합동', '한국건설(주)',
   '[{"spec":"8M","qty":2},{"spec":"10M","qty":1}]', 'P4-8M-A001, P4-8M-A002, P4-10M-B001',
   '이협력사', '010-2222-0001', '김양중', '010-9999-0001', '정문 앞 야적장',
   '2026-05-10', '2026-05-10', '5톤 트럭 12가3456', '홍길동 010-7777-0001',
   'completed', NULL, '[]', now() - interval '34 days'),

  -- 반입 일정 확정
  ('DUMMY-TR-002', 'in', 'P4', 'P4 복합동', '현대건설(주)',
   '[{"spec":"12M","qty":1},{"spec":"16M","qty":1}]', NULL,
   '박파트너', '010-2222-0002', '이양중', '010-9999-0002', '2번 게이트',
   '2026-06-15', '2026-06-16', '8톤 트럭 34나7890', '김기사 010-8888-0002',
   'scheduled', '크레인 필요', '[]', now() - interval '5 days'),

  -- 반입 신청 접수 (신규)
  ('DUMMY-TR-003', 'in', 'P5', 'P5 복합동', 'GS건설(주)',
   '[{"spec":"8M","qty":3}]', NULL,
   '이협력사', '010-2222-0001', '최양중', '010-9999-0003', 'P5 정문',
   '2026-06-18', NULL, NULL, NULL,
   'requested', NULL, '[]', now() - interval '1 day'),

  -- 반출 신청
  ('DUMMY-TR-004', 'out', 'P4', 'P4 복합동', '대우건설(주)',
   '[{"spec":"10M","qty":2}]', 'P4-10M-B001, P4-10M-B002',
   '이협력사', '010-2222-0001', '박양중', '010-9999-0004', '후문',
   '2026-06-20', NULL, NULL, NULL,
   'requested', '작업 완료로 반출', '[]', now() - interval '3 hours'),

  -- 취소된 건
  ('DUMMY-TR-005', 'in', 'P5', 'P5 복합동', '포스코건설(주)',
   '[{"spec":"20M굴절","qty":1}]', NULL,
   '박파트너', '010-2222-0002', '강양중', '010-9999-0005', 'P5 2번 출입문',
   '2026-06-10', NULL, NULL, NULL,
   'cancelled', '현장 일정 변경', '[]', now() - interval '10 days')

ON CONFLICT (record_id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 4. AS 요청 (as_requests)
-- ══════════════════════════════════════════════════════════════
INSERT INTO as_requests (
  record_id, site_id, site_name, equip_no, company,
  location, fault_type, description,
  reporter_name, reporter_phone, user_name, user_phone,
  status, tech_name, tech_phone, resolve_note,
  requested_at, resolved_at, elapsed_min
)
VALUES
  -- 처리 완료
  ('DUMMY-AS-001', 'P4', 'P4 복합동', 'P4-8M-A001', '한국건설(주)',
   '5층 A구역', '충전불량', '배터리 충전이 안 됨. 계속 빨간불 뜸.',
   '최기술인', '010-3333-0001', '최기술인', '010-3333-0001',
   'completed', '정AS기사', '010-4444-0001', '배터리 단자 부식. 청소 후 정상화.',
   now() - interval '15 days', now() - interval '14 days', 95),

  -- 처리 중
  ('DUMMY-AS-002', 'P4', 'P4 복합동', 'P4-12M-C001', '현대건설(주)',
   '8층 B구역', '작동불량', '올리고 내리는 버튼이 가끔 안 먹힘.',
   '최기술인', '010-3333-0001', '최기술인', '010-3333-0001',
   'in_progress', '정AS기사', '010-4444-0001', NULL,
   now() - interval '2 days', NULL, NULL),

  -- 자재 수급 중
  ('DUMMY-AS-003', 'P5', 'P5 복합동', 'P5-8M-A001', 'GS건설(주)',
   '3층 C구역', '파손', '발판 모서리 파손. 안전 위험.',
   '박파트너', '010-2222-0002', '오현장', '010-6666-0001',
   'material_pending', '정AS기사', '010-4444-0001', '발판 부품 주문 중 (3~4일 소요)',
   now() - interval '5 days', NULL, NULL),

  -- 신규 요청 (접수)
  ('DUMMY-AS-004', 'P4', 'P4 복합동', 'P4-16M-D001', '삼성물산(주)',
   '11층 D구역', '오류코드', '에러코드 E-07 뜨면서 멈춤.',
   '최기술인', '010-3333-0001', '윤작업', '010-7777-0002',
   'requested', NULL, NULL, NULL,
   now() - interval '3 hours', NULL, NULL),

  -- 신규 요청 (접수)
  ('DUMMY-AS-005', 'P5', 'P5 복합동', 'P5-20R-E001', 'DL이앤씨(주)',
   '15층 E구역', '누유의심', '붐 쪽에서 오일 흘린 흔적 발견.',
   '박파트너', '010-2222-0002', '나작업', '010-7777-0003',
   'requested', NULL, NULL, NULL,
   now() - interval '30 minutes', NULL, NULL)

ON CONFLICT (record_id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 5. 사용 기록 (usage_logs)
-- ══════════════════════════════════════════════════════════════
INSERT INTO usage_logs (
  record_id, equip_no, site_id, company, team_name, floor, location,
  recorder, start_time, end_time, used_hours, status, date, created_at
)
VALUES
  -- 완료 기록들
  ('DUMMY-UL-001', 'P4-8M-A001', 'P4', '한국건설(주)', '1팀', '5층', 'A구역',
   '최기술인', now() - interval '5 days' + interval '8 hours',
   now() - interval '5 days' + interval '17 hours', 9.0, 'done',
   to_char(now() - interval '5 days', 'YYYY-MM-DD'), now() - interval '5 days'),

  ('DUMMY-UL-002', 'P4-10M-B001', 'P4', '대우건설(주)', '2팀', '8층', 'B구역',
   '최기술인', now() - interval '4 days' + interval '8 hours',
   now() - interval '4 days' + interval '16 hours', 8.0, 'done',
   to_char(now() - interval '4 days', 'YYYY-MM-DD'), now() - interval '4 days'),

  ('DUMMY-UL-003', 'P5-8M-A001', 'P5', 'GS건설(주)', '3팀', '3층', 'C구역',
   '박파트너', now() - interval '3 days' + interval '9 hours',
   now() - interval '3 days' + interval '18 hours', 9.0, 'done',
   to_char(now() - interval '3 days', 'YYYY-MM-DD'), now() - interval '3 days'),

  ('DUMMY-UL-004', 'P4-12M-C001', 'P4', '현대건설(주)', '1팀', '10층', 'D구역',
   '최기술인', now() - interval '2 days' + interval '7 hours',
   now() - interval '2 days' + interval '15 hours', 8.0, 'done',
   to_char(now() - interval '2 days', 'YYYY-MM-DD'), now() - interval '2 days'),

  ('DUMMY-UL-005', 'P5-12M-B001', 'P5', '롯데건설(주)', '2팀', '7층', 'A구역',
   '박파트너', now() - interval '1 day' + interval '8 hours',
   now() - interval '1 day' + interval '17 hours', 9.0, 'done',
   to_char(now() - interval '1 day', 'YYYY-MM-DD'), now() - interval '1 day'),

  -- 오늘 가동 중
  ('DUMMY-UL-006', 'P4-8M-A002', 'P4', '한국건설(주)', '1팀', '6층', 'A구역',
   '최기술인', now() - interval '3 hours', NULL, 0, 'using',
   to_char(now(), 'YYYY-MM-DD'), now() - interval '3 hours'),

  ('DUMMY-UL-007', 'P5-8M-A002', 'P5', 'GS건설(주)', '3팀', '4층', 'B구역',
   '박파트너', now() - interval '2 hours', NULL, 0, 'using',
   to_char(now(), 'YYYY-MM-DD'), now() - interval '2 hours')

ON CONFLICT (record_id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 6. 알림 (notifications) — 더미 사용자 UUID 기준
-- ══════════════════════════════════════════════════════════════
INSERT INTO notifications (target_id, type, title, body, ref_id, is_read, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'transit',
   '[반입 신청] GS건설(주)', 'GS건설(주)에서 P5 복합동 반입 신청을 등록했습니다. (8M x3)',
   'DUMMY-TR-003', false, now() - interval '1 day'),

  ('00000000-0000-0000-0000-000000000001', 'as',
   '[AS 신규 요청] P4-16M-D001', 'P4 복합동 11층 오류코드 E-07. 확인 필요.',
   'DUMMY-AS-004', false, now() - interval '3 hours'),

  ('00000000-0000-0000-0000-000000000002', 'transit',
   '[일정 확정] 현대건설(주) 반입', '2026-06-16로 확정. 8톤 트럭 34나7890 김기사.',
   'DUMMY-TR-002', true, now() - interval '4 days'),

  ('00000000-0000-0000-0000-000000000005', 'as',
   '[AS 배정] P4-12M-C001 작동불량', 'P4 복합동 8층 B구역 장비 작동불량 요청이 배정되었습니다.',
   'DUMMY-AS-002', false, now() - interval '2 days');
