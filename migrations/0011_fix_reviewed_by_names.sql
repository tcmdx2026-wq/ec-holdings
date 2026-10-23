-- Fix old "Duyệt bởi" names
UPDATE registration_requests SET reviewed_by = 'Admin Phạm Kiên Cường' 
WHERE reviewed_by LIKE '%Auto-duyệt%' OR reviewed_by = 'Phạm Kiên Cường';

UPDATE registration_requests SET reviewed_by = 'Admin Phạm Kiên Cường'
WHERE reviewed_by = 'Nguyễn Thị Thúy';
