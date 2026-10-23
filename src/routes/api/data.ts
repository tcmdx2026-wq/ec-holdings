/**
 * Server functions for all application data CRUD operations.
 * Replaces localStorage with Neon PostgreSQL.
 */
import { getSql } from "@/lib/db";
import { createServerFn } from "@tanstack/react-start";

/* ─────────────────── Attendance ─────────────────── */

export const loadAttendance = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{
      id: string;
      name: string;
      status: string;
      time: string;
      date: string;
      weekday: string;
      gps: string;
      address: string;
      photo: string | null;
      type: string;
      approved: string;
      workplace: string;
      updated_at: string | null;
      deleted_at: string | null;
    }>`SELECT * FROM attendance WHERE deleted_at IS NULL ORDER BY date DESC, time DESC LIMIT 1000`;
  });

export const insertAttendance = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      name: string;
      status: string;
      time: string;
      date: string;
      weekday: string;
      gps?: string;
      address?: string;
      photo?: string;
      type?: string;
      approved?: string;
      workplace?: string;
      updatedAt?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const ts = data.updatedAt ? new Date(data.updatedAt) : new Date();
    await sql`
      INSERT INTO attendance (id, name, status, time, date, weekday, gps, address, photo, type, approved, workplace, updated_at)
      VALUES (${data.id}, ${data.name}, ${data.status}, ${data.time}, ${data.date}, ${data.weekday},
              ${data.gps ?? ""}, ${data.address ?? ""}, ${data.photo ?? null},
              ${data.type ?? "Bình thường"}, ${data.approved ?? "Chưa"}, ${data.workplace ?? "VP"}, ${ts})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, status = EXCLUDED.status, time = EXCLUDED.time,
        date = EXCLUDED.date, weekday = EXCLUDED.weekday, gps = EXCLUDED.gps,
        address = EXCLUDED.address, photo = EXCLUDED.photo, workplace = EXCLUDED.workplace,
        updated_at = EXCLUDED.updated_at
      WHERE attendance.updated_at < EXCLUDED.updated_at
    `;
  });

export const bulkInsertAttendance = createServerFn({ method: "POST" })
  .validator(
    (data: {
      rows: Array<{
        id: string;
        name: string;
        status: string;
        time: string;
        date: string;
        weekday: string;
        gps?: string;
        address?: string;
        photo?: string;
        type?: string;
        approved?: string;
        workplace?: string;
        updatedAt?: string;
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    for (const r of data.rows) {
      const ts = r.updatedAt ? new Date(r.updatedAt) : new Date();
      await sql`
        INSERT INTO attendance (id, name, status, time, date, weekday, gps, address, photo, type, approved, workplace, updated_at)
        VALUES (${r.id}, ${r.name}, ${r.status}, ${r.time}, ${r.date}, ${r.weekday},
                ${r.gps ?? ""}, ${r.address ?? ""}, ${r.photo ?? null},
                ${r.type ?? "Bình thường"}, ${r.approved ?? "Chưa"}, ${r.workplace ?? "VP"}, ${ts})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, status = EXCLUDED.status, time = EXCLUDED.time,
          date = EXCLUDED.date, weekday = EXCLUDED.weekday, gps = EXCLUDED.gps,
          address = EXCLUDED.address, photo = EXCLUDED.photo, workplace = EXCLUDED.workplace,
          updated_at = EXCLUDED.updated_at
        WHERE attendance.updated_at < EXCLUDED.updated_at
      `;
    }
  });

export const deleteAttendance = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Tombstone — soft delete so other devices can sync the removal
    await sql`UPDATE attendance SET deleted_at = now() WHERE id = ${data.id}`;
  });

export const loadDeletedAttendanceIds = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{ id: string }>`SELECT id FROM attendance WHERE deleted_at IS NOT NULL`;
  });

/* ─────────────────── Tasks ─────────────────── */

export const loadTasks = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    // GĐ 172 (19/09): LIMIT 200 → 1000 — DB đã 222 tasks nhưng chỉ trả 200 gần
    // nhất → các thiết bị thấy thiếu lệch nhau (số Nhiệm vụ trên Dashboard 3 máy
    // không khớp). 1000 là trần an toàn cho nhiều năm; tasks thuộc bảng nhẹ
    // (mỗi dòng ~0.5KB) nên 1000 dòng vẫn nhẹ hơn 1 ảnh check-in.
    // Fallback nếu cột assigner chưa có (migration 0016 chưa chạy)
    return sql<{
      id: string;
      assignee: string;
      title: string;
      created: string;
      due: string;
      status: string;
      support: string;
      blocker: string;
      updated: string;
      created_by: string;
      assigner: string;
      photo: string | null;
      location: string;
    }>`SELECT *, created_by as "createdBy", COALESCE(assigner, created_by) as "assigner" FROM tasks WHERE deleted_at IS NULL ORDER BY created DESC LIMIT 1000`
      .catch(() => sql<{
        id: string;
        assignee: string;
        title: string;
        created: string;
        due: string;
        status: string;
        support: string;
        blocker: string;
        updated: string;
        created_by: string;
        assigner: string;
        photo: string | null;
        location: string;
      }>`SELECT *, created_by as "createdBy", '' as "assigner" FROM tasks ORDER BY created DESC LIMIT 1000`);
  });

/** GĐ 170: danh sách task đã xóa (tombstone) — hydrate filter bỏ ở mọi thiết bị. */
export const loadDeletedTaskIds = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{ id: string }>`SELECT id FROM tasks WHERE deleted_at IS NOT NULL`;
  });

export const insertTask = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      assignee: string;
      title: string;
      created: string;
      due?: string;
      status?: string;
      support?: string;
      blocker?: string;
      updated: string;
      createdBy?: string;
      assigner?: string;
      photo?: string;
      location?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    // GĐ 170: UPSERT LWW theo `updated` (pattern attendance GĐ 17) — thiết bị khác
    // sửa/cập nhật trạng thái task thì thiết bị này retry queue không ghi đè ngược.
    await sql`
      INSERT INTO tasks (id, assignee, title, created, due, status, support, blocker, updated, created_by, assigner, photo, location)
      VALUES (${data.id}, ${data.assignee}, ${data.title}, ${data.created},
              ${data.due ?? ""}, ${data.status ?? "Việc cần làm"},
              ${data.support ?? ""}, ${data.blocker ?? ""}, ${data.updated},
              ${data.createdBy ?? ""}, ${data.assigner ?? data.createdBy ?? ""}, ${data.photo ?? null}, ${data.location ?? ""})
      ON CONFLICT (id) DO UPDATE SET
        assignee = EXCLUDED.assignee, title = EXCLUDED.title, due = EXCLUDED.due,
        status = EXCLUDED.status, support = EXCLUDED.support, blocker = EXCLUDED.blocker,
        updated = EXCLUDED.updated, photo = EXCLUDED.photo, location = EXCLUDED.location
      WHERE tasks.updated < EXCLUDED.updated
    `;
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: string; updated: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE tasks SET status = ${data.status}, updated = ${data.updated} WHERE id = ${data.id}`;
  });

export const updateTask = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      assignee: string;
      title: string;
      due: string;
      support: string;
      blocker: string;
      photo?: string;
      location?: string;
      updated: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE tasks SET
      assignee = ${data.assignee},
      title = ${data.title},
      due = ${data.due},
      support = ${data.support},
      blocker = ${data.blocker},
      photo = ${data.photo ?? null},
      location = ${data.location ?? null},
      updated = ${data.updated}
      WHERE id = ${data.id}`;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .validator((data: { id: string; deletedAt?: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // GĐ 170: tombstone (soft delete) thay DELETE vật lý — xóa lan truyền mọi
    // thiết bị qua hydrate LWW + retry queue. Pattern deleteAttendance GĐ 17.
    await sql`UPDATE tasks SET deleted_at = ${data.deletedAt ? new Date(data.deletedAt) : new Date()} WHERE id = ${data.id}`;
  });

export const bulkInsertTasks = createServerFn({ method: "POST" })
  .validator(
    (data: {
      rows: Array<{
        id: string;
        assignee: string;
        title: string;
        created: string;
        due?: string;
        status?: string;
        support?: string;
        blocker?: string;
        updated: string;
        createdBy?: string;
        assigner?: string;
        photo?: string;
        location?: string;
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    for (const r of data.rows) {
      await sql`
        INSERT INTO tasks (id, assignee, title, created, due, status, support, blocker, updated, created_by, assigner, photo, location)
        VALUES (${r.id}, ${r.assignee}, ${r.title}, ${r.created},
                ${r.due ?? ""}, ${r.status ?? "Việc cần làm"},
                ${r.support ?? ""}, ${r.blocker ?? ""}, ${r.updated},
                ${r.createdBy ?? ""}, ${r.assigner ?? r.createdBy ?? ""}, ${r.photo ?? null}, ${r.location ?? ""})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  });/* ─────────────────── Proposals ─────────────────── */

export const loadProposals = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{
      id: string;
      kind: string;
      title: string;
      requester: string;
      date: string;
      detail: string;
      status: string;
      dept: string;
      approver: string | null;
      approved_at: string | null;
      created_by: string | null;
      updated_at: string | null;
      deleted_at: string | null;
      // Fix TS2345 (2026-09-10): unknown không qua serializer — pg trả jsonb thành mảng giá trị
      attachments: string[] | null;
    }>`
      SELECT id, kind, title, requester, date, detail, status, dept,
             approver, approved_at, created_by, updated_at, deleted_at, attachments
      FROM proposals
      ORDER BY date DESC, created_at DESC
      LIMIT 500
    `;
  });

export const insertProposal = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      kind: string;
      title: string;
      requester?: string;
      date: string;
      detail?: string;
      status?: string;
      dept?: string;
      approver?: string;
      approvedAt?: string;
      createdBy?: string;
      updatedAt?: string;
      deletedAt?: string;
      attachments?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      INSERT INTO proposals (id, kind, title, requester, date, detail, status, dept,
                             approver, approved_at, created_by, updated_at, deleted_at, attachments)
      VALUES (${data.id}, ${data.kind}, ${data.title}, ${data.requester ?? ""},
              ${data.date}, ${data.detail ?? ""}, ${data.status ?? "Chờ duyệt"},
              ${data.dept ?? ""}, ${data.approver ?? ""},
              ${data.approvedAt ? new Date(data.approvedAt) : null},
              ${data.createdBy ?? ""},
              ${data.updatedAt ? new Date(data.updatedAt) : new Date()},
              ${data.deletedAt ? new Date(data.deletedAt) : null},
              ${JSON.stringify(data.attachments ?? [])}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        title = EXCLUDED.title,
        requester = EXCLUDED.requester,
        date = EXCLUDED.date,
        detail = EXCLUDED.detail,
        status = EXCLUDED.status,
        dept = EXCLUDED.dept,
        approver = EXCLUDED.approver,
        approved_at = EXCLUDED.approved_at,
        created_by = EXCLUDED.created_by,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        attachments = EXCLUDED.attachments
      WHERE proposals.updated_at < EXCLUDED.updated_at
    `;
  });

export const updateProposal = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      kind?: string;
      title?: string;
      detail?: string;
      dept?: string;
      attachments?: string[];
      updatedAt: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE proposals SET
        kind = COALESCE(${data.kind ?? null}, kind),
        title = COALESCE(${data.title ?? null}, title),
        detail = COALESCE(${data.detail ?? null}, detail),
        dept = COALESCE(${data.dept ?? null}, dept),
        attachments = COALESCE(${data.attachments ? JSON.stringify(data.attachments) : null}::jsonb, attachments),
        updated_at = ${new Date(data.updatedAt)}
      WHERE id = ${data.id} AND updated_at < ${new Date(data.updatedAt)}
    `;
  });

export const updateProposalStatus = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: string; approver?: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE proposals SET
        status = ${data.status},
        approver = ${data.approver ?? ""},
        approved_at = ${data.status === "Chờ duyệt" ? null : new Date()},
        updated_at = now()
      WHERE id = ${data.id}
    `;
  });

export const deleteProposal = createServerFn({ method: "POST" })
  .validator((data: { id: string; deletedAt: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Tombstone — soft delete để xóa lan truyền mọi thiết bị (pattern attendance GĐ 17)
    await sql`UPDATE proposals SET deleted_at = ${new Date(data.deletedAt)}, updated_at = ${new Date(data.deletedAt)} WHERE id = ${data.id}`;
  });

/* ─────────────────── Documents (Hồ sơ tài liệu — GĐ 66) ─────────────────── */

export const loadDocuments = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{
      id: string;
      title: string;
      category: string;
      dept: string;
      center: string;
      summary: string;
      creator: string;
      created_by: string | null;
      date: string;
      updated_at: string | null;
      deleted_at: string | null;
      // Fix TS2345 (2026-09-10): unknown không qua serializer — pg trả jsonb thành mảng giá trị
      attachments: string[] | null;
    }>`
      SELECT id, title, category, dept, center, summary, creator,
             created_by, date, updated_at, deleted_at, attachments
      FROM documents
      ORDER BY date DESC, created_at DESC
      LIMIT 500
    `;
  });

export const insertDocument = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      title: string;
      category?: string;
      dept?: string;
      center?: string;
      summary?: string;
      creator?: string;
      createdBy?: string;
      date: string;
      updatedAt?: string;
      deletedAt?: string;
      attachments?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      INSERT INTO documents (id, title, category, dept, center, summary, creator,
                             created_by, date, updated_at, deleted_at, attachments)
      VALUES (${data.id}, ${data.title}, ${data.category ?? "Khác"}, ${data.dept ?? ""},
              ${data.center ?? ""}, ${data.summary ?? ""}, ${data.creator ?? ""},
              ${data.createdBy ?? ""}, ${data.date},
              ${data.updatedAt ? new Date(data.updatedAt) : new Date()},
              ${data.deletedAt ? new Date(data.deletedAt) : null},
              ${JSON.stringify(data.attachments ?? [])}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        dept = EXCLUDED.dept,
        center = EXCLUDED.center,
        summary = EXCLUDED.summary,
        creator = EXCLUDED.creator,
        created_by = EXCLUDED.created_by,
        date = EXCLUDED.date,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        attachments = EXCLUDED.attachments
      WHERE documents.updated_at < EXCLUDED.updated_at
    `;
  });

export const updateDocument = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      title?: string;
      category?: string;
      dept?: string;
      center?: string;
      summary?: string;
      attachments?: string[];
      updatedAt: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE documents SET
        title = COALESCE(${data.title ?? null}, title),
        category = COALESCE(${data.category ?? null}, category),
        dept = COALESCE(${data.dept ?? null}, dept),
        center = COALESCE(${data.center ?? null}, center),
        summary = COALESCE(${data.summary ?? null}, summary),
        attachments = COALESCE(${data.attachments ? JSON.stringify(data.attachments) : null}::jsonb, attachments),
        updated_at = ${new Date(data.updatedAt)}
      WHERE id = ${data.id} AND updated_at < ${new Date(data.updatedAt)}
    `;
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string; deletedAt: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // Tombstone — soft delete lan truyền mọi thiết bị
    await sql`UPDATE documents SET deleted_at = ${new Date(data.deletedAt)}, updated_at = ${new Date(data.deletedAt)} WHERE id = ${data.id}`;
  });

/* ─────────────────── Notes ─────────────────── */

export const loadNotes = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{
      id: string;
      stt: string | null;
      date: string;
      content: string;
      author: string;
      deploy: string;
      deadline: string;
      support: string;
      dept: string;
      status: string;
      created_by: string | null;
      updated_at: string | null;
    }>`SELECT * FROM notes ORDER BY date DESC, created_at DESC LIMIT 500`;
  });

export const insertNote = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      stt?: string;
      date: string;
      content: string;
      author?: string;
      deploy?: string;
      deadline?: string;
      support?: string;
      dept?: string;
      status?: string;
      createdBy?: string;
      updatedAt?: string;
      deletedAt?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    // UPSERT LWW (pattern proposals GĐ 59) — retry offline không bị trùng, bản mới thắng.
    // deleted_at được preserve để tombstone (removeNote offline) retry không "hồi sinh".
    await sql`
      INSERT INTO notes (id, stt, date, content, author, deploy, deadline, support, dept, status, created_by, updated_at, deleted_at)
      VALUES (${data.id}, ${data.stt ?? null}, ${data.date}, ${data.content},
              ${data.author ?? ""}, ${data.deploy ?? ""}, ${data.deadline ?? ""},
              ${data.support ?? ""}, ${data.dept ?? ""}, ${data.status ?? ""},
              ${data.createdBy ?? ""}, ${data.updatedAt ? new Date(data.updatedAt) : null},
              ${data.deletedAt ? new Date(data.deletedAt) : null})
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        author = EXCLUDED.author,
        deadline = EXCLUDED.deadline,
        support = EXCLUDED.support,
        dept = EXCLUDED.dept,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        deleted_at = COALESCE(EXCLUDED.deleted_at, notes.deleted_at)
      WHERE notes.updated_at < EXCLUDED.updated_at
    `;
  });

/** Sửa ghi chú (Admin: tất cả; User: ghi chú của mình) — LWW guard phía DB. */
export const updateNote = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      content?: string;
      deadline?: string;
      support?: string;
      dept?: string;
      status?: string;
      updatedAt: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE notes SET
        content = COALESCE(${data.content ?? null}, content),
        deadline = COALESCE(${data.deadline ?? null}, deadline),
        support = COALESCE(${data.support ?? null}, support),
        dept = COALESCE(${data.dept ?? null}, dept),
        status = COALESCE(${data.status ?? null}, status),
        updated_at = ${new Date(data.updatedAt)}
      WHERE id = ${data.id} AND updated_at < ${new Date(data.updatedAt)}
    `;
  });

/** Xóa ghi chú — TOMBSTONE soft delete để xóa lan truyền mọi thiết bị (chỉ Admin). */
export const deleteNote = createServerFn({ method: "POST" })
  .validator((data: { id: string; deletedAt: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE notes SET deleted_at = ${new Date(data.deletedAt)}, updated_at = ${new Date(data.deletedAt)} WHERE id = ${data.id}`;
  });

/** Danh sách ghi chú đã xóa — hydrate lọc tombstone khỏi mọi thiết bị (pattern attendance GĐ 17). */
export const loadDeletedNoteIds = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{ id: string }>`SELECT id FROM notes WHERE deleted_at IS NOT NULL`;
  });

/* ─────────────────── Messages ─────────────────── */

type MessageRow = {
  id: string;
  from_name: string;
  text: string;
  at: string;
  channel: string | null;
  direct_key: string | null;
  created_by: string | null;
  attachments: unknown;
  updated_at: string | null;
  deleted_at: string | null;
  group_id: string | null;
  mentions?: unknown;
  reactions?: unknown;
  reply_to_id?: string | null;
  forwarded_from?: string | null;
  pinned?: boolean | null;
  pinned_by?: string | null;
  starred_by?: unknown;
  deleted_by?: unknown;
};

// GĐ 96: KHÔNG được chèn chuỗi tên cột qua ${biến} vào template sql`` —
// interface Sql coi chuỗi chèn là THAM SỐ $1, không phải SQL → SELECT $1 trả rows
// không có cột nào → mọi field undefined → crash at.slice (lesson GĐ 70 tái phạm).
// Tên cột PHẢI viết THẲNG trong từng query (hằng COLUMNS chỉ để đối chiếu).
const MESSAGE_COLUMNS =
  "id, from_name, text, at, channel, direct_key, created_by, " +
  "attachments, updated_at, deleted_at, group_id, mentions, " +
  "reactions, reply_to_id, forwarded_from, pinned, pinned_by, starred_by, deleted_by";
function mapMessageRow(r: MessageRow) {
  return {
    id: r.id,
    from: r.from_name,
    text: r.text,
    at: r.at,
    channel: r.channel ?? "Chung",
    directKey: r.direct_key ?? "",
    createdBy: r.created_by ?? "",
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    groupId: r.group_id ?? "",
    mentions: Array.isArray(r.mentions) ? (r.mentions as string[]) : [],
    // GĐ 94: meta Zalo — reaction/reply/forward/pin/star/delete-for-me
    reactions: Array.isArray(r.reactions)
      ? (r.reactions as { employeeId: string; emoji: string }[])
      : [],
    replyToId: r.reply_to_id ?? "",
    forwardedFrom: r.forwarded_from ?? "",
    pinned: r.pinned ?? false,
    pinnedBy: r.pinned_by ?? "",
    starredBy: Array.isArray(r.starred_by) ? (r.starred_by as string[]) : [],
    deletedBy: Array.isArray(r.deleted_by) ? (r.deleted_by as string[]) : [],
  };
}

/** Load TOÀN BỘ messages tin nhắn (mọi kênh + 1-1) — dùng cho hydrate + poll.
 *  Giới hạn 1000 tin mới nhất (theo at DESC rồi đảo lại ASC).
 *  LƯU Ý: danh sách cột viết TRỰC TIẾP trong template (interface Sql không có .raw —
 *  dùng sql.raw gây TypeError runtime → cả hydrate reject → mọi module trắng dữ liệu). */
export const loadAllMessages = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<MessageRow>`
      SELECT id, from_name, text, at, channel, direct_key, created_by,
             attachments, updated_at, deleted_at, group_id, mentions,
             reactions, reply_to_id, forwarded_from, pinned, pinned_by, starred_by, deleted_by
      FROM messages
      ORDER BY at DESC
      -- GĐ 159: 1000 → 300 — cột attachments/reactions/mentions jsonb nặng;
      -- tin cũ vẫn nằm DB, chỉ không tải hết về máy (tiết kiệm egress Neon 5GB)
      LIMIT 300
    `;
    return rows.reverse().map(mapMessageRow);
  });

/** Poll tin mới: mọi tin có at > since — nhẹ, chạy mỗi 5s khi mở trang Chat. */
export const loadMessagesSince = createServerFn({ method: "GET" })
  .validator((data: { since: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    // GĐ 94: poll cả tin MỚI (at > since) LẪN tin cũ vừa đổi meta (reaction/ghim/
    // thu hồi phía tôi...) — meta đổi trên tin cũ có at cũ nên phải bắt bằng updated_at.
    const rows = await sql<MessageRow>`
      SELECT id, from_name, text, at, channel, direct_key, created_by,
             attachments, updated_at, deleted_at, group_id, mentions,
             reactions, reply_to_id, forwarded_from, pinned, pinned_by, starred_by, deleted_by
      FROM messages
      WHERE at > ${data.since} OR updated_at > ${new Date(Date.now() - 60_000).toISOString()}
      ORDER BY at ASC
      LIMIT 200
    `;
    return rows.map(mapMessageRow);
  });

export const insertMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      from: string;
      text: string;
      at: string;
      channel: string;
      fromId?: string;
      directKey?: string;
      attachments?: string[];
      updatedAt?: string;
      deletedAt?: string;
      groupId?: string;
      mentions?: string[];
      reactions?: { employeeId: string; emoji: string }[];
      replyToId?: string;
      forwardedFrom?: string;
      pinned?: boolean;
      pinnedBy?: string;
      starredBy?: string[];
      deletedBy?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      INSERT INTO messages (id, from_name, text, at, channel, direct_key, created_by,
                            attachments, updated_at, deleted_at, group_id, mentions,
                            reactions, reply_to_id, forwarded_from, pinned, pinned_by, starred_by, deleted_by)
      VALUES (${data.id}, ${data.from}, ${data.text}, ${data.at}, ${data.channel},
              ${data.directKey ?? ""}, ${data.fromId ?? ""},
              ${JSON.stringify(data.attachments ?? [])}::jsonb,
              ${data.updatedAt ? new Date(data.updatedAt) : new Date()},
              ${data.deletedAt ? new Date(data.deletedAt) : null},
              ${data.groupId ?? ""},
              ${JSON.stringify(data.mentions ?? [])}::jsonb,
              ${JSON.stringify(data.reactions ?? [])}::jsonb,
              ${data.replyToId ?? ""},
              ${data.forwardedFrom ?? ""},
              ${data.pinned ?? false},
              ${data.pinnedBy ?? ""},
              ${JSON.stringify(data.starredBy ?? [])}::jsonb,
              ${JSON.stringify(data.deletedBy ?? [])}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        deleted_at = EXCLUDED.deleted_at,
        updated_at = EXCLUDED.updated_at,
        reactions = EXCLUDED.reactions,
        pinned = EXCLUDED.pinned,
        pinned_by = EXCLUDED.pinned_by,
        starred_by = EXCLUDED.starred_by,
        deleted_by = EXCLUDED.deleted_by
      WHERE messages.updated_at < EXCLUDED.updated_at
    `;
  });

/**
 * GĐ 94: cập nhật meta tin nhắn (reaction/ghim/đánh dấu/xóa phía tôi) —
 * COALESCE từng field + LWW guard theo updated_at. Chỉ meta đổi, text/at giữ nguyên.
 */
export const updateMessageMeta = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      updatedAt: string;
      reactions?: { employeeId: string; emoji: string }[];
      pinned?: boolean;
      pinnedBy?: string;
      starredBy?: string[];
      deletedBy?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE messages SET
        reactions = COALESCE(${data.reactions ? JSON.stringify(data.reactions) : null}::jsonb, reactions),
        pinned = COALESCE(${data.pinned ?? null}, pinned),
        pinned_by = COALESCE(${data.pinnedBy ?? null}, pinned_by),
        starred_by = COALESCE(${data.starredBy ? JSON.stringify(data.starredBy) : null}::jsonb, starred_by),
        deleted_by = COALESCE(${data.deletedBy ? JSON.stringify(data.deletedBy) : null}::jsonb, deleted_by),
        updated_at = ${new Date(data.updatedAt)}
      WHERE id = ${data.id} AND updated_at < ${new Date(data.updatedAt)}
    `;
  });

/** Thu hồi tin nhắn — tombstone soft delete lan truyền mọi thiết bị. */
export const deleteMessage = createServerFn({ method: "POST" })
  .validator((data: { id: string; deletedAt: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE messages SET deleted_at = ${new Date(data.deletedAt)}, updated_at = ${new Date(data.deletedAt)} WHERE id = ${data.id}`;
  });

/* ─── Nhóm chat riêng (GĐ 72 — kiểu Zalo: Admin tạo, member mới thấy) ─── */

type ChatGroupRow = {
  id: string;
  name: string;
  created_by: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  employee_id: string | null;
  member_role: string | null;
};

type ChatGroupFlat = {
  id: string;
  name: string;
  createdBy: string;
  updatedAt: string | null;
  deletedAt: string | null;
  members: Array<{ employeeId: string; role: string }>;
};

function mapChatGroupRow(r: ChatGroupRow): ChatGroupFlat {
  return {
    id: r.id,
    name: r.name,
    createdBy: r.created_by ?? "",
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    members: r.employee_id
      ? [{ employeeId: r.employee_id, role: r.member_role ?? "member" }]
      : [],
  };
}

/** Load mọi nhóm (kèm member rows) — UI tự lọc nhóm mà user là member.
 *  JOIN 1-n: mỗi dòng = 1 member; nhóm không member chỉ còn owner vẫn hiện. */
export const loadChatGroups = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<ChatGroupRow>`
      SELECT g.id, g.name, g.created_by, g.updated_at, g.deleted_at,
             m.employee_id, m.role as member_role
      FROM chat_groups g
      LEFT JOIN chat_group_members m ON m.group_id = g.id
      ORDER BY g.created_at ASC
      LIMIT 500
    `;
    // Gộp member rows theo group id
    const map = new Map<string, ChatGroupFlat>();
    for (const r of rows) {
      const flat = mapChatGroupRow(r);
      const existing = map.get(flat.id);
      if (!existing) {
        map.set(flat.id, flat);
      } else {
        existing.members.push(...flat.members);
      }
    }
    return Array.from(map.values());
  });

/** Tạo nhóm mới — chỉ Admin gọi từ UI (kiểm tra quyền ở client + đây là server fn công khai). */
export const createChatGroup = createServerFn({ method: "POST" })
  .validator((data: { id: string; name: string; createdBy: string; memberIds: string[] }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      INSERT INTO chat_groups (id, name, created_by) VALUES (${data.id}, ${data.name}, ${data.createdBy})
    `;
    // Owner + members
    const all = new Set<string>([data.createdBy, ...data.memberIds]);
    for (const empId of all) {
      const role = empId === data.createdBy ? "owner" : "member";
      await sql`
        INSERT INTO chat_group_members (group_id, employee_id, role)
        VALUES (${data.id}, ${empId}, ${role})
        ON CONFLICT (group_id, employee_id) DO NOTHING
      `;
    }
    return { success: true };
  });

/** Đổi tên nhóm — Owner hoặc Admin (GĐ 77). Cập nhật updated_at để LWW poll lan truyền tên mới. */
export const renameChatGroup = createServerFn({ method: "POST" })
  .validator((data: { groupId: string; name: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      UPDATE chat_groups SET name = ${data.name}, updated_at = now()
      WHERE id = ${data.groupId} AND deleted_at IS NULL
    `;
    return { success: true };
  });

/** Thêm thành viên vào nhóm — Owner hoặc Admin. */
export const addChatGroupMembers = createServerFn({ method: "POST" })
  .validator((data: { groupId: string; employeeIds: string[] }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    for (const empId of data.employeeIds) {
      await sql`
        INSERT INTO chat_group_members (group_id, employee_id, role)
        VALUES (${data.groupId}, ${empId}, 'member')
        ON CONFLICT (group_id, employee_id) DO NOTHING
      `;
    }
    await sql`UPDATE chat_groups SET updated_at = now() WHERE id = ${data.groupId}`;
    return { success: true };
  });

/** Xóa thành viên khỏi nhóm — Owner hoặc Admin (owner không thể tự xóa mình). */
export const removeChatGroupMember = createServerFn({ method: "POST" })
  .validator((data: { groupId: string; employeeId: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`DELETE FROM chat_group_members WHERE group_id = ${data.groupId} AND employee_id = ${data.employeeId} AND role <> 'owner'`;
    await sql`UPDATE chat_groups SET updated_at = now() WHERE id = ${data.groupId}`;
    return { success: true };
  });

/** Giải tán nhóm — tombstone (Owner hoặc Admin). Tin nhắn nhóm giữ nguyên trong DB. */
export const deleteChatGroup = createServerFn({ method: "POST" })
  .validator((data: { groupId: string; deletedAt: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE chat_groups SET deleted_at = ${new Date(data.deletedAt)}, updated_at = ${new Date(data.deletedAt)} WHERE id = ${data.groupId}`;
    return { success: true };
  });

export const bulkInsertMessages = createServerFn({ method: "POST" })
  .validator(
    (data: {
      rows: Array<{
        id: string;
        from: string;
        text: string;
        at: string;
        channel: string;
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    for (const r of data.rows) {
      await sql`
        INSERT INTO messages (id, from_name, text, at, channel)
        VALUES (${r.id}, ${r.from}, ${r.text}, ${r.at}, ${r.channel})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  });

/* ─────────────────── Check-ins ─────────────────── */

export const loadCheckins = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{
      id: string;
      name: string;
      time: string;
      date: string;
      weekday: string;
      gps: string;
      address: string;
      note: string;
    }>`SELECT * FROM checkins ORDER BY date DESC, time DESC LIMIT 500`;
  });

export const insertCheckin = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      name: string;
      time: string;
      date: string;
      weekday: string;
      gps?: string;
      address?: string;
      note?: string;
      photo?: string;
      video?: string;
      centerCode?: string;
      status?: string;
      updatedAt?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const ts = data.updatedAt ? new Date(data.updatedAt) : new Date();
    try {
      // Try with new columns (migration 0014 + 0029 video)
      await sql`
        INSERT INTO checkins (id, name, time, date, weekday, gps, address, note, photo, video, center_code, status, updated_at)
        VALUES (${data.id}, ${data.name}, ${data.time}, ${data.date}, ${data.weekday},
                ${data.gps ?? ""}, ${data.address ?? ""}, ${data.note ?? ""},
                ${data.photo ?? ""}, ${data.video ?? ""}, ${data.centerCode ?? "VP"}, ${data.status ?? "checked_in"}, ${ts})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, time = EXCLUDED.time, date = EXCLUDED.date,
          weekday = EXCLUDED.weekday, gps = EXCLUDED.gps, address = EXCLUDED.address,
          note = EXCLUDED.note, photo = EXCLUDED.photo, video = EXCLUDED.video,
          center_code = EXCLUDED.center_code,
          status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
        WHERE checkins.updated_at < EXCLUDED.updated_at
      `;
    } catch {
      // Fallback: old columns only (migration 0014 not yet applied)
      await sql`
        INSERT INTO checkins (id, name, time, date, weekday, gps, address, note)
        VALUES (${data.id}, ${data.name}, ${data.time}, ${data.date}, ${data.weekday},
                ${data.gps ?? ""}, ${data.address ?? ""}, ${data.note ?? ""})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  });

export const deleteCheckin = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`UPDATE checkins SET deleted_at = now() WHERE id = ${data.id}`;
  });

export const loadDeletedCheckinIds = createServerFn({ method: "GET" })
  .handler(async () => {
    const sql = await getSql();
    return sql<{ id: string }>`SELECT id FROM checkins WHERE deleted_at IS NOT NULL`;
  });

/* ─────────────────── Clear attendance ─────────────────── */

export const clearAttendance = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    await sql`DELETE FROM attendance`;
  });

/* ─────────────────── Seed check ─────────────────── */

export const isTableEmpty = createServerFn({ method: "GET" })
  .validator((data: { table: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const allowed = [
      "attendance",
      "tasks",
      "proposals",
      "notes",
      "messages",
      "checkins",
    ];
    if (!allowed.includes(data.table)) return true;
    const rows = await sql.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${data.table}"`,
    );
    return Number(rows[0]?.count ?? 0) === 0;
  });

/* ─────────── Reverse Geocoding (server-side) ─────────── */

/** Remove postal/zip codes (e.g. "11110") from address strings */
function cleanAddress(raw: string): string {
  if (!raw) return raw;
  // Remove standalone postal codes (4-6 digits) that appear between commas or at end
  let cleaned = raw.replace(/,?\s*\d{4,6}\s*(?=,|$)/g, "");
  // Also handle format like "Hà Nội 11110, Việt Nam" (digit cluster after city name)
  cleaned = cleaned.replace(/(\S)\s+\d{4,6}(?=,)/g, "$1");
  // Clean up double commas/spaces
  cleaned = cleaned.replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "");
  return cleaned.trim();
}

export const reverseGeocode = createServerFn({ method: "GET" })
  .validator((d: { lat: number; lng: number }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "vi",
            "User-Agent": "GIONG-VN/1.0 (cham-cong-app)",
          },
        },
      );
      const json = await res.json();
      return cleanAddress(json.display_name || "");
    } catch {
      return "";
    }
  });

/* ─────────── TEMP: Fix admin roles in DB ─────────── */
export const fixAdminRoles = createServerFn({ method: "POST" })
  .handler(async () => {
    const sql = await getSql();
    const results: string[] = [];
    // Known admin emails from catalog
    const adminEmails = [
      'tcmdx2026@gmail.com',
      'cuongpk.giong02@gmail.com',
      'thuynvy218@gmail.com',
      'hoangminhchau2631960@gmail.com',
    ];
    for (const email of adminEmails) {
      const r = await sql<{ name: string }>`
        UPDATE employees SET role = 'Admin' WHERE LOWER(email) = LOWER(${email}) AND status = 'active' RETURNING name
      `;
      if (r.length > 0) results.push(`Set Admin: ${r[0].name}`);
      else results.push(`Not found: ${email}`);
    }
    const all = await sql<{ name: string; email: string; role: string }>`
      SELECT name, email, role FROM employees WHERE status = 'active' ORDER BY role DESC, name
    `;
    return { results, allEmployees: all };
  });
