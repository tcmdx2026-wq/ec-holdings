/**
 * Employee add/edit form — clean rewrite.
 * Includes password management for Admin.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import type { Employee } from "@/lib/types";
import { insertEmployee, updateEmployee, resetEmployeePassword } from "@/routes/api/employee-crud";

const EMPTY: Employee = {
  id: "", name: "", username: "", gender: "Nam", phone: "", email: "",
  dept: "", role: "User", title: "", center: "VP", status: "Đang làm việc",
};

type Props = {
  open: boolean;
  editing: Employee | null;
  onClose: () => void;
  onSaved: () => void;
};

export function EmployeeForm({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Employee>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState("");
  const centers = useAppStore((s) => s.centers);

  // Reset form when editing changes (proper useEffect, not in render body)
  useEffect(() => {
    if (editing) {
      setForm(editing);
    } else if (open) {
      setForm(EMPTY);
    }
  }, [editing, open]);

  if (!open) return null;

  const set = (field: keyof Employee, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nhập họ tên"); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateEmployee({ data: { id: editing.id, name: form.name, username: form.username, gender: form.gender, phone: form.phone, email: form.email, department: form.dept, role: form.role, title: form.title, center: form.center } });
        toast.success(`Đã cập nhật ${form.name}`);
      } else {
        await insertEmployee({ data: { name: form.name, username: form.username, gender: form.gender, phone: form.phone, email: form.email, department: form.dept, role: form.role, title: form.title, center: form.center } });
        toast.success(`Đã thêm ${form.name}`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Lỗi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (pwd.length < 8) { toast.error("Mật khẩu ít nhất 8 ký tự"); return; }
    if (!editing?.email) { toast.error("Không có email"); return; }
    try {
      await resetEmployeePassword({ data: { email: editing.email, newPassword: pwd } });
      toast.success(`Đã đặt lại mật khẩu cho ${editing.name}`);
      setPwd("");
    } catch (err: any) {
      toast.error(err?.message ?? "Lỗi đặt lại mật khẩu");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-ink">{editing ? "Sửa nhân sự" : "Thêm nhân sự mới"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Họ tên</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1" /></div>
          <div><Label>Tài khoản</Label><Input value={form.username} onChange={(e) => set("username", e.target.value)} className="mt-1" /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" /></div>
          <div><Label>SĐT</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1" /></div>
          <div><Label>Giới tính</Label><select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"><option>Nam</option><option>Nữ</option></select></div>
          <div><Label>Chức danh</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} className="mt-1" /></div>
          <div><Label>Bộ phận</Label><Input value={form.dept} onChange={(e) => set("dept", e.target.value)} className="mt-1" /></div>
          <div><Label>Đơn vị (center)</Label><select value={form.center} onChange={(e) => set("center", e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm">{[...centers].sort((a, b) => a.code.localeCompare(b.code)).map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></div>
          <div><Label>Vai trò</Label><select value={form.role} onChange={(e) => set("role", e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"><option>User</option><option>Admin</option><option>SuperAdmin</option></select></div>
        </div>

        {/* Password section — Admin only, edit mode */}
        {editing && (
          <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
            <p className="mb-3 text-sm font-medium text-ink">Đặt lại mật khẩu</p>
            <div className="flex gap-2">
              <Input type="password" placeholder="Mật khẩu mới (ít nhất 8 ký tự)" minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} className="flex-1" />
              <Button size="sm" variant="outline" onClick={handleResetPassword} disabled={saving}>Đặt lại</Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : editing ? "Lưu" : "Thêm"}</Button>
        </div>
      </div>
    </div>
  );
}
