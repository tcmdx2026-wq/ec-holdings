import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  AtSign,
  Bookmark,
  CheckSquare,
  Copy,
  CornerUpLeft,
  CirclePlus,
  Crown,
  Download,
  Forward,
  ImagePlus,
  Info,
  LogOut,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDesc } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EMPLOYEES, isAdminRole, normalizePersonKey } from "@/lib/catalog";
import { todayIso, weekdayVi } from "@/lib/format";
import { useAppStore, conversationKeyOf } from "@/lib/store";

export const Route = createFileRoute("/chat")({ component: ChatPage });

/* ───────────────────────── Helpers ───────────────────────── */

// GĐ 74: ĐÃ XÓA 4 kênh công khai Chung/Kế toán/Dược/Marketing theo yêu cầu Đại ca —
// Chat giờ chỉ còn NHÓM RIÊNG (GĐ 72) + TIN NHẮN RIÊNG 1-1.
// Tin cũ của kênh công khai vẫn nằm trong DB nhưng không còn UI hiển thị.

/** Khoảng cách với tin cuối — tin mới hơn 5 phút thì hiện khối thời gian */
const DAY_GAP_MS = 5 * 60 * 1000;

function fmtTime(at: string): string {
  // at = "YYYY-MM-DD HH:mm" (giờ địa phương lúc gửi)
  return at.slice(11, 16);
}

function dayLabel(dayKey: string): string {
  const today = todayIso();
  if (dayKey === today) return "Hôm nay";
  // Hôm qua
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dayKey === yesterday) return "Hôm qua";
  return `${weekdayVi(dayKey)}, ${dayKey.split("-").reverse().join("/")}`;
}

/** URL có phải ảnh không (Cloudinary /image/upload/ hoặc đuôi ảnh) */
function isImageUrl(url: string): boolean {
  return /\/image\/upload\//.test(url) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

function fileIconLabel(url: string): string {
  try {
    const name = decodeURIComponent(url.split("/").pop() ?? "file");
    const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE";
    return ext.slice(0, 6);
  } catch {
    return "FILE";
}
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  if (!file.type.startsWith("image/")) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error(`File "${file.name}" quá lớn (tối đa 2MB)`);
    }
    return dataUrl;
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.8;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > 800 * 1024 * 1.37 && quality > 0.3) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

/* ───────────────────────── Page ───────────────────────── */

function ChatPage() {
  const messages = useAppStore((s) => s.messages);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const updateMessageMeta = useAppStore((s) => s.updateMessageMeta);
  const refreshMessages = useAppStore((s) => s.refreshMessages);
  const removeMessage = useAppStore((s) => s.removeMessage);
  const addChatGroup = useAppStore((s) => s.addChatGroup);
  const addGroupMembers = useAppStore((s) => s.addChatGroupMembers);
  const removeGroupMember = useAppStore((s) => s.removeChatGroupMember);
  const removeChatGroup = useAppStore((s) => s.removeChatGroup);
  const renameChatGroup = useAppStore((s) => s.renameChatGroup);
  const markConversationRead = useAppStore((s) => s.markConversationRead);
  const chatGroups = useAppStore((s) => s.chatGroups);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const employees = useAppStore((s) => s.employees);
  const me = employees.find((e) => e.id === currentUserId) ?? null;
  const meName = me?.username ?? "";
  const isAdmin = isAdminRole(me?.role);

  const [tab, setTab] = useState<"group" | "direct">("group");
  const [peerId, setPeerId] = useState<string | null>(null);
  // Nhóm riêng đang mở (GĐ 72) — id trong chatGroups
  const [groupId, setGroupId] = useState<string | null>(null);
  // Mobile: 1 khung tại 1 thời điểm — "list" (danh sách) hoặc "chat" (cửa sổ). Desktop luôn hiện cả 2.
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Dialog tạo nhóm mới + dialog thành viên nhóm
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);
  const [memberDialog, setMemberDialog] = useState<string | null>(null); // groupId đang xem
  // GĐ 77: đổi tên nhóm — state form inline trong dialog thành viên
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  // GĐ 77: @mention trong nhóm — state dropdown chọn người khi gõ "@"
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = tắt; "" = vừa gõ @
  const [mentionedIds, setMentionedIds] = useState<string[]>([]); // ID employee được tag trong tin đang soạn
  // ── GĐ 94: tác vụ tin nhắn kiểu Zalo ──
  const [msgMenu, setMsgMenu] = useState<string | null>(null); // id tin đang mở menu "..."
  const [reactBar, setReactBar] = useState<string | null>(null); // id tin đang mở thanh 6 emoji
  const [replyTo, setReplyTo] = useState<string | null>(null); // id tin đang được trả lời
  const [forwardMsg, setForwardMsg] = useState<string | null>(null); // text+from tin đang chuyển tiếp
  const [forwardTarget, setForwardTarget] = useState<string>(""); // employeeId đích chuyển tiếp
  const [detailMsg, setDetailMsg] = useState<string | null>(null); // id tin xem chi tiết
  const [multiSelect, setMultiSelect] = useState(false); // đang bật chế độ chọn nhiều tin
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // tin đã tick trong mode chọn nhiều
  const [showStarred, setShowStarred] = useState(false); // mở popup "Tin đã lưu"
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"]; // 6 quick reaction như Zalo
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  /* GĐ 97: cuộn xuống đáy vùng tin nhắn. force=true khi MỞ hội thoại (luôn về đáy);
     force=false khi tin mới/ảnh load — chỉ cuộn nếu đang ở gần đáy (đang đọc sửổi không giật). */
  function scrollToBottom(force = false) {
    const el = scrollAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (force || nearBottom) el.scrollTop = el.scrollHeight;
  }

  const directKey = peerId ? [currentUserId, peerId].sort().join("|") : "";
  const activeGroup = groupId ? chatGroups.find((g) => g.id === groupId) ?? null : null;

  /* Nhóm mà tôi là member — chỉ những nhóm này hiện trong danh sách */
  const myGroups = useMemo(
    () => chatGroups.filter((g) => !g.deletedAt && g.members.some((m) => m.employeeId === currentUserId)),
    [chatGroups, currentUserId],
  );

  /* GĐ 74: key hội thoại đang mở — khớp conversationKeyOf để markConversationRead */
  const activeConvKey =
    tab === "direct" && peerId
      ? `direct:${peerId}`
      : tab === "group" && groupId
        ? `mygroup:${groupId}`
        : "";

  /* Tin nhắn của hội thoại đang mở — GĐ 94: ẩn tin bị TÔI xóa phía tôi.
     GĐ 96: lọc tin HỎNG (at không phải string) — dữ liệu lỗi do bản poll trước
     ghi nhầm vào localStorage; không lọc thì crash at.slice ngay khi render. */
  const activeMessages = useMemo(() => {
    const list = messages.filter((m) => {
      if (!m.at || typeof m.at !== "string") return false;
      if (m.deletedBy?.includes(currentUserId)) return false; // xóa chỉ ở phía tôi
      if (tab === "direct") return m.directKey === directKey;
      if (groupId) return m.groupId === groupId;
      return false; // GĐ 74: không còn kênh công khai
    });
    return list.sort((a, b) => (a.at > b.at ? 1 : a.at < b.at ? -1 : 0));
  }, [messages, tab, directKey, groupId, currentUserId]);

  /* GĐ 94: tin đang ghim của hội thoại (mới ghim thay cũ — nguồn sự thật là tin pinned cuối) */
  const pinnedMsg = useMemo(
    () => activeMessages.filter((m) => m.pinned).slice(-1)[0] ?? null,
    [activeMessages],
  );

  /* GĐ 94: tin tôi đã đánh dấu ⭐ (toàn app) */
  const starredMsgs = useMemo(
    () => messages.filter((m) => m.starredBy?.includes(currentUserId)),
    [messages, currentUserId],
  );

  /* GĐ 94: toggle reaction của tôi trên 1 tin — bấm lại emoji đang có = bỏ reaction */
  function toggleReaction(msgId: string, emoji: string) {
    const m = messages.find((x) => x.id === msgId);
    if (!m) return;
    const rest = (m.reactions ?? []).filter((r) => r.employeeId !== currentUserId);
    const mineR = (m.reactions ?? []).find((r) => r.employeeId === currentUserId);
    const next = mineR?.emoji === emoji ? rest : [...rest, { employeeId: currentUserId, emoji }];
    updateMessageMeta(msgId, { reactions: next });
    setReactBar(null);
  }

  /* GĐ 94: bắt đầu trả lời 1 tin.
     GĐ 96: trả lời trong NHÓM — tự chèn "@Tên " người được trả lời vào ô soạn +
     lưu ID vào mentions để người đó NHẬN ĐƯỢC tin (không có @ thì họ không biết). */
  function startReply(msgId: string) {
    const src = messages.find((x) => x.id === msgId);
    if (src && tab === "group") {
      const senderId = src.fromId || "";
      // Không tự @ chính mình khi trả lời tin của mình
      if (senderId && senderId !== currentUserId) {
        const senderName = employees.find((e) => e.id === senderId)?.name ?? src.from;
        const prefix = `@${senderName} `;
        setText((prev) => {
          const stripped = prev.replace(/^@[^@\n]+\s*/, ""); // thay @ của lần reply trước
          return prefix + stripped;
        });
        setMentionedIds((prev) => (prev.includes(senderId) ? prev : [...prev, senderId]));
      }
    }
    setReplyTo(msgId);
    setMsgMenu(null);
  }

  /* GĐ 94: chuyển tiếp tin sang hội thoại 1-1 khác (nhóm khác giữ nguyên ngữ cảnh member — 1-1 là an toàn/nhanh nhất) */
  function doForward() {
    if (!forwardTarget || forwardMsg === null) return;
    sendMessage(forwardMsg, "", { toId: forwardTarget, forwardedFrom: meName || "Người khác" });
    toast.success("Đã chuyển tiếp tin nhắn");
    setForwardMsg(null);
    setForwardTarget("");
    setMsgMenu(null);
  }

  /* GĐ 94: ghim/bỏ ghim — ghim mới tự thay ghim cũ (updateMessageMeta gọi 2 lần) */
  function togglePin(msgId: string) {
    const wasPinned = messages.find((x) => x.id === msgId)?.pinned ?? false;
    if (!wasPinned) {
      for (const p of activeMessages.filter((x) => x.pinned)) {
        updateMessageMeta(p.id, { pinned: false, pinnedBy: "" });
      }
    }
    updateMessageMeta(msgId, { pinned: !wasPinned, pinnedBy: !wasPinned ? me?.name ?? "" : "" });
    setMsgMenu(null);
    toast.success(wasPinned ? "Đã bỏ ghim tin nhắn" : "Đã ghim tin nhắn");
  }

  /* GĐ 94: đánh dấu/bỏ đánh dấu ⭐ tin nhắn */
  function toggleStar(msgId: string) {
    const m = messages.find((x) => x.id === msgId);
    if (!m) return;
    const has = m.starredBy?.includes(currentUserId) ?? false;
    const next = has
      ? (m.starredBy ?? []).filter((id) => id !== currentUserId)
      : [...(m.starredBy ?? []), currentUserId];
    updateMessageMeta(msgId, { starredBy: next });
    setMsgMenu(null);
    toast.success(has ? "Đã bỏ đánh dấu" : "Đã đánh dấu tin nhắn ⭐");
  }

  /* GĐ 94: xóa tin CHỈ Ở PHÍA TÔI — người khác vẫn thấy bình thường */
  function deleteForMe(msgId: string) {
    const m = messages.find((x) => x.id === msgId);
    if (!m) return;
    const next = [...(m.deletedBy ?? []), currentUserId];
    updateMessageMeta(msgId, { deletedBy: next });
    setSelectedIds((prev) => prev.filter((id) => id !== msgId));
    setMsgMenu(null);
  }

  /* GĐ 95: LƯU VỀ MÁY — tải đính kèm (ảnh/tệp) của tin với tên file gốc từ URL */
  async function saveAttachmentsToDisk(msgId: string) {
    const m = messages.find((x) => x.id === msgId);
    if (!m) return;
    const urls = m.attachments?.length
      ? m.attachments
      : m.text.startsWith("http") && !m.text.includes(" ")
        ? [m.text]
        : [];
    if (urls.length === 0) {
      toast.error("Tin này không có tệp đính kèm để lưu");
      return;
    }
    setMsgMenu(null);
    for (const url of urls) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        // Tên file gốc từ URL Cloudinary (public_id + ext)
        let name = "file";
        try {
          const raw = decodeURIComponent(url.split("/").pop() ?? "");
          name = raw.includes(".") ? raw : `${raw || "file"}.jpg`;
        } catch {
          name = "file.jpg";
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        console.error("Save attachment failed:", err);
        toast.error("Không tải được tệp — mở đường link thất bại");
      }
    }
    if (urls.length > 0) toast.success(`Đã lưu ${urls.length} tệp về máy`);
  }

  /* Danh sách hội thoại trái — nhóm riêng (GĐ 72) + 1-1. Kênh công khai đã xóa (GĐ 74). */
  const conversationList = useMemo(() => {
    if (tab === "group") {
      // Nhóm riêng — chỉ nhóm tôi là member
      return myGroups.map((g) => {
        const msgs = messages.filter((m) => m.groupId === g.id);
        const last = msgs[msgs.length - 1];
        return {
          key: `mygroup:${g.id}`,
          type: "mygroup" as const,
          id: g.id,
          name: g.name,
          last,
        };
      });
    }
    // Nhắn 1-1: mọi nhân sự khác (cả khi chưa có tin — để bắt đầu nhắn mới)
    return employees
      .filter((e) => e.id !== currentUserId)
      .map((e) => {
        const key = [currentUserId, e.id].sort().join("|");
        const msgs = messages.filter((m) => m.directKey === key);
        const last = msgs[msgs.length - 1];
        return {
          key: `direct:${e.id}`,
          type: "direct" as const,
          id: e.id,
          name: e.name,
          title: e.title,
          last,
        };
      })
      .sort((a, b) => {
        // Có tin gần nhất lên trước, rồi theo tên
        const ta = a.last?.at ?? "";
        const tb = b.last?.at ?? "";
        if (ta !== tb) return ta > tb ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [tab, messages, employees, currentUserId, myGroups]);

  const filteredConversations = useMemo(() => {
    if (!q.trim()) return conversationList;
    const needle = q.trim().toLowerCase();
    return conversationList.filter((c) =>
      c.name.toLowerCase().includes(needle),
    );
  }, [conversationList, q]);

  /* Poll tin mới mỗi 5s khi trang mở */
  useEffect(() => {
    refreshMessages();
    const timer = setInterval(() => refreshMessages(), 5000);
    return () => clearInterval(timer);
  }, [refreshMessages]);

  /* GĐ 77: ứng viên @mention — member nhóm đang mở (trừ mình), lọc theo chữ sau "@" */
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || tab !== "group" || !groupId) return [];
    // GĐ 246: trim query — gõ "@All " hay dư dấu cách sau tên vẫn tìm được người (trước đây dropdown biến mất)
    const q = mentionQuery.trim().toLowerCase();
    return (activeGroup?.members ?? [])
      .filter((m) => m.employeeId !== currentUserId)
      .map((m) => employees.find((e) => e.id === m.employeeId))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .filter((e) => !q || e.name.toLowerCase().includes(q));
  }, [mentionQuery, tab, groupId, activeGroup, employees, currentUserId]);

  /* GĐ 77: gõ "@" trong ô soạn tin (chỉ nhóm) → mở dropdown mention */
  function handleTextChange(v: string) {
    setText(v);
    if (tab !== "group") {
      setMentionQuery(null);
      return;
    }
    const m = v.match(/@([^@\n]*)$/); // chữ ngay sau "@" cuối cùng
    if (m) {
      setMentionQuery(m[1]);
    } else {
      setMentionQuery(null);
    }
  }

  /* GĐ 77: chọn người từ dropdown — thay "@chữ" bằng "@Tên " + lưu ID vào mentions */
  function pickMention(empId: string, name: string) {
    // GĐ 246: mở dropdown bằng nút @ thì text chưa có "@" → append thay vì replace
    setText((prev) =>
      /@[^@\n]*$/.test(prev) ? prev.replace(/@([^@\n]*)$/, `@${name} `) : `${prev}@${name} `,
    );
    setMentionedIds((prev) => (prev.includes(empId) ? prev : [...prev, empId]));
    setMentionQuery(null);
  }

  /* GĐ 246: chọn @All — nhắn cho TẤT CẢ mọi người trong nhóm (tô đậm như tag người thật) */
  function pickMentionAll() {
    setText((prev) =>
      /@[^@\n]*$/.test(prev) ? prev.replace(/@([^@\n]*)$/, "@All ") : `${prev}@All `,
    );
    setMentionQuery(null);
  }

  /* GĐ 97: cuộn xuống đáy — MỞ/ĐỔI hội thoại thì luôn về đáy (kể cả đang đọc sửổi);
     tin mới về (poll 5s) thì chỉ cuộn nếu đang ở gần đáy — không giật người đang đọc. */
  useEffect(() => {
    scrollToBottom(true);
  }, [activeConvKey]);
  useEffect(() => {
    scrollToBottom(false);
  }, [activeMessages.length]);

  /* GĐ 74: đang mở hội thoại → đánh dấu đã đọc (badge đỏ giảm đúng).
     Chạy lại khi có tin mới về (poll 5s) → đang mở chat thì tin mới coi như đã đọc. */
  useEffect(() => {
    if (activeConvKey) markConversationRead(activeConvKey);
  }, [activeConvKey, activeMessages.length, markConversationRead]);

  /* Nhắn với chính mình — chặn; nhóm phải là member mới được nhắn */
  const canSend =
    tab === "direct"
      ? Boolean(peerId && peerId !== currentUserId)
      : Boolean(
          groupId &&
            activeGroup?.members.some((m) => m.employeeId === currentUserId),
        );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && attachments.length === 0) return;
    if (!canSend) return;
    // Gửi 1 tin duy nhất — text + đính kèm cùng tin (cột attachments trong DB)
    sendMessage(text.trim(), "", {
      toId: tab === "direct" ? peerId! : undefined,
      groupId: tab === "group" && groupId ? groupId : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      // GĐ 77: gửi kèm danh sách ID được @mention (chỉ nhóm có nghĩa)
      mentions: tab === "group" && mentionedIds.length > 0 ? mentionedIds : undefined,
      // GĐ 94: kèm ID tin đang trả lời (nếu có)
      replyToId: replyTo ?? undefined,
    });
    setText("");
    setAttachments([]);
    setMentionedIds([]); // GĐ 77: reset mention sau khi gửi
    setReplyTo(null); // GĐ 94: reset reply sau khi gửi
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 3);
    setUploading(true);
    try {
      const { uploadImage } = await import("@/routes/api/upload");
      const uploaded: string[] = [];
      for (const f of list) {
        const base64 = await compressImage(f);
        const res = await uploadImage({
          data: { base64, folder: "giong-vn/chat", fileName: f.name },
        });
        uploaded.push(res.url);
      }
      setAttachments((prev) => [...prev, ...uploaded].slice(0, 3));
    } catch (err: any) {
      console.error("Upload chat attachment failed:", err);
      alert(err?.message ?? "Lỗi upload tệp");
    } finally {
      setUploading(false);
    }
  }

  /* Nhãn người gửi: username nếu trùng tên */
  function senderLabel(m: (typeof activeMessages)[number]): string {
    const byId = m.fromId
      ? employees.find((e) => e.id === m.fromId)
      : undefined;
    if (byId) return byId.username || byId.name;
    return m.from;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Hệ thống"
        title="Chat nội bộ"
        desc="Trao đổi trong nhóm riêng và tin nhắn 1-1 — tự động cập nhật, lưu Neon + Cloudinary."
      />

      <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] gap-4 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
        {/* ── Cột trái: danh sách hội thoại ── */}
        <aside
          className={`flex w-full shrink-0 flex-col border-r border-line sm:w-64 md:w-72 ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-line p-2.5">
            <div className="mb-2 flex gap-1 rounded-md bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab("group");
                  setPeerId(null);
                }}
                className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm text-sm ${
                  tab === "group" ? "bg-surface font-medium text-ink shadow-sm" : "text-muted"
                }`}
              >
                <Users className="size-3.5" /> Nhóm
              </button>
              <button
                type="button"
                onClick={() => setTab("direct")}
                className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm text-sm ${
                  tab === "direct" ? "bg-surface font-medium text-ink shadow-sm" : "text-muted"
                }`}
              >
                Tin nhắn riêng
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm hội thoại..."
                className="h-8 pl-8 text-sm"
              />
            </div>
            {/* Tạo nhóm mới — chỉ Admin (GĐ 72) */}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => {
                  setNewGroupName("");
                  setNewMemberIds([]);
                  setIsCreateOpen(true);
                }}
              >
                <CirclePlus className="size-4" /> Nhóm mới
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {filteredConversations.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-faint">
                Không tìm thấy hội thoại.
              </p>
            ) : (
              filteredConversations.map((c) => {
                const active =
                  tab === "group" ? c.id === groupId : c.id === peerId;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      if (c.type === "mygroup") {
                        setTab("group");
                        setGroupId(c.id);
                        setPeerId(null);
                      } else {
                        setTab("direct");
                        setPeerId(c.id);
                        setGroupId(null);
                      }
                      setMobileView("chat");
                    }}
                    className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
                      active ? "bg-accent/10" : "hover:bg-surface-2"
                    }`}
                  >
                    {c.type === "mygroup" ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                        <Users className="size-4" />
                      </span>
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                        {c.name
                          .split(" ")
                          .map((w) => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {c.last
                          ? c.last.attachments && c.last.attachments.length > 0
                            ? c.last.text
                              ? c.last.text
                              : "📎 Đính kèm"
                            : c.last.text.startsWith("http") && !c.last.text.includes(" ")
                              ? "📎 Đính kèm"
                              : c.last.text
                          : tab === "direct"
                            ? "Bắt đầu nhắn..."
                            : "Chưa có tin"}
                      </span>
                    </span>
                    {c.last && (
                      <span className="shrink-0 text-[10px] text-faint">
                        {fmtTime(c.last.at)}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Cột phải: cửa sổ chat ── */}
        <section
          className={`flex min-w-0 flex-1 flex-col ${
            mobileView === "chat" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Header cửa sổ chat */}
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="mr-1 flex size-8 items-center justify-center rounded-md hover:bg-surface-2 md:hidden"
              aria-label="Quay lại"
            >
              <ArrowLeft className="size-4" />
            </button>
            {/* GĐ 94: nút ⭐ Tin đã lưu — đếm số tin đánh dấu */}
            {starredMsgs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStarred(true)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-surface-2"
                title="Tin đã lưu (đánh dấu)"
              >
                <Star className="size-3.5 fill-amber-400 text-amber-500" /> {starredMsgs.length}
              </button>
            )}
            {tab === "group" ? (
              groupId && activeGroup ? (
                <>
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-white">
                    <Users className="size-4" />
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setMemberDialog(groupId)}
                    title="Xem thành viên"
                  >
                    <p className="truncate text-sm font-semibold text-ink">{activeGroup.name}</p>
                    <p className="text-xs text-muted">
                      Nhóm riêng • {activeGroup.members.length} thành viên
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMemberDialog(groupId)}
                  >
                    <UserPlus className="size-4" /> Thành viên
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted">Chọn một hội thoại để bắt đầu</p>
              )
            ) : peerId ? (
              (() => {
                const peer = employees.find((e) => e.id === peerId);
                return (
                  <>
                    <span className="flex size-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                      {(peer?.name ?? "?")
                        .split(" ")
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {peer?.name ?? "Đang tải..."}
                      </p>
                      <p className="truncate text-xs text-muted">{peer?.title ?? ""}</p>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="text-sm text-muted">Chọn một hội thoại để bắt đầu</p>
            )}
          </div>

          {/* GĐ 94: banner tin GHIM — đầu hội thoại, bấm cuộn tới tin */}
          {pinnedMsg && !multiSelect && (
            <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-1.5">
              <Pin className="size-3.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{pinnedMsg.text || "📎 Đính kèm"}</p>
                <p className="text-[10px] text-faint">Được ghim bởi {pinnedMsg.pinnedBy || "không rõ"}</p>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById(`msg-${pinnedMsg.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="shrink-0 text-[11px] font-medium text-accent hover:underline"
              >
                Xem
              </button>
              <button
                type="button"
                onClick={() => togglePin(pinnedMsg.id)}
                className="shrink-0 text-faint hover:text-ink"
                title="Bỏ ghim"
                aria-label="Bỏ ghim tin nhắn"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* GĐ 94: mode CHỌN NHIỀU — thanh tác vụ trên cùng */}
          {multiSelect && (
            <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-4 py-2">
              <button
                type="button"
                onClick={() => { setMultiSelect(false); setSelectedIds([]); }}
                className="flex size-7 items-center justify-center rounded hover:bg-surface"
                aria-label="Thoát chọn nhiều"
              >
                <X className="size-4" />
              </button>
              <p className="flex-1 text-sm font-medium text-ink">Đã chọn {selectedIds.length} tin</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => { for (const id of selectedIds) deleteForMe(id); toast.success(`Đã xóa ${selectedIds.length} tin ở phía tôi`); }}
              >
                <Trash2 className="size-3.5" /> Xóa phía tôi
              </Button>
            </div>
          )}

          {/* Vùng tin nhắn */}
          {/* GĐ 97: vùng tin nhắn — ref để cuộn scrollTop (không dùng scrollIntoView) */}
          <div ref={scrollAreaRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
            {(tab === "direct" ? Boolean(peerId) : Boolean(groupId)) &&
              activeMessages.length === 0 && (
                <p className="py-12 text-center text-sm text-faint">
                  {tab === "direct"
                    ? "Chưa có tin nhắn — hãy bắt đầu trước."
                    : "Chưa có tin trong nhóm — hãy nhắn đầu tiên."}
                </p>
              )}
            {activeMessages.map((m, i) => {
              const mine =
                (m.fromId && m.fromId === currentUserId) ||
                normalizePersonKey(m.from) === normalizePersonKey(meName);
              const prev = activeMessages[i - 1];
              const newDay =
                !prev || prev.at.slice(0, 10) !== m.at.slice(0, 10);
              const showTime =
                newDay ||
                !prev ||
                new Date(m.at.replace(" ", "T")).getTime() -
                  new Date(prev.at.replace(" ", "T")).getTime() >
                  DAY_GAP_MS;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] text-muted">
                        {dayLabel(m.at.slice(0, 10))}
                      </span>
                    </div>
                  )}
                  {showTime && !newDay && (
                    <div className="my-2 flex justify-center">
                      <span className="text-[11px] text-faint">
                        {fmtTime(m.at)}
                      </span>
                    </div>
                  )}
                  <div
                    id={`msg-${m.id}`}
                    className={`group flex items-end gap-1.5 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                    onClick={(e) => {
                      // GĐ 94: mobile không có hover — bấm trực tiếp vào bubble (không phải link/ảnh) mở action bar
                      if (e.target instanceof HTMLAnchorElement) return;
                      setReactBar(reactBar === m.id ? null : m.id);
                      setMsgMenu(null);
                    }}
                  >
                    {/* Nút thu hồi — tin của mình, trong 24h, chưa có đính kèm cũ */}
                    {mine && !m.deletedAt && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Thu hồi tin nhắn này?")) removeMessage(m.id);
                        }}
                        className="mb-1 hidden size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-ink group-hover:flex"
                        title="Thu hồi"
                        aria-label="Thu hồi tin nhắn"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}                    {m.deletedAt ? (
                      <div className="max-w-[80%] rounded-lg bg-surface-2 px-3 py-2 text-sm italic text-faint">
                        Tin nhắn đã được thu hồi
                      </div>
                    ) : (
                      <div
                        className={`relative max-w-[80%] cursor-pointer rounded-lg px-3 py-2 text-sm ${
                          multiSelect && selectedIds.includes(m.id)
                            ? "ring-2 ring-accent"
                            : ""
                        } ${
                          mine
                            ? "bg-accent text-accent-fg"
                            : "bg-surface-2 text-ink"
                        }`}
                        onClick={(e) => {
                          // GĐ 94: mode chọn nhiều — bấm bubble = tick/untick
                          if (multiSelect) {
                            e.stopPropagation();
                            setSelectedIds((prev) =>
                              prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                            );
                            return;
                          }
                        }}
                      >
                        {/* GĐ 94: nhãn CHUYỂN TIẾP — tin forward hiển thị nguồn gốc */}
                        {m.forwardedFrom && (
                          <p className={`mb-1 flex items-center gap-1 text-[11px] italic ${mine ? "text-accent-fg/80" : "text-muted"}`}>
                            <Forward className="size-3" /> Chuyển tiếp từ {m.forwardedFrom}
                          </p>
                        )}
                        {!mine && (
                          <p className="text-[11px] font-medium text-muted">
                            {senderLabel(m)}
                          </p>
                        )}
                        {/* GĐ 94: quote tin được TRẢ LỜI — tên + nội dung rút gọn, viền trái */}
                        {(() => {
                          const src = m.replyToId ? messages.find((x) => x.id === m.replyToId) : null;
                          if (!src) return null;
                          return (
                            <div
                              className={`mb-1.5 cursor-pointer border-l-2 pl-2 ${
                                mine ? "border-accent-fg/50" : "border-accent/50"
                              }`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                document.getElementById(`msg-${src.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }}
                              title="Bấm để xem tin gốc"
                            >
                              <p className={`text-[11px] font-semibold ${mine ? "text-accent-fg/90" : "text-accent"}`}>
                                {employees.find((e2) => e2.id === src.fromId)?.name ?? src.from}
                              </p>
                              <p className={`truncate text-xs ${mine ? "text-accent-fg/70" : "text-muted"}`}>
                                {src.text || "📎 Đính kèm"}
                              </p>
                            </div>
                          );
                        })()}
                        {m.attachments && m.attachments.length > 0 ? (
                          <div className="mt-0.5 space-y-1">
                            {m.attachments.map((url) =>
                              isImageUrl(url) ? (
                                <img
                                  key={url}
                                  src={url}
                                  alt="Đính kèm"
                                  className="max-h-52 cursor-zoom-in rounded-md object-cover"
                                  onLoad={() => scrollToBottom(false)}
                                  onClick={() => setLightbox(url)}
                                />
                              ) : (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs ${
                                    mine
                                      ? "border-accent-fg/30 text-accent-fg hover:bg-accent-fg/10"
                                      : "border-line text-ink hover:bg-surface"
                                  }`}
                                >
                                  <Paperclip className="size-3.5 shrink-0" />
                                  <span className="max-w-45 truncate underline">
                                    {fileIconLabel(url)}
                                  </span>
                                </a>
                              ),
                            )}
                          </div>
                        ) : m.text.startsWith("http") && !m.text.includes(" ") ? (
                          /* Tin riêng 1 URL — coi như đính kèm (tin cũ trước khi có cột attachments) */
                          isImageUrl(m.text) ? (
                            <img
                              src={m.text}
                              alt="Đính kèm"
                              className="mt-0.5 max-h-52 cursor-zoom-in rounded-md object-cover"
                              onClick={() => setLightbox(m.text)}
                            />
                          ) : (
                            <a
                              href={messageLinkHref(m.text)}
                              target="_blank"
                              rel="noreferrer"
                              className={`mt-0.5 flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs ${
                                mine
                                  ? "border-accent-fg/30 text-accent-fg hover:bg-accent-fg/10"
                                  : "border-line text-ink hover:bg-surface"
                              }`}
                            >
                              <Paperclip className="size-3.5 shrink-0" />
                              <span className="max-w-45 truncate underline">
                                {fileIconLabel(m.text)}
                              </span>
                            </a>
                          )
                        ) : (
                          /* GĐ 77: tô đậm @Tên — người bị tag thấy tên mình nổi bật hơn */
                          <p className="mt-0.5 whitespace-pre-wrap">
                            {renderTextWithMentions(m.text, m.mentions, employees, currentUserId, mine)}
                          </p>
                        )}
                        <p
                          className={`mt-1 text-right text-[10px] ${
                            mine ? "text-accent-fg/70" : "text-faint"
                          }`}
                        >
                          {fmtTime(m.at)}
                        </p>
                        {/* GĐ 94: tổng hợp reaction — góc dưới bubble (như Zalo) */}
                        {(m.reactions?.length ?? 0) > 0 && (
                          <div className={`absolute -bottom-2.5 ${mine ? "right-2" : "left-2"} flex items-center gap-0.5 rounded-full border border-line bg-surface px-1.5 py-0.5 text-[11px] shadow-sm`}>
                            {Object.entries(
                              (m.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
                                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                                return acc;
                              }, {}),
                            ).map(([emoji, count]) => (
                              <span key={emoji}>
                                {emoji}
                                {count > 1 ? ` ${count}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* GĐ 94: 3 nút nhanh — Trả lời · Chuyển tiếp · ... (hover desktop; mobile bấm bubble) */}
                    {!m.deletedAt && !multiSelect && (
                      <span className="mb-1 hidden shrink-0 items-center gap-0.5 group-hover:flex">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startReply(m.id); }}
                          className="flex size-6 items-center justify-center rounded-full bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-ink"
                          title="Trả lời"
                          aria-label="Trả lời tin nhắn"
                        >
                          <CornerUpLeft className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setForwardMsg(m.text || "📎 Đính kèm"); setForwardTarget(""); setMsgMenu(null); }}
                          className="flex size-6 items-center justify-center rounded-full bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-ink"
                          title="Chuyển tiếp"
                          aria-label="Chuyển tiếp tin nhắn"
                        >
                          <Forward className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMsgMenu(msgMenu === m.id ? null : m.id); setReactBar(null); }}
                          className={`flex size-6 items-center justify-center rounded-full shadow-sm ${msgMenu === m.id ? "bg-accent text-white" : "bg-surface text-muted hover:bg-surface-2 hover:text-ink"}`}
                          title="Lựa chọn khác"
                          aria-label="Lựa chọn khác"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setReactBar(reactBar === m.id ? null : m.id); setMsgMenu(null); }}
                          className={`flex size-6 items-center justify-center rounded-full shadow-sm ${reactBar === m.id ? "bg-accent text-white" : "bg-surface text-muted hover:bg-surface-2 hover:text-ink"}`}
                          title="Cảm xúc"
                          aria-label="Thả cảm xúc"
                        >
                          <Smile className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                  {/* GĐ 94: thanh 6 quick emoji — hiện dưới bubble khi bấm nút cảm xúc */}
                  {reactBar === m.id && (
                    <div className={`relative z-10 -mt-1 mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface px-2 py-1 shadow-md">
                        {QUICK_EMOJIS.map((em) => {
                          const activeR = m.reactions?.find((r) => r.employeeId === currentUserId)?.emoji === em;
                          return (
                            <button
                              key={em}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleReaction(m.id, em); }}
                              className={`flex size-8 items-center justify-center rounded-full text-lg transition hover:scale-125 hover:bg-surface-2 ${activeR ? "bg-accent-soft" : ""}`}
                              title={em}
                            >
                              {em}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* GĐ 94: menu "..." — dropdown 6 mục như Zalo */}
                  {msgMenu === m.id && (
                    <div className={`relative z-10 -mt-1 mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(m.text); toast.success("Đã copy tin nhắn"); setMsgMenu(null); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        >
                          <Copy className="size-4 text-muted" /> Copy tin nhắn
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePin(m.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        >
                          <Pin className={`size-4 ${m.pinned ? "text-accent" : "text-muted"}`} /> {m.pinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStar(m.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        >
                          <Star className={`size-4 ${(m.starredBy ?? []).includes(currentUserId) ? "fill-amber-400 text-amber-500" : "text-muted"}`} /> {(m.starredBy ?? []).includes(currentUserId) ? "Bỏ đánh dấu" : "Đánh dấu tin nhắn"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMultiSelect(true); setSelectedIds([m.id]); setMsgMenu(null); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        >
                          <CheckSquare className="size-4 text-muted" /> Chọn nhiều tin nhắn
                        </button>
                        <button
                          type="button"
                          onClick={() => { saveAttachmentsToDisk(m.id); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        >
                          <Download className="size-4 text-muted" /> Lưu về máy
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDetailMsg(m.id); setMsgMenu(null); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                        >
                          <Info className="size-4 text-muted" /> Xem chi tiết
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteForMe(m.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" /> Xóa chỉ ở phía tôi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Ô soạn tin */}
          <form onSubmit={submit} className="border-t border-line p-3">
            {/* GĐ 94: preview tin đang TRẢ LỜI — above input, nút X hủy */}
            {(() => {
              const src = replyTo ? messages.find((x) => x.id === replyTo) : null;
              if (!src) return null;
              return (
                <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5">
                  <CornerUpLeft className="size-3.5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-accent">
                      Đang trả lời {employees.find((e2) => e2.id === src.fromId)?.name ?? src.from}
                    </p>
                    <p className="truncate text-xs text-muted">{src.text || "📎 Đính kèm"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-surface hover:text-ink"
                    aria-label="Hủy trả lời"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })()}
            {/* GĐ 77: dropdown @mention — gõ "@" hoặc bấm nút @ trong nhóm để chọn người.
                GĐ 246: luôn có mục @All đầu danh sách (nhắc cả nhóm); dropdown vẫn hiện
                kể cả khi không có tên khớp query để @All luôn chọn được. */}
            {mentionQuery !== null && tab === "group" && (
              <div className="mb-2 max-h-44 overflow-y-auto rounded-md border border-line bg-surface shadow-md">
                {/* GĐ 246: @All — tag TẤT CẢ mọi người trong nhóm, luôn đứng đầu */}
                <button
                  type="button"
                  onClick={pickMentionAll}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    @
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    All
                    <span className="ml-1.5 text-xs font-normal text-muted">nhắc cả nhóm</span>
                  </span>
                </button>
                {mentionCandidates.length === 0 && (
                  <p className="px-2.5 py-1.5 text-xs text-faint">
                    Không có tên khớp — gõ tiếp hoặc chọn All
                  </p>
                )}
                {mentionCandidates.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pickMention(e.id, e.name)}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left hover:bg-surface-2"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[9px] font-semibold text-accent">
                      {e.name
                        .split(" ")
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {e.name}
                      <span className="ml-1.5 text-xs text-muted">{e.dept}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((url) => (
                  <span
                    key={url}
                    className="relative inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-muted"
                  >
                    <Paperclip className="size-3" />
                    <span className="max-w-40 truncate">{fileIconLabel(url)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((u) => u !== url))
                      }
                      className="ml-0.5 text-faint hover:text-ink"
                      aria-label="Bỏ tệp"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {/* GĐ 246: nút @ — mở dropdown chọn người để tag ngay, không cần gõ "@" */}
              {tab === "group" && canSend && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => setMentionQuery((prev) => (prev === null ? "" : null))}
                  aria-label="Tag thành viên (@)"
                  title="Tag thành viên (@) — chọn @All để nhắc cả nhóm"
                >
                  <AtSign className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={uploading || !canSend}
                onClick={() => fileRef.current?.click()}
                aria-label="Đính kèm tệp"
                title={uploading ? "Đang tải lên..." : "Đính kèm ảnh / tệp"}
              >
                <ImagePlus className="size-4" />
              </Button>
              <Input
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={
                  !canSend
                    ? "Chọn một hội thoại..."
                    : tab === "direct"
                      ? `Nhắn ${employees.find((e) => e.id === peerId)?.name ?? ""}...`
                      : `Nhắn nhóm ${activeGroup?.name ?? ""}... (gõ @ để nhắc ai đó)`
                }
                disabled={!canSend}
              />
              <Button
                type="submit"
                size="icon"
                disabled={uploading || !canSend}
                aria-label="Gửi"
              >
                <Send />
              </Button>
            </div>
          </form>
        </section>
      </div>

      {/* ── Dialog tạo nhóm mới (chỉ Admin — GĐ 72) ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Tạo nhóm mới</DialogTitle>
          <DialogDesc>Nhập tên nhóm và chọn thành viên — chỉ thành viên mới thấy nhóm.</DialogDesc>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newGroupName.trim()) {
                toast.error("Nhập tên nhóm");
                return;
              }
              addChatGroup(newGroupName.trim(), newMemberIds);
              toast.success(`Đã tạo nhóm "${newGroupName.trim()}"`);
              setIsCreateOpen(false);
            }}
            className="mt-3 space-y-3"
          >
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Tên nhóm (VD: Nhóm Long Biên)"
              autoFocus
            />
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">
                Thành viên ({newMemberIds.length} đã chọn)
              </p>
              <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border border-line p-1.5">
                {employees
                  .filter((e) => e.id !== currentUserId)
                  .map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={newMemberIds.includes(e.id)}
                        onChange={(ev) =>
                          setNewMemberIds((prev) =>
                            ev.target.checked
                              ? [...prev, e.id]
                              : prev.filter((id) => id !== e.id),
                          )
                        }
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {e.name}
                        <span className="ml-1.5 text-xs text-muted">{e.dept}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit">Tạo nhóm</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog thành viên nhóm (GĐ 72) ── */}
      <Dialog
        open={Boolean(memberDialog)}
        onOpenChange={(open) => setMemberDialog(open ? memberDialog : null)}
      >
        <DialogContent className="max-w-md">
          {(() => {
            const g = chatGroups.find((x) => x.id === memberDialog);
            if (!g) return null;
            const amOwner = g.createdBy === currentUserId;
            // Owner + Admin được thêm/xóa member (chốt của Đại ca)
            const canManage = amOwner || isAdmin;
            // GĐ 77: Owner/Admin được đổi tên nhóm
            const canRename = amOwner || isAdmin;
            const nonMembers = employees.filter(
              (e) => e.id !== currentUserId && !g.members.some((m) => m.employeeId === e.id),
            );
            return (
              <>
                {/* GĐ 77: đổi tên nhóm — nút ✏️ cạnh tên (Owner/Admin), form inline */}
                {renameOpen ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const newName = renameValue.trim();
                      if (!newName) {
                        toast.error("Nhập tên nhóm");
                        return;
                      }
                      renameChatGroup(g.id, newName);
                      toast.success(`Đã đổi tên nhóm thành "${newName}"`);
                      setRenameOpen(false);
                    }}
                    className="mt-1 flex items-center gap-2"
                  >
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Tên nhóm mới"
                      autoFocus
                    />
                    <Button type="submit" size="sm">Lưu</Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRenameOpen(false)}
                    >Hủy</Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <DialogTitle>{g.name}</DialogTitle>
                    {canRename && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenameValue(g.name);
                          setRenameOpen(true);
                        }}
                        className="flex size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-ink"
                        title="Đổi tên nhóm"
                        aria-label="Đổi tên nhóm"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <DialogDesc>
                  Nhóm riêng • {g.members.length} thành viên
                  {amOwner ? " • Bạn là chủ nhóm" : ""}
                </DialogDesc>
                <div className="mt-3 space-y-0.5">
                  {g.members.map((m) => {
                    const emp = employees.find((e) => e.id === m.employeeId);
                    return (
                      <div
                        key={m.employeeId}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-2"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
                          {(emp?.name ?? "?")
                            .split(" ")
                            .map((w) => w[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {emp?.name ?? m.employeeId}
                          <span className="ml-1.5 text-xs text-muted">{emp?.dept ?? ""}</span>
                        </span>
                        {m.role === "owner" && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            <Crown className="size-3" /> Chủ nhóm
                          </span>
                        )}
                        {canManage && m.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => {
                              removeGroupMember(g.id, m.employeeId);
                              toast.success(`Đã xóa ${emp?.name ?? "thành viên"} khỏi nhóm`);
                            }}
                            className="flex size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-surface hover:text-ink"
                            title="Xóa khỏi nhóm"
                            aria-label="Xóa khỏi nhóm"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {canManage && nonMembers.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted">Thêm thành viên</p>
                    <div className="max-h-40 space-y-0.5 overflow-y-auto">
                      {nonMembers.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            addGroupMembers(g.id, [e.id]);
                            toast.success(`Đã thêm ${e.name} vào nhóm`);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-2"
                        >
                          <UserPlus className="size-4 shrink-0 text-accent" />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {e.name}
                            <span className="ml-1.5 text-xs text-muted">{e.dept}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(amOwner || isAdmin) && (
                  <div className="mt-3 flex justify-between border-t border-line pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={() => {
                        if (confirm(`Giải tán nhóm "${g.name}"? Tin nhắn sẽ bị ẩn với mọi người.`)) {
                          removeChatGroup(g.id);
                          setMemberDialog(null);
                          if (groupId === g.id) {
                            setGroupId(null);
                          }
                          toast.success(`Đã giải tán nhóm "${g.name}"`);
                        }
                      }}
                    >
                      <LogOut className="size-4" /> Giải tán nhóm
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── GĐ 94: dialog CHUYỂN TIẾP tin ── */}
      <Dialog open={forwardMsg !== null} onOpenChange={(v) => !v && setForwardMsg(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Chuyển tiếp tin nhắn</DialogTitle>
          <DialogDesc>
            Chọn người nhận — tin sẽ gửi kèm nhãn "Chuyển tiếp từ {me?.name ?? "..."}".
          </DialogDesc>
          <p className="mt-2 max-h-20 overflow-hidden rounded-md border border-line bg-surface-2 p-2 text-xs text-muted">
            {forwardMsg}
          </p>
          <div className="mt-3 max-h-64 space-y-0.5 overflow-y-auto">
            {employees
              .filter((e) => e.id !== currentUserId)
              .map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setForwardTarget(e.id)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-2 ${
                    forwardTarget === e.id ? "ring-1 ring-accent" : ""
                  }`}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
                    {e.name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.name}</span>
                  {forwardTarget === e.id && <span className="text-xs font-medium text-accent">✓</span>}
                </button>
              ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setForwardMsg(null)}>Hủy</Button>
            <Button type="button" disabled={!forwardTarget} onClick={doForward}>
              <Forward className="size-4" /> Chuyển tiếp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── GĐ 94: dialog XEM CHI TIẾT tin nhắn — bổ sung đủ theo yêu cầu Đại ca:
          reaction + trả lời (tin gốc + tin phản hồi) + chuyển tiếp + đính kèm + loại hội thoại ── */}
      <Dialog open={detailMsg !== null} onOpenChange={(v) => !v && setDetailMsg(null)}>
        <DialogContent className="max-w-md">
          {(() => {
            const m = messages.find((x) => x.id === detailMsg);
            if (!m) return null;
            const sender = employees.find((e) => e.id === m.fromId);
            const reactionList = m.reactions ?? [];
            // Tin gốc đang được trả lời (nếu tin này là reply)
            const repliedSrc = m.replyToId ? messages.find((x) => x.id === m.replyToId) : null;
            // Các tin ĐÃ TRẢ LỜI tin này
            const replyList = messages.filter((x) => x.replyToId === m.id && !x.deletedAt);
            const convLabel = m.groupId
              ? `Nhóm ${chatGroups.find((g) => g.id === m.groupId)?.name ?? ""}`
              : (() => {
                  const peerId2 = (m.directKey ?? "").split("|").find((id) => id !== (m.fromId ?? ""));
                  const peer = employees.find((e) => e.id === (m.fromId === currentUserId ? peerId2 : m.fromId));
                  return peer ? `Tin nhắn riêng với ${peer.name}` : "Tin nhắn riêng";
                })();
            return (
              <>
                <DialogTitle>Chi tiết tin nhắn</DialogTitle>
                <DialogDesc>{convLabel}</DialogDesc>
                <div className="mt-3 space-y-2.5 text-sm">
                  <p className="rounded-lg border border-line bg-surface-2/50 p-3 whitespace-pre-wrap text-ink">
                    {m.text || "📎 Đính kèm"}
                  </p>
                  {(m.attachments?.length ?? 0) > 0 && (
                    <p>
                      <span className="text-muted">Đính kèm:</span>{" "}
                      <span className="text-ink">{m.attachments!.length} tệp</span>
                      <span className="ml-1.5 flex flex-wrap gap-1">
                        {m.attachments!.map((url) =>
                          isImageUrl(url) ? (
                            <img
                              key={url}
                              src={url}
                              alt="Đính kèm"
                              className="size-10 cursor-zoom-in rounded border border-line object-cover"
                              onClick={() => { setDetailMsg(null); setLightbox(url); }}
                            />
                          ) : (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-accent hover:underline"
                            >
                              {fileIconLabel(url)}
                            </a>
                          ),
                        )}
                      </span>
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <p><span className="text-muted">Người gửi:</span> <span className="font-medium text-ink">{sender?.name ?? m.from}</span></p>
                    <p><span className="text-muted">Thời gian:</span> <span className="tabular text-ink">{m.at}</span></p>
                  </div>
                  {/* GĐ 95: Lưu về máy — tải đính kèm với tên file gốc */}
                  {((m.attachments?.length ?? 0) > 0 || (m.text.startsWith("http") && !m.text.includes(" "))) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => saveAttachmentsToDisk(m.id)}
                    >
                      <Download className="size-4" /> Lưu về máy
                    </Button>
                  )}
                  {/* GĐ 95: tin này là TRẢ LỜI — quote tin gốc */}
                  {repliedSrc && (
                    <div className="border-l-2 border-accent/50 pl-2">
                      <p className="text-xs text-muted">Đang trả lời:</p>
                      <p className="text-xs font-medium text-accent">
                        {employees.find((e) => e.id === repliedSrc.fromId)?.name ?? repliedSrc.from}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted">{repliedSrc.text || "📎 Đính kèm"}</p>
                      <button
                        type="button"
                        onClick={() => { setDetailMsg(null); document.getElementById(`msg-${repliedSrc.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                        className="mt-0.5 text-[11px] text-accent hover:underline"
                      >
                        Xem tin gốc →
                      </button>
                    </div>
                  )}
                  {/* GĐ 95: các tin ĐÃ TRẢ LỜI tin này */}
                  {replyList.length > 0 && (
                    <div className="border-l-2 border-line pl-2">
                      <p className="text-xs text-muted">Được trả lời bởi ({replyList.length}):</p>
                      {replyList.slice(0, 3).map((r) => (
                        <p key={r.id} className="truncate text-xs text-ink">
                          <span className="font-medium">{employees.find((e) => e.id === r.fromId)?.name ?? r.from}:</span>{" "}
                          {r.text || "📎 Đính kèm"}
                        </p>
                      ))}
                      {replyList.length > 3 && (
                        <p className="text-[11px] text-faint">…và {replyList.length - 3} tin khác</p>
                      )}
                    </div>
                  )}
                  {m.forwardedFrom ? (
                    <p><span className="text-muted">Chuyển tiếp từ:</span> <span className="text-ink">{m.forwardedFrom}</span></p>
                  ) : null}
                  {m.pinned ? (
                    <p><span className="text-muted">Ghim:</span> <span className="text-ink">bởi {m.pinnedBy || "không rõ"}</span></p>
                  ) : null}
                  <div>
                    <p className="text-muted">
                      Cảm xúc {reactionList.length > 0 ? <span className="font-medium text-ink">({reactionList.length})</span> : ""}:
                    </p>
                    {reactionList.length === 0 ? (
                      <p className="text-faint">Chưa có</p>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        {reactionList.map((r, idx) => (
                          <p key={`${r.employeeId}-${idx}`} className="text-ink">
                            <span className="text-base">{r.emoji}</span>{" "}
                            {employees.find((e) => e.id === r.employeeId)?.name ?? "?"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <p>
                    <span className="text-muted">Đánh dấu ⭐:</span>{" "}
                    {(m.starredBy ?? []).length === 0 ? (
                      <span className="text-faint">Chưa ai</span>
                    ) : (
                      <span className="text-ink">{(m.starredBy ?? []).map((id) => employees.find((e) => e.id === id)?.name ?? id).join(", ")}</span>
                    )}
                  </p>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── GĐ 94: popup TIN ĐÃ LƯU (đánh dấu ⭐) ── */}
      <Dialog open={showStarred} onOpenChange={setShowStarred}>
        <DialogContent className="max-w-md">
          <DialogTitle>Tin đã lưu ⭐</DialogTitle>
          <DialogDesc>Các tin nhắn bạn đã đánh dấu — lưu theo tài khoản, mọi thiết bị.</DialogDesc>
          <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
            {starredMsgs.length === 0 ? (
              <p className="py-6 text-center text-sm text-faint">Chưa có tin nào được đánh dấu.</p>
            ) : (
              starredMsgs.map((m) => {
                const sender = employees.find((e) => e.id === m.fromId);
                return (
                  <div key={m.id} className="rounded-md border border-line p-2">
                    <p className="text-[11px] font-semibold text-accent">
                      {sender?.name ?? m.from}
                      <span className="ml-1.5 font-normal text-faint">
                        {m.groupId ? chatGroups.find((g) => g.id === m.groupId)?.name ?? "Nhóm" : "Tin nhắn riêng"} · {m.at}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink">{m.text || "📎 Đính kèm"}</p>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStar(m.id)}
                        className="text-[11px] text-muted hover:text-red-600 hover:underline"
                      >
                        Bỏ đánh dấu
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox ảnh nền trắng (pattern GĐ 65) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-white/95"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Xem ảnh"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/10 text-ink hover:bg-black/20"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** URL đính kèm dạng text (tin cũ) → href an toàn */
function messageLinkHref(url: string): string {
  return url;
}

/**
 * GĐ 77: render text với @Tên được tô đậm — người bị tag thấy tên mình
 * nổi bật (vien + nền nhấn) trong bubble, cả tin của mình lẫn người khác.
 * Map theo mentions ID (chính xác) — fallback regex @Tên nếu tin cũ không có ID.
 */
function renderTextWithMentions(
  text: string,
  mentions: string[] | undefined,
  employees: Array<{ id: string; name: string }>,
  currentUserId: string,
  mine: boolean,
): React.ReactNode {
  if (!text.includes("@")) return text;
  // Tập hợp tên cần tô đậm: tên employee theo mentions ID + tên chính mình (fallback)
  const mentionedNames = new Set<string>();
  for (const id of mentions ?? []) {
    const emp = employees.find((e) => e.id === id);
    if (emp) mentionedNames.add(emp.name);
  }
  // Tách text thành phần thường + phần @Tên
  const parts: React.ReactNode[] = [];
  const regex = /@([^@\n,.;!?]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    const rawName = match[1].trim();
    // GĐ 246: @All = tag cả nhóm — tô đậm như tag người thật
    const isAll = /^all$/i.test(rawName);
    const hit =
      isAll ||
      mentionedNames.has(rawName) ||
      [...mentionedNames].some((n) => n.startsWith(rawName) && rawName.length >= 2) || // gõ @Cường khớp @CườngPK
      rawName === currentUserId;
    // Chỉ tô đậm nếu tên khớp người được mention (hoặc chính mình trong tin không có mentions ID)
    const isMe = employees.find(
      (e) => e.id === currentUserId && (e.name === rawName || rawName.length >= 2 && e.name.startsWith(rawName)),
    ) && (mentions ?? []).length === 0;
    if (!hit && !isMe) continue;
    parts.push(text.slice(last, match.index));
    parts.push(
      <span
        key={`m-${key++}`}
        className={`rounded px-0.5 font-semibold ${
          mine ? "bg-white/25 text-white" : "bg-accent/15 text-accent"
        }`}
      >
        @{rawName}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(last));
  return parts;
}
