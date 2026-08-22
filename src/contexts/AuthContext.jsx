import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AuthContext = createContext(null);

function userProfile(user, databaseProfile = null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    display_name:
      databaseProfile?.display_name ||
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "用户",
    ...databaseProfile,
  };
}

function authErrorMessage(error) {
  const message = error?.message?.toLowerCase() || "";
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "无法连接 Supabase，请检查项目 URL、公开密钥和网络配置";
  }
  if (message.includes("invalid login credentials")) return "邮箱或密码不正确";
  if (message.includes("email not confirmed")) return "请先打开验证邮件完成邮箱验证";
  if (message.includes("user already registered")) return "这个邮箱已经注册，可以直接登录";
  if (message.includes("password should be")) return "密码至少需要 6 位";
  if (message.includes("rate limit")) return "操作太频繁，请稍后再试";
  return error?.message || "连接认证服务失败，请稍后重试";
}

async function loadProfile(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[auth] profiles 表尚未就绪，将使用账号元数据：", error.message);
    return userProfile(user);
  }
  return userProfile(user, data);
}

async function recordLogin(user, eventType) {
  if (!user) return;
  const { error } = await supabase.from("login_events").insert({
    user_id: user.id,
    event_type: eventType,
    user_agent: navigator.userAgent,
  });
  if (error) {
    // 登录事件是审计信息，写入失败不应阻止用户进入应用。
    console.warn("[auth] 登录事件暂未写入：", error.message);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) console.warn("[auth] 无法恢复会话：", error.message);
      const sessionUser = data?.session?.user || null;
      setUser(sessionUser);
      setProfile(await loadProfile(sessionUser));
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // 避免在回调中继续阻塞 Supabase 的认证锁。
      window.setTimeout(async () => {
        if (!active) return;
        setProfile(await loadProfile(nextUser));
        setLoading(false);
        if (event === "SIGNED_IN") await recordLogin(nextUser, "sign_in");
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return { success: false, error: "请输入邮箱和密码" };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return { success: false, error: authErrorMessage(error) };
    return { success: true, user: data.user };
  }, []);

  const signUp = useCallback(async (displayName, email, password) => {
    const name = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (name.length < 2) return { success: false, error: "昵称至少需要 2 个字符" };
    if (!normalizedEmail || !password) return { success: false, error: "请填写完整的注册信息" };
    if (password.length < 6) return { success: false, error: "密码至少需要 6 位" };

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      },
    });
    if (error) return { success: false, error: authErrorMessage(error) };

    if (data.user && data.session) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        display_name: name,
        updated_at: new Date().toISOString(),
      });
      await recordLogin(data.user, "sign_up");
    }

    return {
      success: true,
      requiresEmailConfirmation: !data.session,
      user: data.user,
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: authErrorMessage(error) };
    return { success: true };
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signOut }),
    [user, profile, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
