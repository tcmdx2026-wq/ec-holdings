-- 0019: Bảng documents cho module "Hồ sơ tài liệu" nâng cấp (GĐ 66).
-- Thay 4 hồ sơ cứng trong catalog.ts bằng bảng DB đầy đủ CRUD + đính kèm.

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text DEFAULT 'Khác',
  dept text DEFAULT '',
  center text DEFAULT '',
  summary text DEFAULT '',
  creator text DEFAULT '',
  created_by text DEFAULT '',
  date date DEFAULT CURRENT_DATE,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Seed 4 hồ sơ cũ từ catalog.ts (id giữ nguyên để liên kết)
INSERT INTO documents (id, title, category, dept, center, summary, creator, created_by, date)
VALUES
  ('hs1', 'Quy chế chấm công & lương', 'Quy chế/Nội quy', 'HCNS', 'VP', 'Quy chế chấm công, tính lương, phúc lợi của công ty', 'Ban giám đốc', '', '2026-07-12'),
  ('hs3', 'Hồ sơ vay vốn VietinBank', 'Tài chính', 'Tài chính', 'VP', 'Hồ sơ vay vốn ngân hàng VietinBank', 'Ban giám đốc', '', '2026-02-11'),
  ('hs5', 'Nội quy trung tâm tiêm chủng', 'Quy chế/Nội quy', 'Ban giám đốc', 'VP', 'Nội quy vận hành các trung tâm tiêm chủng', 'Ban giám đốc', '', '2026-04-18'),
  ('hs6', 'Hướng dẫn thu ngân tại điểm', 'Hướng dẫn', 'Kế toán', 'VP', 'Hướng dẫn nghiệp vụ thu ngân tại điểm tiêm', 'Kế toán', '', '2026-03-10')
ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS documents_category_idx ON documents (category);
CREATE INDEX IF NOT EXISTS documents_dept_idx ON documents (dept);
CREATE INDEX IF NOT EXISTS documents_creator_idx ON documents (creator);
CREATE INDEX IF NOT EXISTS documents_created_by_idx ON documents (created_by);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx ON documents (deleted_at) WHERE deleted_at IS NOT NULL;
