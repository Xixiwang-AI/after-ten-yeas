import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  Settings as SettingsIcon, Tag, Bell, Download, Moon, Sun, Trash2, Plus, Check, X, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { settings, updateSettings, plans, visions, timeLogs } = useApp();
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const isDark = settings.theme === "dark";

  const handleToggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    updateSettings({ theme: newTheme });
    // Apply to document
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (!tag || settings.tags.includes(tag)) return;
    updateSettings({ tags: [...settings.tags, tag] });
    setNewTag("");
    setAddingTag(false);
    toast.success(`标签"${tag}"已添加`);
  };

  const handleDeleteTag = (tag) => {
    updateSettings({ tags: settings.tags.filter(t => t !== tag) });
    toast.success(`标签"${tag}"已删除`);
  };

  const handleExportJSON = () => {
    const data = { visions, plans, timeLogs, settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vision-tracker-${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("数据已导出为 JSON 文件");
  };

  const handleExportCSV = () => {
    const headers = ["日期", "模块名称", "计划名称", "时长(分钟)", "开始时间", "结束时间", "备注", "标签"];
    const rows = timeLogs.map(l => [
      l.date, l.moduleName || "",
      plans.find(p => p.id === l.planId)?.name || "",
      Math.round((l.duration || 0) / 60),
      l.startTime ? new Date(l.startTime).toLocaleTimeString("zh-CN") : "",
      l.endTime ? new Date(l.endTime).toLocaleTimeString("zh-CN") : "",
      l.notes || "", (l.tags || []).join(";"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-logs-${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("时间日志已导出为 CSV 文件");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result);
        if (data.visions) localStorage.setItem("visions", JSON.stringify(data.visions));
        if (data.plans) localStorage.setItem("plans", JSON.stringify(data.plans));
        if (data.timeLogs) localStorage.setItem("timeLogs", JSON.stringify(data.timeLogs));
        toast.success("数据已恢复，刷新页面生效");
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast.error("文件格式错误，请使用导出的 JSON 文件");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">设置中心</h1>
        <p className="text-sm text-slate-500 mt-0.5">个性化你的愿景追踪体验</p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {isDark ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
            主题设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">深色模式</div>
              <div className="text-xs text-slate-400 mt-0.5">切换至深色主题，更适合夜间使用</div>
            </div>
            <Switch checked={isDark} onCheckedChange={handleToggleTheme} />
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" />
            标签管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {settings.tags.map(tag => (
              <div key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full">
                <span>{tag}</span>
                <button onClick={() => handleDeleteTag(tag)} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {addingTag ? (
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="输入新标签名..."
                className="h-8 text-xs flex-1"
                onKeyDown={e => e.key === "Enter" && handleAddTag()}
                autoFocus
              />
              <button onClick={handleAddTag} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setAddingTag(false); setNewTag(""); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddingTag(true)} className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> 添加标签
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-500" />
            通知提醒
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">截止日提醒</div>
              <div className="text-xs text-slate-400 mt-0.5">计划快到截止日时提醒</div>
            </div>
            <Switch
              checked={settings.notifications?.taskDueReminder ?? true}
              onCheckedChange={v => updateSettings({ notifications: { ...settings.notifications, taskDueReminder: v } })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">超时提醒</div>
              <div className="text-xs text-slate-400 mt-0.5">计时超过预计时长时提醒</div>
            </div>
            <Switch
              checked={settings.notifications?.overtimeReminder ?? false}
              onCheckedChange={v => updateSettings({ notifications: { ...settings.notifications, overtimeReminder: v } })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-500" />
            数据管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">数据概览</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-lg font-bold text-slate-700">{visions.length}</div>
                <div className="text-xs text-slate-400">愿景</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-lg font-bold text-slate-700">{plans.length}</div>
                <div className="text-xs text-slate-400">计划</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-lg font-bold text-slate-700">{timeLogs.length}</div>
                <div className="text-xs text-slate-400">时间记录</div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">导出数据</div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExportJSON} className="gap-1.5 h-8">
                <Download className="w-3.5 h-3.5" /> 导出 JSON
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 h-8">
                <Download className="w-3.5 h-3.5" /> 导出 CSV（时间日志）
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">恢复数据</div>
            <div className="text-xs text-slate-400">从之前导出的 JSON 文件中恢复数据</div>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 pointer-events-none" asChild>
                <span>选择文件导入</span>
              </Button>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-medium text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 危险区域
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="w-3.5 h-3.5" /> 清空所有数据
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clear Confirm Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> 清空所有数据
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-slate-600">
              此操作将删除所有愿景、计划、模块和时间记录，且不可恢复。
            </p>
            <p className="text-xs text-slate-500">
              请输入 <strong>CLEAR</strong> 确认操作：
            </p>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="输入 CLEAR"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowClearDialog(false); setConfirmText(""); }}>取消</Button>
            <Button
              disabled={confirmText !== "CLEAR"}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
