/**
 * Test fix badge chat kẹt (2026-09-10) — logic của totalUnreadCount sau fix.
 * Dùng bản sao hàm thuần (store.ts import "@/data" không resolve được trong node
 * --test standalone) — thuật toán giữ đồng bộ với src/lib/store.ts.
 *
 * Chạy: node --experimental-strip-types --test src/lib/unread.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatMessage, ChatGroup } from "./types.ts";

/* ── Bản sao conversationKeyOf + unreadCountFor + totalUnreadCount (store.ts) ── */

function conversationKeyOf(m: ChatMessage, userId: string): string {
  if (m.groupId) return `mygroup:${m.groupId}`;
  if (m.directKey) return `direct:${m.directKey.split("|").find((id) => id !== userId) ?? m.directKey}`;
  return `group:${m.channel}`;
}

function parseTs(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  const s = String(ts);
  const norm = s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const t = Date.parse(norm);
  return Number.isNaN(t) ? 0 : t;
}

function unreadCountFor(
  messages: ChatMessage[],
  convKey: string,
  userId: string,
  lastReadMap: Record<string, string>,
): number {
  const lastRead = lastReadMap[convKey];
  const lastReadTs = lastRead ? Date.parse(lastRead) || 0 : 0;
  return messages.filter((m) => {
    if (m.fromId === userId) return false;
    if (m.deletedAt) return false;
    return conversationKeyOf(m, userId) === convKey && parseTs(m.updatedAt ?? m.at) > lastReadTs;
  }).length;
}

function totalUnreadCount(
  messages: ChatMessage[],
  userId: string,
  chatGroups: ChatGroup[] = [],
  employeeIds: Set<string> = new Set(),
  lastReadMapOverride: Record<string, string> = {},
): number {
  const lastReadMap = lastReadMapOverride;
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
      continue;
    }
    if (m.directKey) {
      const peer = m.directKey.split("|").find((id) => id !== userId);
      if (peer && employeeIds.has(peer)) convKeys.add(`direct:${peer}`);
      continue;
    }
    // Tin kênh công khai cũ (group:{channel}) → bỏ — không còn UI để mở
  }
  let total = 0;
  for (const key of convKeys) {
    total += unreadCountFor(messages, key, userId, lastReadMap);
  }
  return total;
}

/* ── Tests ── */

const ME = "emp-me";
const PEER = "emp-peer";
const PEER_GONE = "emp-gone";

const mkMsg = (over: Partial<ChatMessage> & { id: string }): ChatMessage =>
  ({
    from: "người khác",
    text: "xin chào",
    at: "2026-09-10 09:00",
    channel: "Chung",
    fromId: PEER,
    directKey: "",
    attachments: [],
    groupId: "",
    updatedAt: "2026-09-10T09:00:00.000Z",
    ...over,
  }) as ChatMessage;

const mkGroup = (over: Partial<ChatGroup> & { id: string }): ChatGroup =>
  ({
    name: `Nhóm ${over.id}`,
    createdBy: PEER,
    members: [
      { employeeId: ME, role: "member" },
      { employeeId: PEER, role: "owner" },
    ],
    ...over,
  }) as ChatGroup;

const employeeIds = new Set([ME, PEER]);

test("không đếm tin của kênh công khai cũ (group:*) — không còn UI mở", () => {
  const msgs = [mkMsg({ id: "m1" })]; // không groupId, không directKey → key group:Chung
  assert.equal(totalUnreadCount(msgs, ME, [], employeeIds, {}), 0);
});

test("không đếm tin của nhóm đã giải tán / nhóm không phải member", () => {
  const msgs = [mkMsg({ id: "m1", groupId: "g-dead" })];
  // Nhóm g-dead không tồn tại trong chatGroups (tombstone) → bỏ
  assert.equal(totalUnreadCount(msgs, ME, [], employeeIds, {}), 0);
  // Nhóm sống nhưng mình không phải member → bỏ
  const notMember = mkGroup({ id: "g2", members: [{ employeeId: PEER, role: "owner" }] });
  assert.equal(totalUnreadCount(msgs, ME, [notMember], employeeIds, {}), 0);
});

test("không đếm tin 1-1 với peer không còn trong danh sách nhân sự", () => {
  const msgs = [mkMsg({ id: "m1", directKey: [ME, PEER_GONE].sort().join("|") })];
  assert.equal(totalUnreadCount(msgs, ME, [], employeeIds, {}), 0);
});

test("đếm đúng: nhóm member + 1-1 peer còn tồn tại; tin của mình không đếm", () => {
  const g = mkGroup({ id: "g1" });
  const msgs = [
    mkMsg({ id: "m1", groupId: "g1" }),
    mkMsg({ id: "m2", directKey: [ME, PEER].sort().join("|") }),
    mkMsg({ id: "m3", fromId: ME, groupId: "g1" }),
  ];
  assert.equal(totalUnreadCount(msgs, ME, [g], employeeIds, {}), 2);
});

test("lastRead sau tin → unread về 0 (đọc hết là hết badge)", () => {
  const msgs = [mkMsg({ id: "m1", groupId: "g1" })];
  const g = mkGroup({ id: "g1" });
  assert.equal(
    totalUnreadCount(msgs, ME, [g], employeeIds, { "mygroup:g1": "2026-09-10T10:00:00.000Z" }),
    0,
  );
});

test("unreadCountFor giữ hành vi cũ — tin của mình không đếm", () => {
  const msgs = [mkMsg({ id: "m1", groupId: "g1" }), mkMsg({ id: "m2", groupId: "g1", fromId: ME })];
  assert.equal(unreadCountFor(msgs, "mygroup:g1", ME, {}), 1);
});
