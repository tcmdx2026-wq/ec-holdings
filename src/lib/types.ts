export type TaskStatus = "Việc cần làm" | "Đang làm" | "Đã xong";

export type Task = {
  id: string;
  assignee: string;
  title: string;
  created: string;
  due: string;
  status: TaskStatus | string;
  support: string; // comma-separated list of support names
  blocker: string;
  updated: string;
  createdBy: string;
  /** Người giao nhiệm vụ — mặc định trùng createdBy */
  assigner: string;
  photo?: string;
  location?: string;
};

export type Attendance = {
  id: string;
  employeeId?: string;
  name: string;
  status: string;
  time: string;
  date: string;
  weekday: string;
  gps: string;
  address: string;
  photo?: string;
  type: string;
  approved: string;
  workplace: string;
  /** ISO timestamp of last modification — used for LWW conflict resolution */
  updatedAt: string;
  /** Client-only: true if this record has been synced to Neon */
  synced?: boolean;
};

export type DailyAttendance = { date: string; in: number; out: number };

export type Note = {
  id: string;
  stt?: number | string;
  date: string;
  content: string;
  author: string;
  deploy: string;
  deadline: string;
  support: string;
  dept: string;
  status: string;
  createdBy?: string;
  updatedAt?: string;
  /** Tombstone — ghi chú đã xóa (chỉ Admin xóa được, GĐ 91) */
  deletedAt?: string;
};

export type Employee = {
  id: string;
  name: string;
  username: string;
  gender: string;
  phone: string;
  email: string;
  dept: string;
  role: "SuperAdmin" | "Admin" | "User" | string;
  title: string;
  center: string;
  status: string;
};

export type Center = {
  code: string;
  name: string;
  short: string;
  city: string;
  kind: "Trung tâm" | "Văn phòng";
  /** Số điện thoại trung tâm — Admin điền (GĐ 87) */
  phone?: string;
  /** Tên nhân sự phụ trách trung tâm — Admin chọn từ dropdown (GĐ 87) */
  manager?: string;
  /** Ghi chú — Admin điền (GĐ 87) */
  note?: string;
};

export type Proposal = {
  id: string;
  kind: "Nhân sự" | "Thu chi" | "Nhập xuất" | "Góp ý";
  title: string;
  requester: string;
  date: string;
  detail: string;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối";
  dept: string;
  /** Người duyệt (tên hiển thị) — trống nếu chưa duyệt */
  approver?: string;
  /** ISO timestamp lúc duyệt/từ chối */
  approvedAt?: string;
  /** ID employee khởi tạo — nguồn sự thật cho lọc "của tôi" */
  createdBy?: string;
  /** ISO timestamp lần sửa cuối — dùng cho LWW merge offline */
  updatedAt?: string;
  /** Tombstone — phiếu đã xóa (soft delete) */
  deletedAt?: string;
  /** Danh sách tệp đính kèm (URL Cloudinary) */
  attachments?: string[];
};

export type ChatMessage = {
  id: string;
  /** Tên hiển thị người gửi (username — VD "CườngPK") */
  from: string;
  text: string;
  /** Thời điểm gửi "YYYY-MM-DD HH:mm" — dùng cho sort + LWW merge */
  at: string;
  /** Kênh nhóm ("Chung", "Kế toán"...) — rỗng nếu tin 1-1 */
  channel: string;
  /** ID employee người gửi — chính xác hơn `from` (tên có thể trùng) */
  fromId?: string;
  /** Nhắn 1-1: "empA|empB" (2 ID sort tăng) — rỗng nếu kênh nhóm */
  directKey?: string;
  /** Danh sách tệp đính kèm (URL Cloudinary) */
  attachments?: string[];
  /** ISO timestamp — LWW merge offline */
  updatedAt?: string;
  /** Tombstone — tin đã thu hồi */
  deletedAt?: string;
  /** ID nhóm chat riêng (GĐ 72) — rỗng nếu kênh công khai hoặc 1-1 */
  groupId?: string;
  /** Danh sách ID employee được @mention trong tin nhóm (GĐ 77) — rỗng nếu không mention */
  mentions?: string[];
  /** GĐ 94: reaction kiểu Zalo — [{ employeeId, emoji }] — 1 user 1 emoji trên 1 tin */
  reactions?: { employeeId: string; emoji: string }[];
  /** GĐ 94: trả lời tin khác — ID tin được trả lời (rỗng nếu không phải reply) */
  replyToId?: string;
  /** GĐ 94: tin chuyển tiếp — tên người/nguồn gửi gốc (rỗng nếu không phải forward) */
  forwardedFrom?: string;
  /** GĐ 94: tin được ghim đầu hội thoại (chỉ 1 tin/hội thoại, ghim mới thay ghim cũ) */
  pinned?: boolean;
  /** GĐ 94: ai ghim (tên hiển thị) */
  pinnedBy?: string;
  /** GĐ 94: tin đã lưu — danh sách employeeId đã đánh dấu ⭐ */
  starredBy?: string[];
  /** GĐ 94: xóa CHỈ Ở PHÍA TÔI — danh sách employeeId không còn thấy tin này */
  deletedBy?: string[];
};

/** Nhóm chat riêng (GĐ 72) — kiểu Zalo: Admin tạo, thành viên mới thấy */
export type ChatGroup = {
  id: string;
  name: string;
  /** ID employee tạo nhóm (chủ nhóm) */
  createdBy: string;
  /** Danh sách member: employeeId + role */
  members: ChatGroupMember[];
  /** ISO timestamp — LWW */
  updatedAt?: string;
  /** Tombstone — nhóm đã giải tán */
  deletedAt?: string;
};

export type ChatGroupMember = {
  employeeId: string;
  role: "owner" | "member" | string;
};

/** Loại hồ sơ tài liệu — danh sách cố định để lọc/thống kê (GĐ 66) */
export const DOC_CATEGORIES = [
  "Quy chế/Nội quy",
  "Hợp đồng",
  "Hồ sơ nhân sự",
  "Tài chính",
  "Hướng dẫn",
  "Khác",
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

export type Document = {
  id: string;
  title: string;
  category: string;
  dept: string;
  center: string;
  summary: string;
  /** Người tạo (tên hiển thị) */
  creator: string;
  /** ID employee người tạo — lọc "của tôi" chính xác */
  createdBy: string;
  /** Ngày hồ sơ (YYYY-MM-DD) */
  date: string;
  /** ISO timestamp lần sửa cuối — LWW merge offline */
  updatedAt: string;
  /** Tombstone — hồ sơ đã xóa */
  deletedAt?: string;
  /** Danh sách tệp đính kèm (URL Cloudinary) */
  attachments: string[];
};

export type CheckIn = {
  id: string;
  name: string;
  time: string;
  date: string;
  weekday: string;
  gps: string;
  address: string;
  note: string;
  photo?: string;
  /** URL video quay có đóng dấu (GĐ 102) — Cloudinary, song song với photo */
  video?: string;
  centerCode?: string;
  status?: string;
  updatedAt?: string;
  deletedAt?: string;
};
