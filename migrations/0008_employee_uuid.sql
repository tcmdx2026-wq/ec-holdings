-- 0008: Unify employee data — bridge hardcoded catalog to database.
-- After this migration, app loads employees from DB instead of catalog.ts.

-- 1. Add new columns
ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_user_id text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS catalog_id text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS name text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS username text DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS center text DEFAULT 'VP';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role text DEFAULT 'User';

-- 2. Delete old seed data (will re-seed with correct mappings)
DELETE FROM employees;

-- 3. Seed all 33 employees from catalog
-- Center UUIDs from 0002: VP=3331, LB=3332, SĐ=3333, NL=3334, TO=3335, QO=3336,
-- BH=3337, ML=3338, TP=3339, CĐ=3340, TĐ=3341, LM=3342, TA=3343, PY=3344,
-- ĐX=3345, TS=3346, HM=3347, TD=3348, ĐY=3349, TT=3350

-- VP employees (center VP, catalog U-prefix)
INSERT INTO employees (id, center_id, department, title, gender, phone, hire_date, status, catalog_id, name, email, username, center, role) VALUES
('e0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333331','Ban giám đốc','Giám đốc','Nữ','0902267486','2024-01-15','active','U007','Nguyễn Thị Thúy','thuynvy218@gmail.com','GĐ Thúy','VP','Admin'),
('e0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333331','Ban giám đốc','Phó giám đốc','Nam','','2023-06-01','active','U009','Hoàng Minh Châu','hoangminhchau2631960@gmail.com','PGĐ_Châu HM','VP','Admin'),
('e0000000-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333331','Quan ly','Quan tri he thong','Nam','','2023-09-10','active','U002','Admin EC-HOLDINGS','tcmdx2026@gmail.com','AdminEC','VP','Admin'),
('e0000000-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333331','Hệ thống','Chuyên gia lập trình','Nam','0904075757','2024-03-11','active','U031','Phạm Cường','cuongpk.giong02@gmail.com','Cuongpk.Giong02','VP','Admin'),
('e0000000-0000-0000-0000-000000000005','33333333-3333-3333-3333-333333333331','Kế toán','Kế toán trưởng','Nam','0826861379','2023-02-20','active','U003','Trần Mạnh Hùng','ketoangiongvina@gmail.com','Hùng TM','VP','User'),
('e0000000-0000-0000-0000-000000000006','33333333-3333-3333-3333-333333333331','Hành chính - Nhân sự','Trưởng phòng HCNS','Nữ','0327451134','2022-11-02','active','U005','Nguyễn Thị Mỹ Hạnh','nguyenmyhanh2912@gmail.com','Hạnh NTM','VP','User'),
('e0000000-0000-0000-0000-000000000007','33333333-3333-3333-3333-333333333331','Marketing','Nhân viên Marketing','Nữ','','2024-06-05','active','U004','Trần Thị Anh Thương','thuonggvn@gmail.com','Thương TTA','VP','User'),
('e0000000-0000-0000-0000-000000000008','33333333-3333-3333-3333-333333333331','Marketing','Trưởng phòng Marketing','Nữ','','2022-08-18','active','U010','Nguyễn Thị Hương','nguyenhuong.ts2311@gmail.com','Hương NT','VP','User'),
('e0000000-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333331','Kế toán','Kế toán viên','Nữ','0388573597','2023-12-11','active','U006','Nguyễn Thị Dịu','nguyendiuu1912@gmail.com','Dịu NT','VP','User'),
('e0000000-0000-0000-0000-000000000010','33333333-3333-3333-3333-333333333331','Kho','Thủ kho','Nữ','','2023-04-22','active','U030','Trần Thị Thanh Thủy','','Thủy TTT','VP','User'),
('e0000000-0000-0000-0000-000000000011','33333333-3333-3333-3333-333333333331','Dược','Quản lý dược','Nữ','0327045684','2022-10-15','active','U032','Đinh Thị Hương Trà','dinhthihuongtra19062002@gmail.com','DsTra','VP','User'),
('e0000000-0000-0000-0000-000000000012','33333333-3333-3333-3333-333333333331','Hành chính - Nhân sự','Nhân viên HCNS','Nữ','0336365636','2023-05-10','active','U033','Nguyễn Thành Hiếu','hieubin2106@gmail.com','Hiếu NT','VP','User'),
('e0000000-0000-0000-0000-000000000013','33333333-3333-3333-3333-333333333331','Hành chính - Nhân sự','Nhân viên','Nam','','2023-07-08','active','U008','Nguyễn Thành Hiếu','thanhhieu21061993@gmail.com','Hiếu NT 2','VP','User');

-- Center employees (catalog S-prefix)
INSERT INTO employees (id, center_id, department, title, gender, phone, hire_date, status, catalog_id, name, email, username, center, role) VALUES
('e0000000-0000-0000-0000-000000000014','33333333-3333-3333-3333-333333333332','Tiêm chủng','Điều dưỡng','Nữ','','2024-02-11','active','S01','Lê Thị Bích','','Bích LT','LB','User'),
('e0000000-0000-0000-0000-000000000015','33333333-3333-3333-3333-333333333333','Tiêm chủng','Điều dưỡng','Nữ','','2023-08-24','active','S02','Nguyễn Thị Tuyết Lan','','Lan NTT','SĐ','User'),
('e0000000-0000-0000-0000-000000000016','33333333-3333-3333-3333-333333333334','Thu ngân','Thu ngân','Nữ','','2024-03-06','active','S03','Vương Thị Minh','','Minh VT','NL','User'),
('e0000000-0000-0000-0000-000000000017','33333333-3333-3333-3333-333333333346','Tiêm chủng','Điều dưỡng','Nữ','','2023-11-12','active','S04','KIỀU MAI ANH','','Anh KM','TS','User'),
('e0000000-0000-0000-0000-000000000018','33333333-3333-3333-3333-333333333349','Tiêm chủng','Điều dưỡng','Nữ','','2024-01-17','active','S05','Nguyễn Quỳnh Vân','','Vân NQ','TĐ','User'),
('e0000000-0000-0000-0000-000000000019','33333333-3333-3333-3333-333333333338','Thu ngân','Thu ngân','Nữ','','2023-09-18','active','S06','Lê Thị Hằng','','Hằng LT','CĐ','User'),
('e0000000-0000-0000-0000-000000000020','33333333-3333-3333-3333-333333333340','Tiêm chủng','Điều dưỡng','Nữ','','2023-10-16','active','S07','ĐINH THỊ YẾN','','Yến ĐT','PY','User'),
('e0000000-0000-0000-0000-000000000021','33333333-3333-3333-3333-333333333344','Tiêm chủng','Điều dưỡng','Nữ','','2024-02-01','active','S08','Trần Thị Yến','','Yến TT','ĐX','User'),
('e0000000-0000-0000-0000-000000000022','33333333-3333-3333-3333-333333333345','Tiêm chủng','Điều dưỡng','Nữ','','2024-05-13','active','S09','Lê Thị Dung','','Dung LT','LM','User'),
('e0000000-0000-0000-0000-000000000023','33333333-3333-3333-3333-333333333335','Tiêm chủng','Điều dưỡng','Nữ','','2024-02-11','active','S10','Vũ Thị Ánh Ngọc','','Ngọc VTA','TO','User'),
('e0000000-0000-0000-0000-000000000024','33333333-3333-3333-3333-333333333336','Tiêm chủng','Điều dưỡng','Nữ','','2023-08-24','active','S11','Nguyễn Nhật Phương','','Phương NN','QO','User'),
('e0000000-0000-0000-0000-000000000025','33333333-3333-3333-3333-333333333337','Hành chính','Nhân viên','Nam','','2023-07-27','active','S12','Nguyễn Đức Năng','','Năng NĐ','BH','User'),
('e0000000-0000-0000-0000-000000000026','33333333-3333-3333-3333-333333333338','Hành chính','Nhân viên','Nam','','2023-12-18','active','S13','Phạm Hồng Phong','','Phong PH','ML','User'),
('e0000000-0000-0000-0000-000000000027','33333333-3333-3333-3333-333333333339','Thu ngân','Thu ngân','Nữ','','2023-11-22','active','S14','Lỗ Thị Hà','','Hà LT','TP','User'),
('e0000000-0000-0000-0000-000000000028','33333333-3333-3333-3333-333333333347','Tiêm chủng','Điều dưỡng','Nữ','','2024-01-24','active','S15','Đặng Thị Mỹ Linh','','Linh ĐTM','HM','User'),
('e0000000-0000-0000-0000-000000000029','33333333-3333-3333-3333-333333333348','Hành chính','Nhân viên','Nam','','2024-02-07','active','S16','Nguyễn Phú Đông','','Đông NP','TD','User'),
('e0000000-0000-0000-0000-000000000030','33333333-3333-3333-3333-333333333343','Tiêm chủng','Điều dưỡng','Nữ','','2024-03-29','active','S17','Vũ Thị Thanh Huyền','','Huyền VTT','ĐY','User'),
('e0000000-0000-0000-0000-000000000031','33333333-3333-3333-3333-333333333350','Tiêm chủng','Điều dưỡng','Nữ','','2023-06-20','active','S18','Trần Ngọc Anh','','Anh TN','TT','User'),
('e0000000-0000-0000-0000-000000000032','33333333-3333-3333-3333-333333333350','Thu ngân','Thu ngân','Nữ','','2023-05-14','active','S19','Lương Thị Hà Trang','','Trang LTH','TA','User'),
('e0000000-0000-0000-0000-000000000033','33333333-3333-3333-3333-333333333332','Tiêm chủng','Điều dưỡng','Nữ','','2024-04-17','active','S20','Khuất Thị Dung','','Dung KT','LB','User');

-- 4. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS employees_catalog_id_idx ON employees (catalog_id);
CREATE INDEX IF NOT EXISTS employees_auth_user_id_idx ON employees (auth_user_id);
CREATE INDEX IF NOT EXISTS employees_center_code_idx ON employees (center);
