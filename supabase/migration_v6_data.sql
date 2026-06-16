-- ============================================================
-- migration_v6_data.sql — 장비 제원표 초기 데이터
-- PDF에서 추출한 작업높이 기준 (가까운 짝수로 반올림)
-- ============================================================

INSERT INTO equipment_specs (model, manufacturer, work_height) VALUES
  -- Genie GS 시저형 (PDF 텍스트 추출)
  ('GS1930',      'Genie', '8M'),    -- 7.8M 추출
  ('GS1930-e',    'Genie', '8M'),    -- 7.8M 추출
  ('GS2632',      'Genie', '10M'),   -- 9.93M 추출
  ('GS2646',      'Genie', '10M'),   -- 9.8M 추출
  ('GS3246',      'Genie', '12M'),   -- 11.75M 추출
  ('GS4046',      'Genie', '14M'),   -- 13.7M 추출
  ('GS4047',      'Genie', '14M'),   -- 13.93M 추출
  ('GS4655',      'Genie', '16M'),   -- 15.95M 추출
  -- Genie GS (이미지 PDF — 제품 스펙 기준)
  ('GS1330m',     'Genie', '6M'),    -- 5.76M
  ('GS2032',      'Genie', '8M'),    -- 8.1M
  ('GS5390RT',    'Genie', '16M'),   -- 16.15M (러프터레인)
  -- Genie ES/ERT
  ('ES1932',      'Genie', '8M'),    -- 7.79M 추출
  ('ERT4069',     'Genie', '14M'),   -- 14.17M (러프터레인)
  -- Genie MS 마스트형 (이미지 PDF — 제품 스펙 기준)
  ('MS10.4',      'Genie', '10M'),   -- 10.4M
  ('MS11.8',      'Genie', '14M'),   -- 13.8M 추출
  -- JLG 붐형
  ('E450AJ',      'JLG',   '16M굴절'), -- 15.72M 추출 (전동붐)
  ('Z45_25J DC',  'JLG',   '16M굴절'), -- 15.94M 추출 (절곡붐)
  -- Haulotte
  ('OPTIMUM8',    'Haulotte', '8M'),  -- 이미지 PDF
  ('SIGMA16',     'Haulotte', '16M굴절'), -- 16.1M 추출
  ('compact8',    'Haulotte', '8M'),  -- 이미지 PDF
  -- JCPT (중국)
  ('JCPT1614ACZ', 'JCPT',  '16M')   -- 15.7M 추출
ON CONFLICT (model) DO UPDATE
  SET manufacturer = EXCLUDED.manufacturer,
      work_height  = EXCLUDED.work_height;
