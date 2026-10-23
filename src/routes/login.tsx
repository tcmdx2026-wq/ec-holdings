import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled, signIn, GROK_PROVIDERS } from "@/lib/auth/client";
import { checkEmailPending, checkEmailRejected, createRegRequest, autoApproveCatalogEmployee, ensureAuthUser } from "@/routes/api/registrations";
import { getEmployeeByEmail } from "@/lib/catalog";

const REMEMBER_KEY = "giong-vn-login-remember";

/** GĐ 251 (29/09 — lần 2 Anh bị "sai mật khẩu" sau push): signIn fail có 2 bản chất
 * KHÁC NHAU — (a) sai thông tin thật, (b) HẠ TẦNG DB mất (tunnel chết ngầm → Better
 * Auth không đọc được GiondDB, từng diễn ra 18/09 + 29/09 00:15). Thông báo nhầm làm
 * Anh tưởng mật khẩu sai. Phân biệt: ping /api/auth/get-session (nhẹ, ~0.4s khi sống);
 * 5xx/timeout = hạ tầng xuống — báo đúng bản chất, KHÔNG đổ lỗi thông tin đăng nhập. */
async function isInfraDown(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/get-session", { cache: "no-store" });
    return res.status >= 500;
  } catch {
    return true; // fetch throw = mạng/server function không phản hồi
  }
}

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  // Chặn submit sớm trước khi hydrate xong — bấm/Enter lúc SSR-only sẽ native submit vô hiệu
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { email?: string; password?: string };
      if (parsed.email) {
        setEmail(parsed.email);
      }
      if (parsed.password) {
        setPassword(parsed.password);
        setRememberMe(true);
      }
    } catch {
      window.localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  function saveRememberedCredentials(nextRemember: boolean) {
    if (!nextRemember) {
      window.localStorage.removeItem(REMEMBER_KEY);
      return;
    }

    window.localStorage.setItem(
      REMEMBER_KEY,
      JSON.stringify({
        email: email.trim(),
        password,
      }),
    );
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!hydrated || !email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      if (isSignUp) {
        // Check if email already has a pending or rejected request
        const pending = await checkEmailPending({ data: { email: email.trim() } });
        if (pending) {
          toast.error("Email này đã có yêu cầu đăng ký đang chờ duyệt");
          return;
        }
        const rejected = await checkEmailRejected({ data: { email: email.trim() } });
        if (rejected) {
          toast.error("Email này đã bị từ chối đăng ký");
          return;
        }

        // Create registration request (pending approval)
        await createRegRequest({
          data: {
            name: name.trim() || email.trim().split("@")[0],
            email: email.trim(),
            password,
          },
        });

        toast.success(
          "Đăng ký thành công! Yêu cầu của bạn đang chờ quản trị viên duyệt."
        );
        
        // Switch to sign-in mode
        setIsSignUp(false);
        setEmail("");
        setPassword("");
        setName("");
        return;
      } else {
        // If email belongs to a catalog employee, auto-approve pending registration
        const catalogEmployee = getEmployeeByEmail(email.trim());
        if (catalogEmployee) {
          try {
            const result = await autoApproveCatalogEmployee({ data: { email: email.trim() } });
            if (result.approved) {
              toast.success(`Đã tự động duyệt cho ${result.name}. Đang đăng nhập...`);
            }
          } catch {
            // Auto-approve failed — proceed to normal signIn anyway
          }
        } else {
          // Pre-check registration status for non-catalog users
          try {
            const pending = await checkEmailPending({ data: { email: email.trim() } });
            if (pending) {
              toast.error("Tài khoản đang chờ quản trị viên duyệt. Vui lòng thử lại sau.");
              return;
            }
            const rejected = await checkEmailRejected({ data: { email: email.trim() } });
            if (rejected) {
              toast.error("Tài khoản đã bị từ chối. Vui lòng liên hệ quản trị viên.");
              return;
            }
          } catch {
            // If DB check fails, proceed to normal signIn (may succeed or fail)
          }
        }

        let { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (error) {
          // signIn failed — try to create Better Auth account on-the-fly for approved registrations
          try {
            const result = await ensureAuthUser({ data: { email: email.trim(), password } });
            console.log("[login] ensureAuthUser result:", result);
            if (result.created) {
              // Retry signIn now that account exists
              const retry = await authClient.signIn.email({ email: email.trim(), password });
              if (!retry.error) {
                saveRememberedCredentials(rememberMe);
                window.location.href = "/";
                return;
              }
              toast.error("Sai email hoặc mật khẩu. Vui lòng kiểm tra lại.");
            } else if (result.error) {
              if (result.error.includes("already")) {
                // User exists but password is wrong
                toast.error("Sai mật khẩu. Vui lòng kiểm tra lại.");
              } else {
                toast.error(`Lỗi: ${result.error}`);
              }
            } else {
              toast.error("Sai email hoặc mật khẩu. Nếu vừa đăng ký, chờ admin duyệt.");
            }
          } catch (err: any) {
            console.error("[login] ensureAuthUser error:", err);
            // GĐ 251: lỗi khi tạo/đọc account — phân biệt hạ tầng trước khi đổ lỗi thông tin
            if (await isInfraDown()) {
              toast.error("Không kết nối được dữ liệu — hệ thống đang mất kết nối máy chủ. Vui lòng thử lại sau ít phút (KHÔNG phải sai mật khẩu).");
            } else {
              toast.error("Sai email hoặc mật khẩu");
            }
          }
          return;
        }
        saveRememberedCredentials(rememberMe);
        window.location.href = "/";
      }
    } catch (err: any) {
      // GĐ 251: signIn throw (mạng/rpc fail) → phân biệt hạ tầng trước khi báo lỗi chung
      if (await isInfraDown()) {
        toast.error("Không kết nối được dữ liệu — hệ thống đang mất kết nối máy chủ. Vui lòng thử lại sau ít phút (KHÔNG phải sai mật khẩu).");
      } else {
        toast.error(err?.message ?? "Lỗi không xác định");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-6rem)] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            EC-HOLDINGS
          </p>
          <h1 className="text-3xl font-semibold text-ink">
            {isSignUp ? "Tạo tài khoản" : "Đăng nhập hệ thống"}
          </h1>
          <p className="text-sm text-muted">
            {isSignUp
              ? "Đăng ký tài khoản mới để truy cập hệ thống."
              : "Sử dụng email và mật khẩu để truy cập chấm công, nhân sự và các module vận hành."}
          </p>
        </div>

        {authEnabled ? (
          <>
            {/* Email / Password Form */}
            <form
              onSubmit={(e) => {
                if (!hydrated) {
                  e.preventDefault();
                  return;
                }
                void handleEmailAuth(e);
              }}
              className="space-y-4"
            >
              {isSignUp && (
                <div>
                  <Label htmlFor="name">Họ và tên</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="mt-1"
                  />
                </div>
              )}
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
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ít nhất 8 ký tự"
                    className="pr-11"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center justify-center text-muted transition hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {!isSignUp ? (
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => {
                        const nextValue = e.target.checked;
                        setRememberMe(nextValue);
                        if (!nextValue) {
                          window.localStorage.removeItem(REMEMBER_KEY);
                        } else {
                          saveRememberedCredentials(true);
                        }
                      }}
                      className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                    />
                    Ghi nhớ mật khẩu
                  </label>
                  <Link to="/forgot-password" className="text-sm text-accent hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !hydrated}
                title={hydrated ? undefined : "Đang tải — vui lòng chờ một nhịp rồi bấm lại"}
              >
                {loading
                  ? "Đang xử lý..."
                  : isSignUp
                    ? "Đăng ký"
                    : "Đăng nhập"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-faint">hoặc</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            {/* Google Sign-In */}
            <div className="space-y-3">
              {GROK_PROVIDERS.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  onClick={() =>
                    signIn(provider.providerId, { callbackURL: "/" })
                  }
                  className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-accent-soft"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-forest-fg/10 text-xs font-bold text-accent">
                    {provider.label.slice(0, 1).toUpperCase()}
                  </span>
                  Tiếp tục với {provider.label}
                </button>
              ))}
            </div>

            {/* Toggle Sign In / Sign Up */}
            <p className="mt-5 text-center text-sm text-muted">
              {isSignUp ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setEmail("");
                  setPassword("");
                  setName("");
                  if (!isSignUp) {
                    setRememberMe(false);
                    window.localStorage.removeItem(REMEMBER_KEY);
                  }
                }}
                className="font-medium text-accent hover:underline"
              >
                {isSignUp ? "Đăng nhập" : "Đăng ký ngay"}
              </button>
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-4 text-sm text-muted">
            Chế độ đăng nhập chưa được bật cho dự án này.
          </div>
        )}
      </div>
    </main>
  );
}
