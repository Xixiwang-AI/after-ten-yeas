# 愿景追踪

把长期愿景拆成今天可以完成的行动，记录专注时间、计划进度与每日复盘。

## 本地运行

需要 Node.js 18 或更高版本。

1. 在 Supabase 项目中打开 SQL Editor，执行 [`supabase/schema.sql`](supabase/schema.sql)。
2. 复制环境变量模板并填写项目的 URL 与 anon/publishable key：

```bash
cp .env.example .env
```

不要把 `service_role` key 放进前端项目。

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run lint
npm run build
npm run preview
```

## 数据保存

应用使用 Supabase Auth 的邮箱/密码认证。密码由 Supabase Auth 管理，业务表不保存明文密码或密码哈希。

登录后，愿景、计划、时间记录和设置会按 Supabase 用户 ID 分区保存到 `user_data`，并在本机保留同样按用户隔离的缓存。`profiles` 保存公开账号资料，`login_events` 保存登录时间、事件类型和浏览器标识；三张表均启用 RLS，用户只能访问自己的数据。

## GitHub Pages

推送到 `main` 分支后，GitHub Actions 会自动检查、构建并部署网站。线上地址：

https://xixiwang-ai.github.io/after-ten-yeas/
