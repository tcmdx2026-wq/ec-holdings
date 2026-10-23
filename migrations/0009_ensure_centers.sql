-- 0009: Ensure all 20 centers exist in DB (idempotent)
-- Re-seeds centers table so page shows full list even if earlier migration was incomplete.

INSERT INTO centers (id, organization_id, code, name, short_name, city, district, address, status) VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'VP', 'Văn phòng Công ty Gióng Việt Nam', 'Văn phòng', 'Long Biên, Hà Nội', 'Long Biên', 'Long Biên, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'LB', 'Trung tâm tiêm chủng Gióng Long Biên', 'Long Biên', 'Long Biên, Hà Nội', 'Long Biên', 'Long Biên, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'SĐ', 'Trung tâm tiêm chủng Gióng Sài Đồng', 'Sài Đồng', 'Long Biên, Hà Nội', 'Long Biên', 'Sài Đồng, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111', 'NL', 'Trung tâm tiêm chủng Gióng Ngọc Lâm', 'Ngọc Lâm', 'Long Biên, Hà Nội', 'Long Biên', 'Ngọc Lâm, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333335', '11111111-1111-1111-1111-111111111111', 'TO', 'Trung tâm tiêm chủng Gióng Thanh Oai', 'Thanh Oai', 'Thanh Oai, Hà Nội', 'Thanh Oai', 'Thanh Oai, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333336', '11111111-1111-1111-1111-111111111111', 'QO', 'Trung tâm tiêm chủng Gióng Quốc Oai', 'Quốc Oai', 'Quốc Oai, Hà Nội', 'Quốc Oai', 'Quốc Oai, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333337', '11111111-1111-1111-1111-111111111111', 'BH', 'Trung tâm tiêm chủng Gióng Bích Hòa', 'Bích Hòa', 'Thanh Oai, Hà Nội', 'Thanh Oai', 'Bích Hòa, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333338', '11111111-1111-1111-1111-111111111111', 'ML', 'Trung tâm tiêm chủng Gióng Mê Linh', 'Mê Linh', 'Mê Linh, Hà Nội', 'Mê Linh', 'Mê Linh, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333339', '11111111-1111-1111-1111-111111111111', 'TP', 'Trung tâm tiêm chủng Gióng Tiền Phong', 'Tiền Phong', 'Mê Linh, Hà Nội', 'Mê Linh', 'Tiền Phong, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333340', '11111111-1111-1111-1111-111111111111', 'CĐ', 'Trung tâm tiêm chủng Gióng Chi Đông', 'Chi Đông', 'Mê Linh, Hà Nội', 'Mê Linh', 'Chi Đông, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333341', '11111111-1111-1111-1111-111111111111', 'TĐ', 'Trung tâm tiêm chủng Gióng Thạch Đà', 'Thạch Đà', 'Mê Linh, Hà Nội', 'Mê Linh', 'Thạch Đà, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333342', '11111111-1111-1111-1111-111111111111', 'LM', 'Trung tâm tiêm chủng Gióng Liên Mạc', 'Liên Mạc', 'Bắc Từ Liêm, Hà Nội', 'Bắc Từ Liêm', 'Liên Mạc, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333343', '11111111-1111-1111-1111-111111111111', 'TA', 'Trung tâm tiêm chủng Gióng Tâm An', 'Tâm An', 'Hà Nội', 'Hà Nội', 'Tâm An, Hà Nội', 'active'),
  ('33333333-3333-3333-3333-333333333344', '11111111-1111-1111-1111-111111111111', 'PY', 'Trung tâm tiêm chủng Gióng Phúc Yên', 'Phúc Yên', 'Phúc Yên, Vĩnh Phúc', 'Phúc Yên', 'Phúc Yên, Vĩnh Phúc', 'active'),
  ('33333333-3333-3333-3333-333333333345', '11111111-1111-1111-1111-111111111111', 'ĐX', 'Trung tâm tiêm chủng Gióng Đồng Xuân', 'Đồng Xuân', 'Vĩnh Phúc', 'Vĩnh Phúc', 'Đồng Xuân, Vĩnh Phúc', 'active'),
  ('33333333-3333-3333-3333-333333333346', '11111111-1111-1111-1111-111111111111', 'TS', 'Trung tâm tiêm chủng Gióng Từ Sơn', 'Từ Sơn', 'Từ Sơn, Bắc Ninh', 'Từ Sơn', 'Từ Sơn, Bắc Ninh', 'active'),
  ('33333333-3333-3333-3333-333333333347', '11111111-1111-1111-1111-111111111111', 'HM', 'Trung tâm tiêm chủng Gióng Hương Mạc', 'Hương Mạc', 'Từ Sơn, Bắc Ninh', 'Từ Sơn', 'Hương Mạc, Bắc Ninh', 'active'),
  ('33333333-3333-3333-3333-333333333348', '11111111-1111-1111-1111-111111111111', 'TD', 'Trung tâm tiêm chủng Gióng Tiên Du', 'Tiên Du', 'Tiên Du, Bắc Ninh', 'Tiên Du', 'Tiên Du, Bắc Ninh', 'active'),
  ('33333333-3333-3333-3333-333333333349', '11111111-1111-1111-1111-111111111111', 'ĐY', 'Trung tâm tiêm chủng Gióng Đông Yên', 'Đông Yên', 'Bắc Ninh', 'Bắc Ninh', 'Đông Yên, Bắc Ninh', 'active'),
  ('33333333-3333-3333-3333-333333333350', '11111111-1111-1111-1111-111111111111', 'TT', 'Trung tâm tiêm chủng Gióng Thanh Thùy', 'Thanh Thùy', 'Hà Nội', 'Hà Nội', 'Thanh Thùy, Hà Nội', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;
