import { create } from "zustand";
import { seedAttendance, seedNotes, seedTasks } from "@/data";

import { deleteMessage } from "@/routes/api/data";

import type {
  Attendance,
  Center,
  ChatGroup,
  ChatMessage,
  CheckIn,
  Document,
  Employee,
  Note,
  Proposal,
  Task,
} from "@/lib/types";
import { nowTime, todayIso, weekdayVi } from "@/lib/format";
import { uid } from "@/lib/utils";
import { mergeByTs, parseTs } from "./merge";

const LS_KEY = "giong-vn-v5";

type PersistSlice = {
  tasks: Task[];
  attendance: Attendance[];
  notes: Note[];
  proposals: Proposal[];
  messages: ChatMessage[];
  checkins: CheckIn[];
  documents: Document[];
  chatGroups: ChatGroup[];
  currentUserId: string;
  employees: Employee[];
  centers: Center[];
  _neonReady: boolean;
  /** GĐ 74: counter bump khi markConversationRead — buộc badge unread re-render. Không persist. */
  _chatReadTick?: number;
};

type Actions = {
  hydrate: () => void;
  persist: () => void;
  setCurrentUserId: (userId: string) => void;
  currentName: () => string;
  addTask: (t: Omit<Task, "id" | "created" | "updated"> & { assigner?: string }) => void;
  setTaskStatus: (id: string, status: string) => void;
  updateTask: (id: string, data: { assignee: string; title: string; due: string; support: string; blocker: string; photo?: string; location?: string }) => void;
  clock: (
    kind: "Điểm danh vào ca" | "Điểm danh tan ca",
    gps?: string,
    address?: string,
    photo?: string,
    employeeName?: string,
    employeeId?: string,
    workplace?: string,
  ) => Attendance;
  removeAttendance: (id: string) => void;
  removeTask: (id: string) => void;
  addNote: (n: Omit<Note, "id">) => void;
  updateNote: (id: string, data: Partial<Pick<Note, "content" | "deadline" | "support" | "dept" | "status">>) => void;
  removeNote: (id: string) => void;
  addProposal: (p: Omit<Proposal, "id">) => void;
  updateProposal: (id: string, data: Partial<Pick<Proposal, "kind" | "title" | "detail" | "dept" | "attachments">>) => void;
  removeProposal: (id: string) => void;
  setProposalStatus: (id: string, status: Proposal["status"], approver?: string) => void;
  sendMessage: (text: string, channel: string, opts?: { toId?: string; attachments?: string[]; groupId?: string; mentions?: string[]; replyToId?: string; forwardedFrom?: string }) => void;
  /** GĐ 94: đổi meta tin nhắn (reaction/ghim/đánh dấu/xóa phía tôi) — LWW qua Neon */
  updateMessageMeta: (id: string, meta: { reactions?: { employeeId: string; emoji: string }[]; pinned?: boolean; pinnedBy?: string; starredBy?: string[]; deletedBy?: string[] }) => void;
  refreshMessages: () => Promise<void>;
  removeMessage: (id: string) => void;
  addChatGroup: (name: string, memberIds: string[]) => void;
  addChatGroupMembers: (groupId: string, employeeIds: string[]) => void;
  /** GĐ 77: đổi tên nhóm — Owner/Admin */
  renameChatGroup: (groupId: string, name: string) => void;
  removeChatGroupMember: (groupId: string, employeeId: string) => void;
  removeChatGroup: (groupId: string) => void;
  /** GĐ 74: đánh dấu đã đọc hội thoại (cập nhật lastReadAt) — giảm badge unread */
  markConversationRead: (convKey: string) => void;
  addCheckin: (gps?: string, address?: string, note?: string, photo?: string, centerCode?: string, video?: string) => CheckIn;
  removeCheckin: (id: string) => void;
  addDocument: (d: Omit<Document, "id" | "updatedAt">) => void;
  updateDocument: (id: string, data: Partial<Pick<Document, "title" | "category" | "dept" | "center" | "summary" | "attachments">>) => void;
  removeDocument: (id: string) => void;
};

function slice(s: PersistSlice): PersistSlice {
  return {
    tasks: s.tasks,
    attendance: s.attendance,
    notes: s.notes,
    proposals: s.proposals,
    messages: s.messages,
    checkins: s.checkins,
    documents: s.documents,
    chatGroups: s.chatGroups,
    currentUserId: s.currentUserId,
    employees: s.employees,
    centers: s.centers,
    _neonReady: false,
  };
}

// Fallback employees/centers for initial render before DB loads.
// These match the seed data in migration 0008.
// Fallback employees (new company: EC-HOLDINGS) - minimal admin only.
const FALLBACK_EMPLOYEES: Employee[] = [
  { id: 'e0000000-0000-0000-0000-000000000003', name: 'Admin EC-HOLDINGS', username: 'AdminEC', gender: 'Nam', phone: '', email: 'tcmdx2026@gmail.com', dept: 'Quan ly', role: 'Admin', title: 'Quan tri he thong', center: 'VP', status: 'Dang lam viec' },
];

const FALLBACK_CENTERS: Center[] = [
  { code: 'VP', name: 'Van phong cong ty EC-HOLDINGS', short: 'Van phong', city: '', kind: 'Van phong' },
];

const initial: PersistSlice = {
  tasks: seedTasks,
  attendance: seedAttendance,
  notes: seedNotes,
  proposals: [],
  messages: [],
  checkins: [],
  documents: [],
  chatGroups: [],
  _chatReadTick: 0,
  currentUserId: 'e0000000-0000-0000-0000-000000000003', // Phạm Kiên Cường UUID
  employees: FALLBACK_EMPLOYEES,
  centers: FALLBACK_CENTERS,
  _neonReady: false,
};

/** Save to localStorage as offline fallback. */
function saveLs(s: PersistSlice) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(slice(s)));
  } catch {
    /* quota */
  }
}

// ── Pending sync queue (localStorage) ────────────────────────────────────────
const PENDING_KEY = "giong-vn-pending-sync";

// Background retry state (module-level, singleton)
let _bgRetryStarted = false;
// GĐ 84: cờ chống chạy 2 lần retry đồng thời (scheduler + nút thủ công)
let _syncRunning = false;
// GĐ 84: timeout của lịch retry backoff — reschedule sau mỗi lần chạy
let _retryTimeout: ReturnType<typeof setTimeout> | null = null;

// GĐ 170: key — định danh xóa khỏi queue (mặc định data.id; update/meta dùng `${id}:update`/`${id}:meta`)
type PendingRecord = { collection: string; data: any; attempts?: number; key?: string };

const PENDING_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getPendingSync(): PendingRecord[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as PendingRecord[];
    // Expire records older than 7 days
    const now = Date.now();
    const fresh = all.filter((r) => {
      const ts = r.data?._syncTs ?? 0;
      return ts === 0 || (now - ts) < PENDING_EXPIRY_MS;
    });
    if (fresh.length < all.length) {
      localStorage.setItem(PENDING_KEY, JSON.stringify(fresh));
    }
    return fresh;
  } catch {
    return [];
  }
}

function addPendingSync(record: PendingRecord) {
  const pending = getPendingSync();
  // Add timestamp for expiry tracking
  record.data._syncTs = Date.now();
  // GĐ 170: bản ghi update/meta dùng key trực quan `${id}:update` / `${id}:meta` —
  // đặt vào record.key để clearPendingSync nhận diện đúng (không đụng data.id).
  if (!record.key && record.data._tombstoneUpdate) record.key = `${record.data.id}:update`;
  if (!record.key && record.data._tombstoneMeta) record.key = `${record.data.id}:meta`;
  if (!record.key && record.data._tombstone) record.key = record.data.id;
  pending.push(record);
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* quota */
  }
  // GĐ 84: bản ghi mới — rút ngắn vòng chờ (≤5s) để sync nhanh,
  // không phải chờ cả chu kỳ backoff dài đang treo
  scheduleNextRetry(5_000);
}

function clearPendingSync(ids: string[]) {
  if (ids.length === 0) return;
  // GĐ 170: khớp theo record.key (update/meta) HOẶC data.id (bản ghi thường).
  const pending = getPendingSync().filter(
    (r) => !ids.includes((r as any).key ?? r.data.id),
  );
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* quota */
  }
}

/** Retry pending Neon inserts from previous offline sessions. */
async function retryPendingSync() {
  const pending = getPendingSync();
  if (pending.length === 0) return;
  if (_syncRunning) return; // GĐ 84: tránh chạy đè (nút thủ công + interval)
  _syncRunning = true;
  try {
  const succeeded: string[] = [];
  const api = await import("@/routes/api/data");
  for (const record of pending) {
    try {
      switch (record.collection) {
        case "attendance":
          await api.insertAttendance({ data: record.data });
          break;
        case "tasks":
          // GĐ 170: tombstone (removeTask) đi qua deleteTask; bản ghi thường đi qua
          // insertTask UPSERT LWW.
          if (record.data._tombstone) {
            await api.deleteTask({ data: { id: record.data.id, deletedAt: record.data.deletedAt } });
          } else {
            await _neonInsertTask(record.data as Task);
          }
          break;
        case "checkins":
          // GĐ 170: tombstone (removeCheckin) đi qua deleteCheckin; bản ghi thường
          // đi qua insertCheckin UPSERT LWW.
          if (record.data._tombstone) {
            await api.deleteCheckin({ data: { id: record.data.id } });
          } else {
            await _neonInsertCheckin(record.data as CheckIn);
          }
          break;
        case "messages":
          // GĐ 170: meta (reaction/ghim/⭐/xóa phía tôi) đi qua updateMessageMeta;
          // tombstone (removeMessage) đi qua insertMessage UPSERT như cũ.
          if (record.data._tombstoneMeta) {
            const { updateMessageMeta } = api;
            await updateMessageMeta({ data: record.data.meta });
          } else {
            await _neonInsertMessage(record.data as ChatMessage);
          }
          break;
        case "notes":
          // GĐ 91: tombstone (removeNote) đi qua insert UPSERT — preserve deleted_at
          // như proposals; bản ghi thường thì UPSERT LWW như cũ.
          // GĐ 170: tombstone-update (updateNote offline) đi qua updateNote server.
          if (record.data._tombstoneUpdate) {
            await _neonUpdateNote(record.data.id, record.data.update);
          } else {
            await _neonInsertNote(record.data as Note);
          }
          break;
        case "proposals":
          // GĐ 170: tombstone-update (updateProposal/duyệt offline) đi qua updateProposal
          // server; bản ghi thường thì UPSERT LWW như cũ.
          if (record.data._tombstoneUpdate) {
            await _neonUpdateProposal(record.data.id, record.data.update);
          } else {
            await _neonInsertProposal(record.data as Proposal);
          }
          break;
        case "messages":
          await _neonInsertMessage(record.data as ChatMessage);
          break;
        case "checkins":
          await _neonInsertCheckin(record.data as CheckIn);
          break;
        default:
          continue; // unknown collection — leave in queue
      }
      succeeded.push(record.data.id);
    } catch (err) {
      // GĐ 84: đánh dấu thời điểm fail gần nhất — recentFailures() reset đếm sau 10 phút
      record.attempts = (record.attempts ?? 0) + 1;
      record.data._lastFailTs = Date.now();
      console.warn(`[store] Retry sync failed (${record.attempts}x) for ${record.collection}/${record.data.id}:`, err);
    }
  }
  if (succeeded.length > 0) {
    clearPendingSync(succeeded);
    console.log(`[store] Retry sync: ${succeeded.length}/${pending.length} records synced`);
    // GĐ 171: flip synced=true ngay trên state + localStorage — trước đây chỉ path
    // clock() (điểm danh trực tiếp) làm, còn retry offline thành công thì synced
    // vẫn false → badge "Lỗi sync"/"Đang chờ" kẹt mãi dù data đã lên server.
    // (synced chỉ là client-only flag trên Attendance — các collection khác
    //  không hiển thị badge nên không cần đụng.)
    const succeededSet = new Set(succeeded);
    useAppStore.setState((s) => ({
      attendance: s.attendance.map((a: Attendance) =>
        succeededSet.has(a.id) ? { ...a, synced: true } : a,
      ),
    }));
    saveLs(useAppStore.getState());
  }
  // Save updated attempts back to localStorage
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch { /* quota */ }
  } finally {
    _syncRunning = false;
  }
}

/**
 * GĐ 84: Lập lịch retry TỰ THÍCH ỨNG — hết 1 vòng chạy, đặt vòng kế theo số lần fail
 * hiện tại: 5s (mới) → 10s → 30s → 60s → 5 phút (lỗi dai dẳng). Thay cho interval 30s
 * cố định cũ (dội server liên tục khi lỗi dài).
 * maxDelayMs: trần delay — dùng khi có bản ghi MỚI thêm vào queue (addPendingSync)
 * để bản ghi mới không phải chờ cả chu kỳ backoff dài.
 */
function scheduleNextRetry(maxDelayMs?: number) {
  if (typeof window === "undefined") return;
  if (_retryTimeout) clearTimeout(_retryTimeout);
  if (getPendingSync().length === 0) return; // queue rỗng — không cần lịch
  const base = currentRetryDelayMs();
  const delay = maxDelayMs ? Math.min(base, maxDelayMs) : base;
  _retryTimeout = setTimeout(() => {
    retryPendingSync()
      .then(() => useAppStore.getState().hydrate())
      .catch(() => {})
      .finally(() => scheduleNextRetry());
  }, delay);
}

/** Get pending sync records for admin visibility. */
export function getPendingSyncRecords(): PendingRecord[] {
  return getPendingSync();
}

/* ── GĐ 84: Retry backoff + trigger thủ công ───────────────────────────── */

/** Chu kỳ retry theo số lần đã fail: 5s (lần đầu) → 10s → 30s → 60s → 5 phút. */
const RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 300_000];

/** Đổi chu kỳ retry hiện tại theo số lần fail nhiều nhất trong queue. */
function currentRetryDelayMs(): number {
  const maxAttempts = getPendingSync().reduce(
    (max, r) => Math.max(max, r.attempts ?? 0),
    0,
  );
  return RETRY_DELAYS_MS[Math.min(maxAttempts, RETRY_DELAYS_MS.length - 1)];
}

/** Đếm số lần fail gần nhất của 1 record (chỉ tính attempts trong 10 phút gần đây). */
function recentFailures(record: PendingRecord): number {
  const lastFailTs = record.data?._lastFailTs ?? 0;
  if (lastFailTs > 0 && Date.now() - lastFailTs > 10 * 60 * 1000) return 0; // reset sau 10 phút
  return record.attempts ?? 0;
}

/**
 * Trigger retry NGAY LẬP TỨC (GĐ 84) — dùng cho:
 * - Nút "Thử lại ngay" trên trang Chấm công
 * - Lịch retry tự thích ứng (backoff) thay cho interval 30s cố định cũ
 * Trả về số bản ghi sync thành công (−1 nếu đang có lần chạy khác).
 */
export async function triggerPendingSyncNow(): Promise<number> {
  if (_syncRunning) return -1;
  try {
    const before = getPendingSync().length;
    if (before === 0) return 0;
    await retryPendingSync();
    const after = getPendingSync().length;
    return Math.max(0, before - after);
  } catch {
    return 0;
  }
}

/** Thống kê queue cho UI (dashboard sync ở trang Chấm công). */
export function getPendingSyncStats(): {
  total: number;
  failed: number;
  expiringSoon: number;
  nextRetryMs: number;
} {
  const pending = getPendingSync();
  const now = Date.now();
  let failed = 0;
  let expiringSoon = 0;
  for (const r of pending) {
    if (recentFailures(r) > 5) failed += 1;
    const age = now - (r.data?._syncTs ?? now);
    if (age > PENDING_EXPIRY_MS - 24 * 60 * 60 * 1000) expiringSoon += 1; // còn < 24h
  }
  return { total: pending.length, failed, expiringSoon, nextRetryMs: currentRetryDelayMs() };
}

/* ── GĐ 74: Unread chat tracking ─────────────────────────────────────────── */

/** Selector đọc counter bump — badge re-render khi markConversationRead. */
export function _chatReadTickSelector(s: { _chatReadTick?: number }): number {
  return s._chatReadTick ?? 0;
}

/** Key hội thoại cho 1 tin nhắn (theo user hiện tại) — đồng bộ với chat.tsx */
export function conversationKeyOf(m: ChatMessage, userId: string): string {
  if (m.groupId) return `mygroup:${m.groupId}`;
  if (m.directKey) return `direct:${m.directKey.split("|").find((id) => id !== userId) ?? m.directKey}`;
  return `group:${m.channel}`;
}

/** Đọc map lastReadAt per-user từ localStorage. */
function readLastReadMap(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`giong-vn-chat-read-${userId}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Số tin nhắn CHƯA ĐỌC của 1 hội thoại — tin của người KHÁC gửi sau lastReadAt.
 * Dùng cho badge đỏ trên icon Chat (bottom bar mobile + sidebar).
 */
export function unreadCountFor(
  messages: ChatMessage[],
  convKey: string,
  userId: string,
  lastReadMap: Record<string, string>,
): number {
  const lastRead = lastReadMap[convKey];
  const lastReadTs = lastRead ? Date.parse(lastRead) || 0 : 0;
  return messages.filter((m) => {
    if (m.fromId === userId) return false; // tin của mình không tính
    if (m.deletedAt) return false;
    return conversationKeyOf(m, userId) === convKey && parseTs(m.updatedAt ?? m.at) > lastReadTs;
  }).length;
}

/**
 * Tổng unread CHỈ đếm các hội thoại MỞ ĐƯỢC trong UI (fix badge kẹt — 2026-09-10):
 * trước đây đếm trên TẤT CẢ key suy ra từ tin nhắn, bao gồm tin cũ của 4 kênh công
 * khai đã xóa (GĐ 74) + nhóm đã giải tán + tin 1-1 cũ direct_key='' — các hội thoại
 * "ma" này KHÔNG thể mở để đánh dấu đã đọc → badge kẹt vĩnh viễn dù đọc hết.
 * Giờ: nhóm = mình là member của nhóm còn sống; 1-1 = peer còn trong danh sách nhân sự.
 * convKeys PHẢI khớp đúng danh sách hội thoại ở trang Chat (myGroups + direct list).
 */
export function totalUnreadCount(
  messages: ChatMessage[],
  userId: string,
  chatGroups: ChatGroup[] = [],
  employeeIds: Set<string> = new Set(),
): number {
  const lastReadMap = readLastReadMap(userId);
  // Hội thoại nhóm mở được: nhóm chưa xóa + mình là member
  const myGroupIds = new Set(
    chatGroups
      .filter((g) => !g.deletedAt && g.members.some((m) => m.employeeId === userId))
      .map((g) => g.id),
  );
  const convKeys = new Set<string>();
  for (const m of messages) {
    if (m.deletedAt) continue;
    if (m.groupId) {
      if (myGroupIds.has(m.groupId)) convKeys.add(`mygroup:${m.groupId}`);
      continue; // nhóm không còn (đã giải tán / không phải member) → bỏ, không đếm
    }
    if (m.directKey) {
      const peer = m.directKey.split("|").find((id) => id !== userId);
      if (peer && employeeIds.has(peer)) convKeys.add(`direct:${peer}`);
      // peer không còn trong nhân sự → bỏ
      continue;
    }
    // Tin cũ kênh công khai (group:{channel}) — kênh đã xóa GĐ 74, không có UI mở → bỏ
  }
  let total = 0;
  for (const key of convKeys) {
    total += unreadCountFor(messages, key, userId, lastReadMap);
  }
  return total;
}

/** Fire-and-forget Neon sync helpers (imported lazily to avoid SSR issues). */
async function _neonBulkAttendance(rows: Attendance[]) {
  const { bulkInsertAttendance } = await import(
    "@/routes/api/data"
  );
  await bulkInsertAttendance({
    data: {
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        time: r.time,
        date: r.date,
        weekday: r.weekday,
        gps: r.gps,
        address: r.address,
        photo: r.photo,
        type: r.type,
        approved: r.approved,
        workplace: r.workplace,
        updatedAt: (r as any).updatedAt,
      })),
    },
  });
}

async function _neonBulkTasks(rows: Task[]) {
  const { bulkInsertTasks } = await import("@/routes/api/data");
  await bulkInsertTasks({
    data: {
      rows: rows.map((r) => ({
        id: r.id,
        assignee: r.assignee,
        title: r.title,
        created: r.created,
        due: r.due,
        status: r.status,
        support: r.support,
        blocker: r.blocker,
        updated: r.updated,
        createdBy: r.createdBy,
        assigner: r.assigner ?? r.createdBy,
        photo: r.photo,
        location: r.location,
      })),
    },
  });
}

async function _neonBulkMessages(rows: ChatMessage[]) {
  const { bulkInsertMessages } = await import("@/routes/api/data");
  await bulkInsertMessages({
    data: {
      rows: rows.map((r) => ({
        id: r.id,
        from: r.from,
        text: r.text,
        at: r.at,
        channel: r.channel,
      })),
    },
  });
}

async function _neonInsertAttendance(r: Attendance) {
  const { insertAttendance } = await import("@/routes/api/data");
  await insertAttendance({
    data: {
      id: r.id,
      name: r.name,
      status: r.status,
      time: r.time,
      date: r.date,
      weekday: r.weekday,
      gps: r.gps,
      address: r.address,
      photo: r.photo,
      type: r.type,
      approved: r.approved,
      workplace: r.workplace,
      updatedAt: r.updatedAt,
    },
  });
}

async function _neonInsertTask(r: Task) {
  const { insertTask } = await import("@/routes/api/data");
  await insertTask({
    data: {
      id: r.id,
      assignee: r.assignee,
      title: r.title,
      created: r.created,
      due: r.due,
      status: r.status,
      support: r.support,
      blocker: r.blocker,
      updated: r.updated,
      createdBy: r.createdBy,
      assigner: r.assigner ?? r.createdBy,
      photo: r.photo,
      location: r.location,
    },
  });
}

async function _neonInsertNote(r: Note) {
  const { insertNote } = await import("@/routes/api/data");
  await insertNote({
    data: {
      id: r.id,
      stt: String(r.stt ?? ""),
      date: r.date,
      content: r.content,
      author: r.author,
      deploy: r.deploy,
      deadline: r.deadline,
      support: r.support,
      dept: r.dept,
      status: r.status,
      createdBy: r.createdBy ?? "",
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    },
  });
}

async function _neonUpdateNote(id: string, data: Partial<Pick<Note, "content" | "deadline" | "support" | "dept" | "status">> & { updatedAt: string }) {
  const { updateNote } = await import("@/routes/api/data");
  await updateNote({ data: { id, ...data } });
}

async function _neonDeleteNote(id: string, deletedAt: string) {
  const { deleteNote } = await import("@/routes/api/data");
  await deleteNote({ data: { id, deletedAt } });
}

async function _neonInsertProposal(r: Proposal) {
  const { insertProposal } = await import("@/routes/api/data");
  await insertProposal({
    data: {
      id: r.id,
      kind: r.kind,
      title: r.title,
      requester: r.requester,
      date: r.date,
      detail: r.detail,
      status: r.status,
      dept: r.dept,
      approver: r.approver ?? "",
      approvedAt: r.approvedAt,
      createdBy: r.createdBy ?? "",
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      attachments: r.attachments ?? [],
    },
  });
}

async function _neonInsertMessage(r: ChatMessage) {
  const { insertMessage } = await import("@/routes/api/data");
  await insertMessage({
    data: {
      id: r.id,
      from: r.from,
      text: r.text,
      at: r.at,
      channel: r.channel,
      fromId: r.fromId ?? "",
      directKey: r.directKey ?? "",
      attachments: r.attachments ?? [],
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      groupId: r.groupId ?? "",
      mentions: r.mentions ?? [],
      // GĐ 94: meta Zalo đi đầy đủ để tombstone/upsert LWW không mất meta
      reactions: r.reactions ?? [],
      replyToId: r.replyToId ?? "",
      forwardedFrom: r.forwardedFrom ?? "",
      pinned: r.pinned ?? false,
      pinnedBy: r.pinnedBy ?? "",
      starredBy: r.starredBy ?? [],
      deletedBy: r.deletedBy ?? [],
    },
  });
}

async function _neonInsertCheckin(r: CheckIn) {
  const { insertCheckin } = await import("@/routes/api/data");
  await insertCheckin({
    data: {
      id: r.id,
      name: r.name,
      time: r.time,
      date: r.date,
      weekday: r.weekday,
      gps: r.gps,
      address: r.address,
      note: r.note,
      photo: r.photo ?? "",
      video: r.video ?? "",
      centerCode: r.centerCode ?? "VP",
      status: r.status ?? "checked_in",
      updatedAt: r.updatedAt,
    },
  });
}

async function _neonDeleteCheckin(id: string) {
  const { deleteCheckin } = await import("@/routes/api/data");
  await deleteCheckin({ data: { id } });
}

async function _neonUpdateTaskStatus(id: string, status: string, updated: string) {
  const { updateTaskStatus } = await import("@/routes/api/data");
  await updateTaskStatus({ data: { id, status, updated } });
}

async function _neonUpdateTask(id: string, data: { assignee: string; title: string; due: string; support: string; blocker: string; photo?: string; location?: string; updated: string }) {
  const { updateTask } = await import("@/routes/api/data");
  await updateTask({ data: { id, ...data } });
}

async function _neonDeleteTask(id: string, deletedAt?: string) {
  const { deleteTask } = await import("@/routes/api/data");
  await deleteTask({ data: { id, deletedAt } });
}

async function _neonUpdateProposalStatus(id: string, status: string, approver?: string) {
  const { updateProposalStatus } = await import("@/routes/api/data");
  await updateProposalStatus({ data: { id, status, approver } });
}

async function _neonUpdateProposal(id: string, data: Partial<Pick<Proposal, "kind" | "title" | "detail" | "dept" | "attachments">> & { updatedAt: string }) {
  const { updateProposal } = await import("@/routes/api/data");
  await updateProposal({ data: { id, ...data } });
}

async function _neonDeleteProposal(id: string, deletedAt: string) {
  const { deleteProposal } = await import("@/routes/api/data");
  await deleteProposal({ data: { id, deletedAt } });
}

async function _neonInsertDocument(r: Document) {
  const { insertDocument } = await import("@/routes/api/data");
  await insertDocument({
    data: {
      id: r.id,
      title: r.title,
      category: r.category,
      dept: r.dept,
      center: r.center,
      summary: r.summary,
      creator: r.creator,
      createdBy: r.createdBy,
      date: r.date,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      attachments: r.attachments,
    },
  });
}

async function _neonUpdateDocument(id: string, data: Partial<Pick<Document, "title" | "category" | "dept" | "center" | "summary" | "attachments">> & { updatedAt: string }) {
  const { updateDocument } = await import("@/routes/api/data");
  await updateDocument({ data: { id, ...data } });
}

async function _neonDeleteDocument(id: string, deletedAt: string) {
  const { deleteDocument } = await import("@/routes/api/data");
  await deleteDocument({ data: { id, deletedAt } });
}

/**
 * Normalize timestamptz → ISO string: node-postgres (và serializer) trả Date
 * cho cột timestamptz — Date làm hỏng string ops (.localeCompare/.slice) xuống
 * route. GĐ 170: chuyển ra module level vì refreshMessages cũng dùng.
 */
const isoStr = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

export const useAppStore = create<PersistSlice & Actions>((set, get) => ({
  ...initial,

  /* ── OFFLINE-FIRST HYDRATE ──────────────────────────────────────────────────
   * Strategy: localStorage is Source of Truth for display.
   * Neon data is MERGED INTO local — never overwrites.
   */
  hydrate: () => {
    // STEP 1: Load from localStorage IMMEDIATELY — this is the source of truth
    let localAtt: Attendance[] = [];
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const ls = JSON.parse(raw) as PersistSlice;
        localAtt = (ls.attendance ?? []).map((a) => ({
          ...a,
          synced: a.synced ?? true, // older records without field = synced
          updatedAt: (a as any).updatedAt ?? `${a.date}T${a.time}`,
        }));
        set({
          tasks: ls.tasks ?? [],
          attendance: localAtt,
          notes: ls.notes ?? [],
          proposals: ls.proposals ?? [],
          messages: ls.messages ?? [],
          checkins: ls.checkins ?? [],
          currentUserId: ls.currentUserId ?? initial.currentUserId,
          employees: ls.employees?.length ? ls.employees : FALLBACK_EMPLOYEES,
          centers: ls.centers?.length ? ls.centers : FALLBACK_CENTERS,
        });
      }
    } catch { /* ignore parse errors */ }

    // STEP 2: Background — retry pending + fetch Neon + merge INTO local
    (async () => {
      try {
        // 2a: Push unsynced records to Neon
        await retryPendingSync();

        const {
          loadAttendance,
          loadTasks,
          loadProposals,
          loadDocuments,
          loadNotes,
          loadAllMessages,
          loadChatGroups,
          loadCheckins,
          loadDeletedAttendanceIds,
          loadDeletedCheckinIds,
          loadDeletedNoteIds,
          loadDeletedTaskIds,
        } = await import(
          "@/routes/api/data"
        );
        const { loadEmployees: loadEmps, loadCenters: loadCtrs } = await import(
          "@/routes/api/employee-crud"
        );
        // Fetch Neon data. Attendance loads in its OWN try/catch so an error
        // in any other module (tasks/messages/checkins/employees/centers...)
        // never hides attendance from admins — it still merges.
        let att: any[] = [];
        let delAtt: any[] = [];
        try {
          [att, delAtt] = await Promise.all([loadAttendance(), loadDeletedAttendanceIds()]);
        } catch (err) {
          console.error("[store] Neon attendance load failed — keeping local attendance:", err);
        }

        let tsk: any[] = [], prp: any[] = [], nts: any[] = [], msgs: any[] = [], cks: any[] = [], dbEmps: any[] = [], dbCtrs: any[] = [], docs: any[] = [], grpRows: any[] = [];
        try {
          [tsk, prp, nts, msgs, cks, dbEmps, dbCtrs, docs, grpRows] = await Promise.all([
            loadTasks(),
            loadProposals(),
            loadNotes(),
            loadAllMessages(),
            loadCheckins(),
            loadEmps(),
            loadCtrs(),
            loadDocuments(),
            // Nhóm chat (GĐ 72) — load riêng, lỗi không chặn các module khác
            loadChatGroups().catch((e) => {
              console.warn("[store] loadChatGroups failed:", e);
              return [];
            }),
          ]);
        } catch (err) {
          console.error("[store] Neon other-module load failed — attendance still merged:", err);
        }
        // Load deleted checkin IDs separately — this may fail if migration 0014 hasn't run yet
        let delCks: any[] = [];
        try {
          delCks = await loadDeletedCheckinIds();
        } catch {
          // Migration 0014 not applied yet — ignore, no tombstone filtering needed
        }
        // GĐ 91: tombstone ghi chú — load riêng, lỗi migration 0026 chưa chạy không chặn module khác
        let delNts: any[] = [];
        try {
          delNts = await loadDeletedNoteIds();
        } catch {
          // Migration 0026 not applied yet — ignore
        }

        // Map Neon rows → app types (all synced since they came from DB)
        // Normalize timestamptz → ISO string: node-postgres returns Date objects
        // for timestamptz columns (no parser override in db.ts), and Date breaks
        // downstream string ops (.localeCompare/.slice) in routes.
        // (isoStr moved to module level — GĐ 170: refreshMessages cũng dùng)
        const neonAttendance: Attendance[] = (att as any[]).map((r) => ({
          id: r.id, name: r.name, status: r.status, time: r.time,
          date: r.date, weekday: r.weekday, gps: r.gps ?? "",
          address: r.address ?? "", photo: r.photo ?? undefined,
          type: r.type ?? "Bình thường", approved: r.approved ?? "Chưa",
          workplace: r.workplace ?? "VP",
          updatedAt: isoStr(r.updated_at) ?? `${r.date}T${r.time}`,
          synced: true,
        }));

        const neonTasks: Task[] = (tsk as any[]).map((r) => ({
          id: r.id, assignee: r.assignee, title: r.title, created: r.created,
          due: r.due ?? "", status: r.status ?? "Việc cần làm",
          support: r.support ?? "", blocker: r.blocker ?? "",
          updated: r.updated, createdBy: r.created_by ?? "",
          assigner: r.assigner ?? r.created_by ?? "",
          photo: r.photo ?? undefined, location: r.location ?? "",
        }));
        const neonProposals: Proposal[] = (prp as any[])
          .filter((r) => !r.deleted_at) // tombstone — phiếu đã xóa không load
          .map((r) => ({
            id: r.id, kind: r.kind as Proposal["kind"], title: r.title,
            requester: r.requester ?? "", date: r.date, detail: r.detail ?? "",
            status: (r.status ?? "Chờ duyệt") as Proposal["status"], dept: r.dept ?? "",
            approver: r.approver ?? "", approvedAt: isoStr(r.approved_at) ?? undefined,
            createdBy: r.created_by ?? "", updatedAt: isoStr(r.updated_at) ?? undefined,
            deletedAt: isoStr(r.deleted_at) ?? undefined,
            attachments: Array.isArray(r.attachments) ? r.attachments : [],
          }));
        const neonNotes: Note[] = (nts as any[]).map((r) => ({
          id: r.id, stt: r.stt ?? undefined, date: r.date, content: r.content,
          author: r.author ?? "", deploy: r.deploy ?? "", deadline: r.deadline ?? "",
          support: r.support ?? "", dept: r.dept ?? "", status: r.status ?? "",
          createdBy: r.created_by ?? "", updatedAt: isoStr(r.updated_at) ?? undefined,
          deletedAt: isoStr(r.deleted_at) ?? undefined,
        }));
        const neonMessages: ChatMessage[] = (msgs as any[])
          .map((r) => ({
            id: r.id, from: r.from ?? "", text: r.text, at: r.at,
            channel: r.channel ?? "Chung", fromId: r.createdBy ?? "",
            directKey: r.directKey ?? "",
            attachments: Array.isArray(r.attachments) ? r.attachments : [],
            // Fix GĐ 170: rows từ DB là snake_case (updated_at/deleted_at) —
            // camelCase luôn undefined → updatedAt sai = at, tombstone không lọc.
            updatedAt: isoStr(r.updated_at) ?? r.at,
            deletedAt: isoStr(r.deleted_at) ?? undefined,
            groupId: r.groupId ?? "",
            mentions: Array.isArray(r.mentions) ? r.mentions : [],
            // GĐ 94: meta Zalo
            reactions: Array.isArray(r.reactions) ? r.reactions : [],
            replyToId: r.replyToId ?? "",
            forwardedFrom: r.forwardedFrom ?? "",
            pinned: r.pinned ?? false,
            pinnedBy: r.pinnedBy ?? "",
            starredBy: Array.isArray(r.starredBy) ? r.starredBy : [],
            deletedBy: Array.isArray(r.deletedBy) ? r.deletedBy : [],
          }))
          .filter((m) => !m.deletedAt); // tombstone — tin đã thu hồi không load

        // Nhóm chat (GĐ 72) — server đã gộp member rows; lọc tombstone
        const neonGroups: ChatGroup[] = (grpRows as any[])
          .filter((g) => !g.deletedAt)
          .map((g) => ({
            id: g.id, name: g.name, createdBy: g.createdBy ?? "",
            members: Array.isArray(g.members) ? g.members : [],
            updatedAt: isoStr(g.updatedAt) ?? undefined,
            deletedAt: isoStr(g.deletedAt) ?? undefined,
          }));
        const neonDocuments: Document[] = (docs as any[])
          .filter((r) => !r.deleted_at) // tombstone — hồ sơ đã xóa không load
          .map((r) => ({
            id: r.id, title: r.title, category: r.category ?? "Khác",
            dept: r.dept ?? "", center: r.center ?? "", summary: r.summary ?? "",
            creator: r.creator ?? "", createdBy: r.created_by ?? "",
            date: String(r.date).slice(0, 10),
            // Fix TS2322 (2026-09-10): Document.updatedAt bắt buộc string — fallback rỗng thay undefined
            updatedAt: isoStr(r.updated_at) ?? "",
            deletedAt: isoStr(r.deleted_at) ?? undefined,
            attachments: Array.isArray(r.attachments) ? r.attachments : [],
          }));
        const neonCheckins: CheckIn[] = (cks as any[]).map((r) => ({
          id: r.id, name: r.name, time: r.time, date: r.date, weekday: r.weekday,
          gps: r.gps ?? "", address: r.address ?? "", note: r.note ?? "",
          photo: r.photo ?? "", video: r.video ?? "", centerCode: r.center_code ?? "VP",
          // Fix TS2322 (2026-09-10): CheckIn.updatedAt là string | undefined — null không thuộc union
          status: r.status ?? "checked_in", updatedAt: isoStr(r.updated_at) ?? undefined,
        }));

        const dbEmployeeList: Employee[] = (dbEmps as any[]).map((r) => ({
          id: r.id, name: r.name, username: r.username,
          gender: r.gender ?? '', phone: r.phone ?? '', email: r.email ?? '',
          dept: r.department, role: r.role ?? 'User', title: r.title,
          center: r.center, status: r.status,
        }));
        const dbCenterList: Center[] = (dbCtrs as any[]).map((r) => ({
          code: r.code, name: r.name, short: r.short_name, city: r.city,
          kind: (r.code === 'VP' ? 'Văn phòng' : 'Trung tâm') as 'Trung tâm' | 'Văn phòng',
          phone: r.phone ?? '', manager: r.manager ?? '', note: r.note ?? '',
        }));

        const employeeMap = new Map<string, Employee>();
        for (const e of FALLBACK_EMPLOYEES) employeeMap.set(e.id, e);
        for (const e of dbEmployeeList) employeeMap.set(e.id, e);
        // Remove fallback employees that were deleted from DB (inactive)
        const dbEmpIds = new Set(dbEmployeeList.map((e) => e.id));
        const finalEmployees = Array.from(employeeMap.values()).filter(
          (e) => dbEmpIds.has(e.id) || !FALLBACK_EMPLOYEES.some((fe) => fe.id === e.id),
        );
        const centerMap = new Map<string, import("@/lib/types").Center>();
        for (const c of FALLBACK_CENTERS) centerMap.set(c.code, c);
        for (const c of dbCenterList) centerMap.set(c.code, c);
        const finalCenters = Array.from(centerMap.values());

        /* ── OFFLINE-FIRST MERGE: local is source of truth ────────────────────
         * 1. Records still in the pending queue (offline-created) are KEPT from local.
         * 2. Non-pending records use Neon; when a version timestamp exists the
         *    NEWER one wins (LWW by updatedAt).
         * 3. Records tombstoned on Neon (deleted_at) are removed from local.
         */
        const attPendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'attendance' && !r.data._tombstone).map((r) => r.data.id),
        );
        const taskPendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'tasks' && !r.data._tombstone).map((r) => r.data.id),
        );
        const notePendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'notes' && !r.data._tombstone).map((r) => r.data.id),
        );
        const proposalPendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'proposals' && !r.data._tombstone).map((r) => r.data.id),
        );
        const docPendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'documents' && !r.data._tombstone).map((r) => r.data.id),
        );
        const messagePendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'messages' && !r.data._tombstone).map((r) => r.data.id),
        );
        const checkinPendingIds = new Set(
          getPendingSync().filter((r) => r.collection === 'checkins' && !r.data._tombstone).map((r) => r.data.id),
        );
        const deletedAttendanceIds = new Set((delAtt as any[]).map((r) => r.id));
        const deletedNoteIds = new Set((delNts as any[]).map((r) => r.id));
        // GĐ 170: tombstone tasks — lỗi migration 0030 chưa chạy không chặn module khác
        let delTks: any[] = [];
        try {
          delTks = await loadDeletedTaskIds();
        } catch {
          // Migration 0030 not applied yet — ignore
        }
        const deletedTaskIds = new Set((delTks as any[]).map((r) => r.id));

        const mergedAttendance = mergeByTs(
          get().attendance,
          neonAttendance,
          attPendingIds,
          (r) => r.updatedAt ?? `${r.date}T${r.time}`,
        )
          .filter((a) => !deletedAttendanceIds.has(a.id))
          .map((a) => ({ ...a, synced: attPendingIds.has(a.id) ? false : true }))
          .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.time > a.time ? 1 : -1));

        set({
          attendance: mergedAttendance,
          tasks: (() => {
            const merged = mergeByTs(get().tasks, neonTasks, taskPendingIds, (r) => r.updated)
              .filter((t) => !deletedTaskIds.has(t.id)); // GĐ 170: tombstone — task đã xóa biến mất mọi thiết bị
            // GĐ 172 (19/09): DB (GiondDB) là NGUỒN SỰ THẬT tuyệt đối — task local
            // KHÔNG pending mà không tồn tại trên DB bị loại. Nguyên nhân: trước
            // GĐ 170 tasks bị XÓA VẬT LÝ (không tombstone) → bản cũ còn kẹt trong
            // localStorage từng máy → mỗi thiết bị một số khác nhau (3 máy của Đại
            // ca: 75/139 · 81/140 · 70/132 trong khi DB = 222). Neo trên neonTasks
            // (đã LIMIT 1000 — đủ) + tombstone IDs để không cần thêm query.
            const known = new Set<string>([...neonTasks.map((t) => String(t.id)), ...deletedTaskIds]);
            return merged.filter(
              (t) => taskPendingIds.has(t.id) || known.has(String(t.id)),
            );
          })(),
          proposals: mergeByTs(get().proposals, neonProposals, proposalPendingIds, (r) => r.updatedAt ?? "")
            .filter((p) => !p.deletedAt), // tombstone — loại phiếu đã xóa khỏi mọi thiết bị
          documents: mergeByTs(get().documents, neonDocuments, docPendingIds, (r) => r.updatedAt ?? "")
            .filter((d) => !d.deletedAt), // tombstone — hồ sơ đã xóa
          notes: mergeByTs(get().notes, neonNotes, notePendingIds, (r) => r.updatedAt ?? "")
            .filter((n) => {
              // Tombstone GĐ 91: bản ghi bị xóa trên Neon biến mất ở MỌI thiết bị.
              // Dùng updatedAt thay deletedAt làm chuẩn LWW — tombstone có updated_at
              // mới hơn nên thắng merge rồi bị lọc; thiết bị giữ bản cũ cũng nhận
              // updatedAt mới hơn từ Neon → bản ghi tự biến mất đúng cơ chế LWW.
              if (n.deletedAt) return false;
              return !deletedNoteIds.has(n.id);
            }),
          messages: mergeByTs(get().messages, neonMessages, messagePendingIds, (r) => r.updatedAt ?? r.at)
            .filter((m) => !m.deletedAt), // Fix GĐ 170: LWW theo updatedAt (r.at cũ gây meta tombstone thua merge) + lọc tombstone sau merge
          chatGroups: mergeByTs(get().chatGroups, neonGroups, new Set<string>(), (r) => r.updatedAt ?? "")
            .filter((g) => !g.deletedAt),
          checkins: (() => {
            const deletedCheckinIds = new Set((delCks as any[]).map((r) => r.id));
            return mergeByTs(
              get().checkins, neonCheckins, checkinPendingIds,
              (r) => r.updatedAt ?? `${r.date}T${r.time}`,
            )
              .filter((c) => !deletedCheckinIds.has(c.id))
              .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.time > a.time ? 1 : -1));
          })(),
          employees: finalEmployees,
          centers: finalCenters,
          _neonReady: true,
        });
        saveLs(get()); // persist merged result
      } catch (err) {
        console.error('[store] Neon sync failed — keeping local data:', err);
        // DO NOT clear local data — just mark sync as incomplete
        set({ _neonReady: false });
      }

      // Background retry (once only) — GĐ 84: backoff tự thích ứng thay interval 30s
      if (!_bgRetryStarted) {
        _bgRetryStarted = true;
        // Online listener — sync immediately when network returns
        if (typeof window !== 'undefined') {
          window.addEventListener('online', () => {
            console.log('[store] Network online — triggering sync');
            retryPendingSync().then(() => get().hydrate()).catch(() => {});
          });
        }
        scheduleNextRetry();
      }
    })();
  },

  persist: () => {
    saveLs(get());
  },

  setCurrentUserId: (userId) => {
    set({ currentUserId: userId });
    saveLs(get());
  },

  currentName: () => {
    const id = get().currentUserId;
    return get().employees.find((e) => e.id === id)?.name ?? "Phạm Kiên Cường";
  },    addTask: (t) => {
    const now = `${todayIso()} ${nowTime().slice(0, 5)}`;
    const task: Task = { ...t, id: uid("nv"), created: now, updated: now };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    saveLs(get());
    addPendingSync({ collection: "tasks", data: task });
    _neonInsertTask(task)
      .then(() => clearPendingSync([task.id]))
      .catch(console.warn);
  },

  setTaskStatus: (id, status) => {
    const now = `${todayIso()} ${nowTime().slice(0, 5)}`;
    set((s) => ({
      tasks: s.tasks.map((x) => (x.id === id ? { ...x, status, updated: now } : x)),
    }));
    saveLs(get());
    // GĐ 170: queue trước (offline-first — UPDATE fail khi offline không còn mất),
    // thành công mới rút khỏi queue. Pattern clock() GĐ 17.
    const rec = { id, updated: now, status };
    addPendingSync({ collection: "tasks", data: { _tombstoneUpdate: true, id, update: rec } as any });
    _neonUpdateTaskStatus(id, status, now)
      .then(() => clearPendingSync([`${id}:update`]))
      .catch(() => {});
  },

  updateTask: (id, data) => {
    const now = `${todayIso()} ${nowTime().slice(0, 5)}`;
    set((s) => ({
      tasks: s.tasks.map((x) =>
        x.id === id ? { ...x, ...data, updated: now } : x,
      ),
    }));
    saveLs(get());
    // GĐ 170: queue trước như setTaskStatus.
    const rec = { id, updated: now, ...data };
    addPendingSync({ collection: "tasks", data: { _tombstoneUpdate: true, id, update: rec } as any });
    _neonUpdateTask(id, { ...data, updated: now })
      .then(() => clearPendingSync([`${id}:update`]))
      .catch(() => {});
  },

  removeTask: (id) => {
    const deletedAt = new Date().toISOString();
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    saveLs(get());
    // GĐ 170: tombstone + queue — xóa lan truyền mọi thiết bị, offline vẫnretry.
    addPendingSync({ collection: "tasks", data: { id, deletedAt, _tombstone: true } as any });
    _neonDeleteTask(id, deletedAt)
      .then(() => clearPendingSync([id]))
      .catch(() => {});
  },

  clock: (kind, gps = "", address = "", photo = "", employeeName, employeeId, workplace) => {
    // Use passed employee data directly — no more non-reactive snapshot
    const name = employeeName || get().currentName();
    const empId = employeeId || get().currentUserId;
    const emps = get().employees;
    const currentEmployee =
      emps.find((e) => e.id === empId) ?? emps[0] ?? { center: 'VP', title: 'Nhân viên' } as any;
    const date = todayIso();
    // Guard chống trùng lặp: cùng người, cùng ngày, cùng loại trong 5 giây gần nhất
    // → trả về bản ghi đã tạo, KHÔNG tạo thêm (bảo vệ bản chất dữ liệu khi bấm nhiều lần)
    const recent = get().attendance.find(
      (a) =>
        a.name === name &&
        a.date === date &&
        a.status === kind &&
        Date.now() - parseTs(a.updatedAt ?? `${a.date}T${a.time}`) < 5000,
    );
    if (recent) return recent;
    const wp = workplace || currentEmployee.center || "VP";
    const nowTs = new Date().toISOString();
    const rec: Attendance = {
      id: uid("cc"),
      employeeId: empId,
      name,
      status: kind,
      time: nowTime(),
      date,
      weekday: weekdayVi(date),
      gps,
      address: address || `${currentEmployee.title} — ${currentEmployee.center}`,
      photo: photo || undefined,
      type: "Bình thường",
      approved: "Chưa",
      workplace: wp,
      updatedAt: nowTs,
      synced: false, // starts unsynced — will be marked true after Neon insert
    };
    // 1. Save to state + localStorage immediately (local is source of truth)
    set((s) => ({ attendance: [rec, ...s.attendance] }));
    saveLs(get());
    // 2. Add to pending queue for retry
    addPendingSync({ collection: "attendance", data: rec });
    // 3. Fire-and-forget Neon insert
    _neonInsertAttendance(rec).then(() => {
      // Success: mark as synced, remove from pending queue, save
      clearPendingSync([rec.id]);
      const current = get().attendance.map((a) =>
        a.id === rec.id ? { ...a, synced: true } : a
      );
      set({ attendance: current });
      saveLs(get());
    }).catch(() => {
      // Failed: stays in pending queue, will retry on next sync cycle
    });
    return rec;
  },

  removeAttendance: (id) => {
    // Local first (source of truth): remove immediately
    set((s) => ({ attendance: s.attendance.filter((a) => a.id !== id) }));
    saveLs(get());
    clearPendingSync([id]);
    // Tombstone on Neon so other devices remove it too
    import("@/routes/api/data")
      .then(({ deleteAttendance }) => deleteAttendance({ data: { id } }))
      .catch(console.warn);
  },

  addNote: (n) => {
    const note: Note = {
      ...n,
      id: uid("gc"),
      createdBy: n.createdBy || n.author,
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ notes: [note, ...s.notes] }));
    saveLs(get());
    addPendingSync({ collection: "notes", data: note });
    _neonInsertNote(note)
      .then(() => clearPendingSync([note.id]))
      .catch(console.warn);
  },

  // GĐ 91: sửa ghi chú — Admin sửa TẤT CẢ, User sửa ghi chú của mình (UI chặn quyền)
  updateNote: (id, data) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...data, updatedAt } : n,
      ),
    }));
    saveLs(get());
    // GĐ 170: queue trước (offline-first) — thành công mới rút khỏi queue.
    addPendingSync({ collection: "notes", data: { _tombstoneUpdate: true, id, update: { ...data, updatedAt } } as any });
    _neonUpdateNote(id, { ...data, updatedAt })
      .then(() => clearPendingSync([`${id}:update`]))
      .catch(() => {});
  },

  // GĐ 91: xóa ghi chú — CHỈ Admin (UI chặn); tombstone để xóa lan truyền mọi thiết bị
  removeNote: (id) => {
    const deletedAt = new Date().toISOString();
    set((s) => ({
      notes: s.notes.filter((x) => x.id !== id),
    }));
    saveLs(get());
    addPendingSync({ collection: "notes", data: { id, deletedAt, _tombstone: true } as any });
    _neonDeleteNote(id, deletedAt)
      .then(() => clearPendingSync([id]))
      .catch(console.warn);
  },

  addProposal: (p) => {
    const proposal: Proposal = { ...p, id: uid("dn"), updatedAt: new Date().toISOString() };
    set((s) => ({ proposals: [proposal, ...s.proposals] }));
    saveLs(get());
    addPendingSync({ collection: "proposals", data: proposal });
    _neonInsertProposal(proposal)
      .then(() => clearPendingSync([proposal.id]))
      .catch(console.warn);
    // GĐ 100: push badge "đề nghị chờ duyệt" tới các Admin (badge icon cả khi app đóng).
    // Fire-and-forget — lỗi push KHÔNG được ảnh hưởng luồng gửi đề nghị.
    void (async () => {
      try {
        const adminIds = get()
          .employees.filter((e) => e.role === "Admin" || e.role === "SuperAdmin")
          .map((e) => e.id)
          .filter((id) => id !== proposal.createdBy);
        if (adminIds.length === 0) return;
        const { sendPushBadge } = await import("@/routes/api/push");
        await sendPushBadge({
          data: {
            employeeIds: adminIds,
            unreadTotal: 1, // server chỉ cần > 0 để hiện notification — badge chính xác tự cập nhật khi mở app
            kind: "proposal",
            title: "Đề nghị mới chờ duyệt",
            body: `${proposal.requester}: ${proposal.title}`.slice(0, 120),
            url: "/de-nghi",
          },
        });
      } catch {
        // push fail im lặng — badge trong app vẫn hoạt động
      }
    })();
  },

  setProposalStatus: (id, status, approver) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      proposals: s.proposals.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              approver: status === "Chờ duyệt" ? "" : (approver ?? x.approver ?? ""),
              approvedAt: status === "Chờ duyệt" ? undefined : new Date().toISOString(),
              updatedAt,
            }
          : x,
      ),
    }));
    saveLs(get());
    // GĐ 170: duyệt/từ chối/mở lại cũng phải sống sót offline — queue như updateProposal.
    addPendingSync({ collection: "proposals", data: { _tombstoneUpdate: true, id, update: { status, approver, updatedAt } } as any });
    _neonUpdateProposalStatus(id, status, approver)
      .then(() => clearPendingSync([`${id}:update`]))
      .catch(() => {});
  },

  updateProposal: (id, data) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      proposals: s.proposals.map((x) =>
        x.id === id ? { ...x, ...data, updatedAt } : x,
      ),
    }));
    saveLs(get());
    // GĐ 170: queue trước (offline-first) — thành công mới rút khỏi queue.
    addPendingSync({ collection: "proposals", data: { _tombstoneUpdate: true, id, update: { ...data, updatedAt } } as any });
    _neonUpdateProposal(id, { ...data, updatedAt })
      .then(() => clearPendingSync([`${id}:update`]))
      .catch(() => {});
  },

  removeProposal: (id) => {
    const deletedAt = new Date().toISOString();
    set((s) => ({
      proposals: s.proposals.filter((x) => x.id !== id),
    }));
    saveLs(get());
    addPendingSync({ collection: "proposals", data: { id, deletedAt, _tombstone: true } as any });
    _neonDeleteProposal(id, deletedAt)
      .then(() => clearPendingSync([id]))
      .catch(console.warn);
  },

  sendMessage: (text, channel, opts) => {
    const me = get().employees.find((e) => e.id === get().currentUserId);
    const directKey = opts?.toId
      ? [get().currentUserId, opts.toId].sort().join("|")
      : "";
    const now = new Date();
    const msg: ChatMessage = {
      id: uid("m"),
      from: me?.username ?? "CườngPK",
      text,
      at: `${todayIso()} ${nowTime().slice(0, 5)}`,
      channel,
      fromId: get().currentUserId,
      directKey,
      attachments: opts?.attachments ?? [],
      groupId: opts?.groupId ?? "",
      mentions: opts?.mentions ?? [],
      // GĐ 94: trả lời + chuyển tiếp
      replyToId: opts?.replyToId ?? "",
      forwardedFrom: opts?.forwardedFrom ?? "",
      updatedAt: now.toISOString(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    saveLs(get());
    addPendingSync({ collection: "messages", data: msg });
    _neonInsertMessage(msg)
      .then(() => clearPendingSync([msg.id]))
      .catch(console.warn);
    // GĐ 100: push badge "tin chat mới" tới người nhận (1-1 hoặc nhóm).
    // Fire-and-forget — lỗi push KHÔNG được ảnh hưởng luồng gửi tin.
    void (async () => {
      try {
        let recipientIds: string[] = [];
        if (msg.groupId) {
          const grp = get().chatGroups.find((g) => g.id === msg.groupId);
          recipientIds = (grp?.members ?? [])
            .map((m) => m.employeeId)
            .filter((id) => id && id !== msg.fromId);
        } else if (opts?.toId) {
          recipientIds = [opts.toId];
        }
        if (recipientIds.length === 0) return;
        const { sendPushBadge } = await import("@/routes/api/push");
        await sendPushBadge({
          data: {
            employeeIds: recipientIds,
            unreadTotal: 1, // > 0 để hiện notification — badge chính xác tự cập nhật khi mở app
            kind: "chat",
            title: `${me?.name ?? "Tin nhắn mới"} — Chat`,
            body: text.slice(0, 120),
            url: "/chat",
          },
        });
      } catch {
        // push fail im lặng — badge trong app vẫn hoạt động
      }
    })();
  },

  /** GĐ 94: đổi meta tin nhắn (reaction/ghim/đánh dấu/xóa phía tôi) — optimistic + LWW Neon. */
  updateMessageMeta: (id, meta) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...meta, updatedAt } : m,
      ),
    }));
    saveLs(get());
    // GĐ 170: queue trước (offline-first) — reaction/ghim/⭐ offline vẫn retry.
    addPendingSync({ collection: "messages", data: { _tombstoneMeta: true, id, meta: { id, ...meta, updatedAt } } as any });
    import("@/routes/api/data")
      .then(({ updateMessageMeta }) => updateMessageMeta({ data: { id, ...meta, updatedAt } }))
      .then(() => clearPendingSync([`${id}:meta`]))
      .catch(() => {});
  },

  /** Poll tin mới từ Neon (mỗi 5s khi mở trang Chat) — merge vào store, không ghi đè pending. */
  refreshMessages: async () => {
    try {
      const lastAt = get().messages.reduce(
        (max, m) => (m.at > max ? m.at : max),
        "",
      );
      const { loadMessagesSince, loadChatGroups } = await import(
        "@/routes/api/data"
      );
      const rows = (await loadMessagesSince({ data: { since: lastAt } })) as any[];
      const incoming: ChatMessage[] = rows
        .map((r) => ({
          id: r.id, from: r.from ?? "", text: r.text, at: r.at,
          channel: r.channel ?? "Chung", fromId: r.createdBy ?? "",
          directKey: r.directKey ?? "",
          attachments: Array.isArray(r.attachments) ? r.attachments : [],
          // Fix GĐ 170: rows DB là snake_case (updated_at/deleted_at) — camelCase undefined.
          updatedAt: isoStr(r.updated_at) ?? r.at,
          deletedAt: isoStr(r.deleted_at) ?? undefined,
          groupId: r.groupId ?? "",
          mentions: Array.isArray(r.mentions) ? r.mentions : [],
          // GĐ 94: meta Zalo — reaction/pin/star/delete-for-me từ thiết bị khác
          reactions: Array.isArray(r.reactions) ? r.reactions : [],
          replyToId: r.replyToId ?? "",
          forwardedFrom: r.forwardedFrom ?? "",
          pinned: r.pinned ?? false,
          pinnedBy: r.pinnedBy ?? "",
          starredBy: Array.isArray(r.starredBy) ? r.starredBy : [],
          deletedBy: Array.isArray(r.deletedBy) ? r.deletedBy : [],
        }))
        .filter((m) => !m.deletedAt);
      if (incoming.length === 0) return;
      // Gộp theo id — tin mới từ thiết bị khác, không đụng tin pending của máy này
      const pendingIds = new Set(
        getPendingSync().filter((r) => r.collection === "messages").map((r) => r.data.id),
      );
      const merged = mergeByTs(get().messages, incoming, pendingIds, (r) => r.updatedAt ?? r.at);
      merged.sort((a, b) => (a.at > b.at ? 1 : a.at < b.at ? -1 : a.id > b.id ? 1 : -1));
      set({ messages: merged });
      saveLs(get());

      // GĐ 72: nhóm mới/thay đổi member cũng tự về — poll cùng nhịp 5s.
      // Lỗi nhóm không chặn tin nhắn (đã set phía trên).
      try {
        const grpRows = (await loadChatGroups()) as any[];
        const neonGroups: ChatGroup[] = grpRows
          .filter((g) => !g.deletedAt)
          .map((g) => ({
            id: g.id, name: g.name, createdBy: g.createdBy ?? "",
            members: Array.isArray(g.members) ? g.members : [],
            updatedAt: typeof g.updatedAt === "string" ? g.updatedAt : undefined,
            deletedAt: g.deletedAt ?? undefined,
          }));
        set((s) => ({
          chatGroups: mergeByTs(s.chatGroups, neonGroups, new Set<string>(), (r) => r.updatedAt ?? "")
            .filter((g) => !g.deletedAt),
        }));
        saveLs(get());
      } catch (err) {
        console.warn("[store] refresh chatGroups failed:", err);
      }
    } catch (err) {
      console.warn("[store] refreshMessages failed:", err);
    }
  },

  /** Thu hồi tin nhắn — tombstone lan truyền mọi thiết bị. */
  removeMessage: (id) => {
    const deletedAt = new Date().toISOString();
    const target = get().messages.find((m) => m.id === id);
    if (!target) return;
    const tombstoned: ChatMessage = { ...target, deletedAt, updatedAt: deletedAt };
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? tombstoned : m,
      ),
    }));
    saveLs(get());
    addPendingSync({ collection: "messages", data: tombstoned });
    _neonInsertMessage(tombstoned)
      .then(() => clearPendingSync([id]))
      .catch(console.warn);
    deleteMessage({ data: { id, deletedAt } })
      .then(() => clearPendingSync([id]))
      .catch(console.warn);
  },

  /** Tạo nhóm mới (GĐ 72 — chỉ Admin gọi từ UI). Owner = người tạo. */
  addChatGroup: (name, memberIds) => {
    const id = uid("cg");
    const now = new Date().toISOString();
    const group: ChatGroup = {
      id,
      name,
      createdBy: get().currentUserId,
      members: [
        { employeeId: get().currentUserId, role: "owner" },
        ...memberIds
          .filter((m) => m !== get().currentUserId)
          .map((employeeId) => ({ employeeId, role: "member" as const })),
      ],
      updatedAt: now,
    };
    set((s) => ({ chatGroups: [...s.chatGroups, group] }));
    saveLs(get());
    (async () => {
      const { createChatGroup } = await import("@/routes/api/data");
      await createChatGroup({
        data: { id, name, createdBy: group.createdBy, memberIds },
      });
    })().catch(console.warn);
  },

  /** Thêm thành viên vào nhóm (Owner/Admin). */
  addChatGroupMembers: (groupId, employeeIds) => {
    if (employeeIds.length === 0) return;
    set((s) => ({
      chatGroups: s.chatGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              members: [
                ...g.members,
                ...employeeIds
                  .filter((id) => !g.members.some((m) => m.employeeId === id))
                  .map((employeeId) => ({ employeeId, role: "member" as const })),
              ],
              updatedAt: new Date().toISOString(),
            }
          : g,
      ),
    }));
    saveLs(get());
    (async () => {
      const { addChatGroupMembers } = await import("@/routes/api/data");
      await addChatGroupMembers({ data: { groupId, employeeIds } });
    })().catch(console.warn);
  },

  /** Đổi tên nhóm (GĐ 77 — Owner/Admin). LWW: updated_at mới → poll thiết bị khác tự cập nhật tên. */
  renameChatGroup: (groupId, name) => {
    const now = new Date().toISOString();
    set((s) => ({
      chatGroups: s.chatGroups.map((g) =>
        g.id === groupId ? { ...g, name, updatedAt: now } : g,
      ),
    }));
    saveLs(get());
    (async () => {
      const { renameChatGroup } = await import("@/routes/api/data");
      await renameChatGroup({ data: { groupId, name } });
    })().catch(console.warn);
  },

  /** Xóa thành viên khỏi nhóm (Owner/Admin; owner không bị xóa — server chặn). */
  removeChatGroupMember: (groupId, employeeId) => {
    set((s) => ({
      chatGroups: s.chatGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              members: g.members.filter((m) => m.employeeId !== employeeId || m.role === "owner"),
              updatedAt: new Date().toISOString(),
            }
          : g,
      ),
    }));
    saveLs(get());
    (async () => {
      const { removeChatGroupMember } = await import("@/routes/api/data");
      await removeChatGroupMember({ data: { groupId, employeeId } });
    })().catch(console.warn);
  },

  /** Giải tán nhóm (Owner/Admin) — tombstone, tin nhắn giữ nguyên trong DB. */
  removeChatGroup: (groupId) => {
    const deletedAt = new Date().toISOString();
    set((s) => ({
      chatGroups: s.chatGroups.map((g) =>
        g.id === groupId ? { ...g, deletedAt, updatedAt: deletedAt } : g,
      ),
    }));
    saveLs(get());
    (async () => {
      const { deleteChatGroup } = await import("@/routes/api/data");
      await deleteChatGroup({ data: { groupId, deletedAt } });
    })().catch(console.warn);
  },

  /** GĐ 74: đánh dấu đã đọc hội thoại — lưu lastReadAt vào localStorage per-user.
   *  Badge unread = số tin của người KHÁC mới hơn lastReadAt. */
  markConversationRead: (convKey) => {
    try {
      const uidKey = `giong-vn-chat-read-${get().currentUserId}`;
      const raw = localStorage.getItem(uidKey);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[convKey] = new Date().toISOString();
      localStorage.setItem(uidKey, JSON.stringify(map));
    } catch {
      /* quota */
    }
    // Bump để badge re-render ngay (state riêng, không nằm trong PersistSlice)
    set((s) => ({ _chatReadTick: (s as any)._chatReadTick ? (s as any)._chatReadTick + 1 : 1 } as any));
  },

  addCheckin: (gps = "", address = "", note = "", photo = "", centerCode = "VP", video = "") => {
    const date = todayIso();
    const ts = new Date().toISOString();
    const rec: CheckIn = {
      id: uid("ck"),
      name: get().currentName(),
      time: nowTime(),
      date,
      weekday: weekdayVi(date),
      gps,
      address,
      note,
      photo,
      video, // GĐ 102: video quay có đóng dấu — song song với photo
      centerCode,
      status: "checked_in",
      updatedAt: ts,
    };
    set((s) => ({ checkins: [rec, ...s.checkins] }));
    saveLs(get());
    addPendingSync({ collection: "checkins", data: rec });
    _neonInsertCheckin(rec)
      .then(() => clearPendingSync([rec.id]))
      .catch(console.warn);
    return rec;
  },

  removeCheckin: (id: string) => {
    const deletedAt = new Date().toISOString();
    set((s) => ({ checkins: s.checkins.filter((c) => c.id !== id) }));
    saveLs(get());
    // GĐ 170: tombstone + queue — xóa lan truyền mọi thiết bị, offline vẫn retry
    // (trước đây fire-and-forget — offline là mất). Pattern removeProposal GĐ 59.
    addPendingSync({ collection: "checkins", data: { id, deletedAt, _tombstone: true } as any });
    _neonDeleteCheckin(id)
      .then(() => clearPendingSync([id]))
      .catch(() => {});
  },

  /* ── Documents (Hồ sơ tài liệu — GĐ 66) ─────────────────────────────── */

  addDocument: (d) => {
    const doc: Document = { ...d, id: uid("hs"), updatedAt: new Date().toISOString() };
    set((s) => ({ documents: [doc, ...s.documents] }));
    saveLs(get());
    addPendingSync({ collection: "documents", data: doc });
    _neonInsertDocument(doc)
      .then(() => clearPendingSync([doc.id]))
      .catch(console.warn);
  },

  updateDocument: (id, data) => {
    const updatedAt = new Date().toISOString();
    set((s) => ({
      documents: s.documents.map((x) => (x.id === id ? { ...x, ...data, updatedAt } : x)),
    }));
    saveLs(get());
    _neonUpdateDocument(id, { ...data, updatedAt }).catch(console.warn);
  },

  removeDocument: (id) => {
    const deletedAt = new Date().toISOString();
    set((s) => ({ documents: s.documents.filter((x) => x.id !== id) }));
    saveLs(get());
    addPendingSync({ collection: "documents", data: { id, deletedAt, _tombstone: true } as any });
    _neonDeleteDocument(id, deletedAt)
      .then(() => clearPendingSync([id]))
      .catch(console.warn);
  },
}));
