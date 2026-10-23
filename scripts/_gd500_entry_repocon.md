
---

### C.320 — Rà soát 84 job 21/10 (53 done / 19 needsData / 12 error) → khắc phục 4 nhóm lỗi tool (2026-10-21)

> **Yêu cầu của Đại Ca (21/10 tối):** "Kiểm tra cho anh các nhiệm vụ hôm nay thực hiện. Tỷ lệ hoàn thành thế nào? Có lỗi gì không? Nếu có hãy rà soát và khắc phục các lỗi đó."
>
> **Rà soát (probe /jobs + GiondDB):** 84 job trong ngày — **53 done · 19 needsData · 12 error**. 12 error = **3 bank-tpb** + **2 xuatkho** + **2 xnkt** + **1 hddt** (lỗi thật, đã sửa) · 2 tkkh (Đại Ca bấm Hủy — không phải lỗi) · 2 misa-ban-hang-api (đã fix từ GĐ 491 — check lại DB: sm_banhang_phieu 20/10 = 154 phiếu, 152 upload + 152 ghi sổ ✓). 19 needsData = guard thiếu nguồn xoay quanh xnkt/xuatkho 21/10 chưa tải được.
>
> **Chẩn đoán gốc (bằng chứng thật):**
> 1. **SMED sidebar menu ("Kho"/"Báo cáo") ngừng hiện bằng hover ngắn từ ~17:47** — cùng lúc tool 4 nhapkho CÓ fallback "hover lâu hơn 2 điểm" nên thoát (19 file OK), còn tool 5/7/1 KHÔNG có fallback → fail 2 lần rồi bị chuỗi Task bỏ ("bỏ sau 2 lần"); hddt 21:47 fail thêm 1 lần nữa.
> 2. **bank-tpb FAIL 3 đêm liền (18→20/10)** — TPB đổi UI: (a) sau login có modal giới thiệu `v2-intro-modal` ("Xin chào …") CHE TRANG → click bị chặn ("subtree intercepts pointer events"); (b) "Sao kê" khớp 2 element → strict mode violation; (c) màn "Sao kê tài khoản" CŨ không còn — "Sao kê" giờ là DROPDOWN trên thẻ tài khoản (Xuất sao kê · Sao kê đã xuất · Sao kê định kỳ).
> 3. **xnkt thiếu 1/19 file (TT TIÊN DU)** ở lần chạy lại 22:43 — nút "THỐNG KÊ" chưa hiện sau 10s → tool bỏ qua IM LẶNG (download_for_center không có retry từng TT).
> 4. **CDP 9222 chết ~17:5x→22:05** (ảnh hưởng tool MISA attach CDP — KHÔNG ảnh hưởng tool SMED vì mỗi tool tự mở chromium riêng) — đã sống lại 22:08:46 (không rõ tiến trình nào mở; repo không có service/watchdog nào tự mở Chrome).
>
> **Đã sửa (commit `5d7ff56` — 4 file +202/−77, py_compile PASS cả 4):**
> - `5_smed_XUATKHO.py` + `7_smed_BCNXT.py` + `1_smed_THSDHD.py`: **retry hover 3 lần, hover lâu dần** (lần 1 như cũ; lần 2/3 đúng pattern fallback của tool 4 đã chạy OK cùng thời điểm) — hết fail im lặng khi sidebar SMED render chậm.
> - `7_smed_BCNXT.py` (thêm): `_search_and_wait` retry click "THỐNG KÊ" 3 lần (10s/15s/20s) — chặn kiểu mất TT im lặng.
> - `42_tpb_saoke.py`: **chuyển sang UI mới TPB** — helper `_close_intro_modal` (JS click nút Đóng → click thường → xoá DOM) + nav mới `Sao kê → menuitem Xuất sao kê → Tùy chỉnh ngày + Excel → button.btn-primary Xuất sao kê` + helper `_open_da_xuat` (nút success page HOẶC dropdown trang chủ); logic tải row đúng kỳ GIỮ NGUYÊN (bảng mới vẫn ghi "Thời gian: dd/mm/yyyy - dd/mm/yyyy").
>
> **Verify (chạy thật, không chỉ đọc code):**
> - 7 vòng probe playwright (scripts/_gd500_probe_tpb_flow2→7, app tổng) — soi DOM modal/dropdown/form/danh sách + **tải thật 1 file `TPBANK_HISTORY11698866789_21102026_231502088.xlsx` (15.489 bytes)** từ luồng mới.
> - Chạy lại qua agent: **xuatkho 21/10 = 19 file + ETL 423 dòng ✅** · **xnkt 21/10 = 18 file + ETL 1.118 dòng ✅** (TIÊN DU bị bỏ im lặng — đã fix retry, chuỗi Task_02 23:00 chạy lại full) · **hddt 21/10 = 19 file ✅** (chuỗi tự chạy lại 23:00:29→23:05:48 dùng code fix).
> - **bank-tpb UI mới qua agent: 19/10 DONE 23:46:01 + 20/10 DONE 23:46:57** (1 file/ngày, ETL "1 rỗng" — 0 giao dịch, valid-empty theo C.131/GĐ 436) · 18/10: request xuất OK nhưng row không hiện trong 3 phút (2 lần — nghi TPB làm chậm/chặn request LẶP cùng kỳ; probe5 23:15 + job 23:41 + job 23:57 = 3 request) → dùng file **tải thật lúc 23:25** đặt vào OUTPUT/17.BANK_TPB/2026-10-18 + ETL ghi nhận rỗng hợp lệ → đủ 18-20/10.
> - Chuỗi Task_02 23:00 (ngày 21/10, 19 download + 28 báo cáo): hddt ✅ 23:05:48 · dtdt ✅ 23:13:22 · dtthc ✅ 23:15:25 · bkccn ✅ 23:39:00 (19 file + 236 dòng) · nhapkho ✅ — các bước sau chạy tiếp với code fix.
>
> **Bài học:** (1) TPB đổi UI → phải probe DOM trước khi sửa selector (mù sửa theo đoán sẽ bỏ sót modal chặn click); (2) request xuất sao kê TPB LẶP cùng kỳ có thể không ra row — tránh chạy lại trùng ngày, chờ xử lý xong rồi mới chạy; (3) tool thiếu retry từng trung tâm = mất dữ liệu IM LẶNG (xnkt 18/19) — phải log cảnh báo to.
>
> **Tiêu chí kiểm chứng:** (1) báo cáo XNKT/BKX 21/10 đủ 19 TT (sau khi chuỗi chạy lại xnkt); (2) OUTPUT/17.BANK_TPB đủ 3 ngày 18-20/10 + báo cáo bank-tpb-chitiet/tonghop kỳ đó ra số 0 hợp lệ; (3) chuỗi 23:00 hoàn tất không needsData oan.
>
> **Version:** KHÔNG bump (chờ lệnh Push — quy tắc ĐA AGENT). Repo con **10.2.0**.
