import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole,
  Mail, ShieldCheck, Sparkles, User, Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "register" && password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    const result = mode === "login"
      ? await signIn(email, password)
      : await signUp(displayName, email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.requiresEmailConfirmation) {
      setSuccess("验证邮件已发送，请完成验证后返回登录");
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden flex-col justify-between px-12 py-12 text-white lg:flex xl:px-20 xl:py-16">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-lg shadow-indigo-950/30">
              <Zap className="h-5 w-5" fill="currentColor" />
            </div>
            <div>
              <div className="font-semibold tracking-wide">愿景追踪</div>
              <div className="text-xs text-slate-400">把十年愿景，变成今天的行动</div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-indigo-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              你的长期成长工作台
            </div>
            <h1 className="text-5xl font-semibold leading-[1.13] tracking-tight xl:text-6xl">
              每一次专注，<br />都在靠近未来的你。
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              用愿景校准方向，用计划拆解路径，用时间记录沉淀真实进度。登录后，你的数据会按账号安全隔离并同步。
            </p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {["愿景拆解", "专注计时", "周期复盘"].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 backdrop-blur">
                  <Check className="mb-2 h-4 w-4 text-indigo-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            由 Supabase Auth 提供安全认证，应用不保存明文密码
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-8 lg:rounded-l-[2rem] lg:px-12 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                <Zap className="h-5 w-5" fill="currentColor" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">愿景追踪</div>
                <div className="text-xs text-slate-500">把十年愿景变成今天的行动</div>
              </div>
            </div>

            <div className="mb-7">
              <p className="text-sm font-medium text-indigo-600">{mode === "login" ? "欢迎回来" : "开始新的旅程"}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {mode === "login" ? "登录你的账号" : "创建专属账号"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "login" ? "继续记录今天的行动与成长。" : "注册后即可跨设备同步个人数据。"}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="账号操作">
              {[{ id: "login", label: "登录" }, { id: "register", label: "注册" }].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.id}
                  onClick={() => switchMode(tab.id)}
                  className={cn(
                    "min-h-10 rounded-lg px-4 text-sm font-medium transition-all",
                    mode === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="display-name">昵称</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 pl-10" placeholder="怎么称呼你" autoComplete="name" required />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-10" placeholder="name@example.com" autoComplete="email" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 px-10" placeholder={mode === "login" ? "输入密码" : "至少 6 位密码"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "隐藏密码" : "显示密码"} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 pl-10" placeholder="再次输入密码" autoComplete="new-password" minLength={6} required />
                  </div>
                </div>
              )}

              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
              {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{success}</div>}

              <Button type="submit" disabled={loading} className="h-11 w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />正在处理</> : <>{mode === "login" ? "登录" : "创建账号"}<ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              登录即表示你同意安全存储必要的账号与登录记录。<br />密码由 Supabase Auth 加密处理，不会写入业务数据库。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
