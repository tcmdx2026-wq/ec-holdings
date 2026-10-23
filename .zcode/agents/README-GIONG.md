# 🤖 Đội AI Agents GIONG — 13 agent (project scope)

> Nằm TRONG repo (`giong-vn-v6/.zcode/agents/`) — **máy nào `git pull` repo là
> có ngay, KHÔNG phải cài lại** (trả lời câu hỏi Đại ca 20/10/2026: khi lên máy
> công ty chỉ cần pull — ZCode tự nạp các agent này cho phiên mở đúng project).
> Máy khác muốn dùng cho project khác → copy thư mục này vào
> `C:/Users/<user>/.zcode/agents/` (global).

## Đội hình

**Agent tiếng Việt (3):**

| Agent | Vai trò |
|---|---|
| `tong-dai-giong` | Tổng đài điều phối — nhận việc, phân vai, tổng hợp kết quả, tuân thủ quy trình 5 bước + quy tắc ĐA AGENT |
| `chuyen-gia-giong` | Chuyên gia hệ thống GIONG — kiến trúc app tổng/app con/agent Python, GiondDB + tunnel, quy trình Download→ETL→Báo cáo |
| `kiem-tra-production` | Kiểm chứng production sau Push — env Vercel 2 app + curl version + login + SSO (quy trình GĐ 469) |

**Agent chuyên môn quốc tế (10 — từ repo agency-agents, MIT):**
`frontend-developer` · `backend-architect` · `database-optimizer` ·
`code-reviewer` · `minimal-change-engineer` · `sre-site-reliability-engineer` ·
`test-automation-engineer` · `application-security-engineer` ·
`senior-project-manager` · `product-manager`

## 💰 Model đội (tiết kiệm quota — Đại ca chốt 20/10)

- Model phiên thường chạy trên **quota gói** — cạn nhanh khi đội chạy song song.
- Khi điều phối nhiều agent (dynamic workflow): đặt
  **`subagent_model = "new-provider-2/z-ai/glm-5.3"`** = GLM chạy bằng **KEY
  riêng của Đại ca** (không hao quota). DeepSeek key:
  `new-provider/deepseek-ai/deepseek-v4.1-flash`.
- Đổi model mặc định của PHIÊN chính: Đại ca chọn trong model picker của ZCode
  (chọn "Nvidia GLM 5.3" = provider-2/key) — agent không tự đổi được model phiên.

## Cách dùng

1. Mở phiên ZCode đúng project (đã pull) → đội 13 agent tự nạp.
2. Giao việc cho `tong-dai-giong` (hoặc em/tổng đài phiên chính phân vai) —
   nói tiếng Việt bình thường.
3. Thêm/bớt agent: file `.md` với frontmatter `name` + `description` là 1 agent;
   thêm vào thư mục này + commit → mọi máy pull là có.

## Lịch sử

- **GĐ 480 (19/10):** cài 10 agent vào global `~/.zcode/agents/` máy DESKTOP (PA-3 ĐH chốt).
- **GĐ 482 (20/10):** chuyển vào repo (project scope — máy công ty pull là có)
  + viết 3 agent tiếng Việt + chốt model đội = GLM key (khai thác ngay, không chờ PA-2).
