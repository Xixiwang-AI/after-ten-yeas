import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronUp, Target, Plus, Trash2, Edit3, Check, X,
  Trophy, Star, ChevronRight, Palette,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// 可选颜色配置
export const VISION_COLORS = {
  indigo:  { label: "靛蓝",  gradient: "from-indigo-500 to-blue-400",   ring: "ring-indigo-200",  badge: "bg-indigo-100 text-indigo-700",   bar: "bg-indigo-500",   progress: "bg-indigo-500",  dot: "bg-indigo-500",  light: "bg-indigo-50",  text: "text-indigo-600" },
  violet:  { label: "紫罗兰", gradient: "from-violet-500 to-purple-400", ring: "ring-violet-200",  badge: "bg-violet-100 text-violet-700",   bar: "bg-violet-500",   progress: "bg-violet-500",  dot: "bg-violet-500",  light: "bg-violet-50",  text: "text-violet-600" },
  rose:    { label: "玫瑰红", gradient: "from-rose-500 to-pink-400",     ring: "ring-rose-200",    badge: "bg-rose-100 text-rose-700",       bar: "bg-rose-500",     progress: "bg-rose-500",    dot: "bg-rose-500",    light: "bg-rose-50",    text: "text-rose-600" },
  amber:   { label: "琥珀",  gradient: "from-amber-500 to-orange-400",  ring: "ring-amber-200",   badge: "bg-amber-100 text-amber-700",     bar: "bg-amber-500",    progress: "bg-amber-500",   dot: "bg-amber-500",   light: "bg-amber-50",   text: "text-amber-600" },
  emerald: { label: "翠绿",  gradient: "from-emerald-500 to-teal-400",  ring: "ring-emerald-200", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500",  progress: "bg-emerald-500", dot: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600" },
  cyan:    { label: "青色",  gradient: "from-cyan-500 to-sky-400",      ring: "ring-cyan-200",    badge: "bg-cyan-100 text-cyan-700",       bar: "bg-cyan-500",     progress: "bg-cyan-500",    dot: "bg-cyan-500",    light: "bg-cyan-50",    text: "text-cyan-600" },
};

export const getVisionColor = (colorKey) => VISION_COLORS[colorKey] || VISION_COLORS.indigo;

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(VISION_COLORS).map(([key, cfg]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={cfg.label}
          className={cn(
            "w-7 h-7 rounded-full transition-all",
            cfg.dot,
            value === key ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105"
          )}
        />
      ))}
    </div>
  );
}

export default function VisionCenter() {
  const {
    visions, plans, addVision, updateVision, deleteVision,
    addMilestone, removeMilestone, getPlanCompletionRate, getVisionCompletionRate,
    settings, updateSettings,
  } = useApp();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState({});
  const [editing, setEditing] = useState(null); // { id, field }
  const [editVal, setEditVal] = useState("");
  const [newMilestone, setNewMilestone] = useState({});
  const [addingMilestone, setAddingMilestone] = useState({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newVisionForm, setNewVisionForm] = useState({ title: "", content: "", color: "indigo" });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // visionId
  const [colorPickerOpen, setColorPickerOpen] = useState(null); // visionId

  // 页面副标题（可编辑）
  const subtitle = settings?.visionSubtitle ?? "设定你的目标，每个愿景用不同颜色标识";
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleVal, setSubtitleVal] = useState("");

  const startEditSubtitle = () => { setSubtitleVal(subtitle); setEditingSubtitle(true); };
  const saveSubtitle = () => { updateSettings({ visionSubtitle: subtitleVal.trim() || subtitle }); setEditingSubtitle(false); };
  const cancelSubtitle = () => setEditingSubtitle(false);

  const toggleCollapse = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const startEdit = (id, field, val) => { setEditing({ id, field }); setEditVal(val); };
  const saveEdit = () => { if (!editing) return; updateVision(editing.id, { [editing.field]: editVal }); setEditing(null); };
  const cancelEdit = () => setEditing(null);

  const handleAddMilestone = (visionId) => {
    const text = newMilestone[visionId]?.trim();
    if (!text) return;
    addMilestone(visionId, text);
    setNewMilestone(prev => ({ ...prev, [visionId]: "" }));
    setAddingMilestone(prev => ({ ...prev, [visionId]: false }));
  };

  const handleAddVision = () => {
    if (!newVisionForm.title.trim()) return;
    addVision(newVisionForm);
    setNewVisionForm({ title: "", content: "", color: "indigo" });
    setShowAddDialog(false);
  };

  const handleDeleteVision = (id) => {
    deleteVision(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <h1 className="text-xl font-bold text-slate-800">十年后</h1>
          {editingSubtitle ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Input
                value={subtitleVal}
                onChange={e => setSubtitleVal(e.target.value)}
                className="h-7 text-xs flex-1"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") saveSubtitle(); if (e.key === "Escape") cancelSubtitle(); }}
              />
              <button onClick={saveSubtitle} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={cancelSubtitle} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5 group">
              <p className="text-sm text-slate-500">{subtitle}</p>
              <button onClick={startEditSubtitle} className="p-0.5 text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
        >
          <Plus className="w-4 h-4" /> 新增愿景
        </Button>
      </div>

      {/* Vision Cards */}
      {visions.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <div className="text-sm">还没有愿景，点击右上角新增</div>
        </div>
      ) : (
        <div className="space-y-4">
          {visions.map(vision => {
            const cfg = getVisionColor(vision.color);
            const completionRate = getVisionCompletionRate(vision.id);
            const relatedPlans = plans.filter(p => p.visionId === vision.id);
            const allVisionModules = relatedPlans.flatMap(p => p.modules);
            const doneVisionModules = allVisionModules.filter(m => m.status === "completed").length;
            const isCollapsed = collapsed[vision.id];

            return (
              <Card key={vision.id} className={cn("overflow-hidden ring-1", cfg.ring)}>
                {/* Top color bar */}
                <div className={cn("h-1.5 bg-gradient-to-r", cfg.gradient)} />

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Color icon */}
                      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", cfg.gradient)}>
                        <Target className="w-5 h-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title edit */}
                        {editing?.id === vision.id && editing?.field === "title" ? (
                          <div className="flex gap-1.5">
                            <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={e => e.key === "Enter" && saveEdit()} />
                            <button onClick={saveEdit} className="p-1 text-emerald-600"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEdit} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <h2 className="font-semibold text-slate-800 truncate">{vision.title}</h2>
                            <button onClick={() => startEdit(vision.id, "title", vision.title)} className="p-0.5 text-slate-300 hover:text-slate-500 flex-shrink-0">
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Color badge */}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 mt-0.5", cfg.badge)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full inline-block", cfg.dot)} />
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Right: completion + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div className={cn("text-lg font-bold", cfg.text)}>{completionRate}%</div>
                        <div className="text-xs text-slate-400">{doneVisionModules}/{allVisionModules.length} 项完成</div>
                      </div>

                      {/* Change color */}
                      <div className="relative">
                        <button
                          onClick={() => setColorPickerOpen(colorPickerOpen === vision.id ? null : vision.id)}
                          className={cn("p-1.5 rounded-md hover:bg-slate-100 transition-colors", colorPickerOpen === vision.id ? "bg-slate-100 text-indigo-500" : "text-slate-400")}
                        >
                          <Palette className="w-3.5 h-3.5" />
                        </button>
                        {colorPickerOpen === vision.id && (
                          <>
                            {/* 点击遮罩关闭 */}
                            <div className="fixed inset-0 z-10" onClick={() => setColorPickerOpen(null)} />
                            <div className="absolute right-0 top-9 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52">
                              <div className="text-xs text-slate-500 mb-2.5 font-medium">选择颜色</div>
                              <ColorPicker
                                value={vision.color}
                                onChange={c => {
                                  updateVision(vision.id, { color: c });
                                  setColorPickerOpen(null);
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Delete */}
                      <button onClick={() => setDeleteConfirm(vision.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Collapse */}
                      <button onClick={() => toggleCollapse(vision.id)} className="p-1.5 rounded-md hover:bg-slate-100">
                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("absolute inset-y-0 left-0 rounded-full transition-all", cfg.bar)}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="space-y-4 pt-0">
                    {/* Vision Content */}
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1.5">愿景描述</div>
                      {editing?.id === vision.id && editing?.field === "content" ? (
                        <div className="space-y-2">
                          <Textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={3} autoFocus className="text-sm resize-none" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit} className={cn("h-7 text-xs text-white", cfg.bar, "hover:opacity-90")}>保存</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs">取消</Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => startEdit(vision.id, "content", vision.content)}
                          className={cn("text-sm text-slate-700 rounded-lg p-3 cursor-pointer transition-colors min-h-[60px] border border-transparent", cfg.light, `hover:border-current hover:border-opacity-30`)}
                        >
                          {vision.content || <span className="text-slate-400 italic">点击编辑愿景描述...</span>}
                        </div>
                      )}
                    </div>

                    {/* Related Plans */}
                    {relatedPlans.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-slate-500">关联计划 ({relatedPlans.length})</div>
                          <button onClick={() => navigate("/plans")} className={cn("text-xs hover:underline flex items-center gap-0.5", cfg.text)}>
                            管理 <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {relatedPlans.map(plan => {
                            const rate = getPlanCompletionRate(plan.id);
                            const planDone = plan.modules.filter(m => m.status === "completed").length;
                            const planTotal = plan.modules.length;
                            const statusColors = { pending: "bg-slate-100 text-slate-600", in_progress: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700" };
                            const statusLabels = { pending: "待开始", in_progress: "进行中", completed: "已完成" };
                            return (
                              <div
                                key={plan.id}
                                onClick={() => navigate("/plans")}
                                className={cn("flex items-center gap-3 p-2.5 bg-white border rounded-lg cursor-pointer transition-all hover:shadow-sm", cfg.ring)}
                              >
                                {/* 左侧颜色竖条 */}
                                <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", cfg.bar)} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-800 truncate">{plan.name}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[plan.status]}`}>
                                      {statusLabels[plan.status]}
                                    </span>
                                  </div>
                                  <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                                    <div className={cn("absolute inset-y-0 left-0 rounded-full", cfg.bar)} style={{ width: `${rate}%` }} />
                                  </div>
                                </div>
                                <span className={cn("text-xs font-bold flex-shrink-0", cfg.text)}>
                                  {planDone}/{planTotal} <span className="font-normal opacity-70">({rate}%)</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Milestones */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 text-amber-500" /> 里程碑
                        </div>
                        <button
                          onClick={() => setAddingMilestone(prev => ({ ...prev, [vision.id]: true }))}
                          className={cn("text-xs hover:underline flex items-center gap-0.5", cfg.text)}
                        >
                          <Plus className="w-3 h-3" /> 添加
                        </button>
                      </div>
                      {addingMilestone[vision.id] && (
                        <div className="flex gap-2 mb-2">
                          <Input
                            placeholder="记录里程碑..."
                            value={newMilestone[vision.id] || ""}
                            onChange={e => setNewMilestone(prev => ({ ...prev, [vision.id]: e.target.value }))}
                            className="h-8 text-xs"
                            onKeyDown={e => e.key === "Enter" && handleAddMilestone(vision.id)}
                            autoFocus
                          />
                          <button onClick={() => handleAddMilestone(vision.id)} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setAddingMilestone(prev => ({ ...prev, [vision.id]: false }))} className="p-1.5 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {(vision.milestones || []).length > 0 ? (
                        <div className="space-y-1.5">
                          {vision.milestones.map(ms => (
                            <div key={ms.id} className={cn("flex items-center gap-2 group p-2 rounded-lg", cfg.light)}>
                              <Star className={cn("w-3.5 h-3.5 flex-shrink-0", cfg.text)} />
                              <span className="text-xs text-slate-700 flex-1">{ms.text}</span>
                              <span className="text-xs text-slate-400">{format(new Date(ms.date), "MM/dd")}</span>
                              <button
                                onClick={() => removeMilestone(vision.id, ms.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-lg">
                          尚无里程碑，记录你的每一个突破 ✨
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Vision Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新增愿景</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-600">愿景标题 *</label>
              <Input
                value={newVisionForm.title}
                onChange={e => setNewVisionForm(p => ({ ...p, title: e.target.value }))}
                placeholder="例如：提升技术能力"
                className="mt-1"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleAddVision()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">愿景描述</label>
              <Textarea
                value={newVisionForm.content}
                onChange={e => setNewVisionForm(p => ({ ...p, content: e.target.value }))}
                placeholder="描述这个愿景的具体目标..."
                rows={2}
                className="mt-1 resize-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">选择颜色</label>
              <ColorPicker value={newVisionForm.color} onChange={c => setNewVisionForm(p => ({ ...p, color: c }))} />
              <div className="mt-2 text-xs text-slate-400">已选：{VISION_COLORS[newVisionForm.color]?.label}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleAddVision} className="bg-indigo-600 hover:bg-indigo-700 text-white">创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600">
            删除后该愿景及其里程碑将被移除，关联计划不会被删除。确认继续？
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteVision(deleteConfirm)}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
