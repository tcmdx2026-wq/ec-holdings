import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { sendPasswordReset } from "@/routes/api/auth-reset";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const result = await sendPasswordReset({ data: { email: email.trim() } });
      setSent(true);
      setTempPassword(result.tempPassword);
      toast.success("Đã tạo mật khẩu mới thành công!");
    } catch (err: any) {
      toast.error(err?.message ?? "Không tìm thấy tài khoản với email này");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="grid min-h-[calc(100vh-6rem)] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6 space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              EC-HOLDINGS
            </p>
            <h1 className="text-3xl font-semibold text-ink">
              Mật khẩu mới đã được tạo
            </h1>
            <p className="text-sm text-muted">
              Vui lòng sử dụng mật khẩu bên dưới để đăng nhập. Bạn nên đổi mật khẩu ngay sau khi đăng nhập.
            </p>
          </div>

          <Card className="mb-6">
            <div className="space-y-2">
              <p className="text-sm text-muted">Mật khẩu tạm thời:</p>
              <p 
                className="font-mono text-lg font-bold text-accent bg-accent-soft p-3 rounded-lg text-center select-all cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toast.success("Đã copy mật khẩu!");
                }}
              >
                {tempPassword}
              </p>
              <p className="text-xs text-muted text-center">
                Nhấn vào mật khẩu để copy
              </p>
            </div>
          </Card>

          <div className="space-y-3">
            <Link to="/login">
              <Button className="w-full">
                Đăng nhập ngay
              </Button>
            </Link>
            <p className="text-center text-sm text-muted">
              <Link to="/login" className="text-accent hover:underline">
                Quay lại trang đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100vh-6rem)] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            EC-HOLDINGS
          </p>
          <h1 className="text-3xl font-semibold text-ink">
            Quên mật khẩu
          </h1>
          <p className="text-sm text-muted">
            Nhập email đã đăng ký để nhận mật khẩu mới. Mật khẩu tạm thời sẽ được hiển thị trên màn hình.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@congty.vn"
              className="mt-1"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang xử lý..." : "Gửi mật khẩu mới"}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-muted">
          <Link to="/login" className="text-accent hover:underline">
            Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    </main>
  );
}
