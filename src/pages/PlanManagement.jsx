import { useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";
import {
  Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, GripVertical,
  Clock, Flag, Circle, PlayCircle, CheckCircle2, Tag, Target, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getVisionColor } from "./VisionCenter";

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "in_progress", label: "进行中" },
  { key: "pending", label: "待开始" },
  { key: "completed", label: "已完成" },
];

const STATUS_COLOR = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};
const STATUS_LABEL = { pending: "待开始", in_progress: "进行中", completed: "已完成" };
const PRIORITY_COLOR = { high: "text-red-500", medium: "text-amber-500", low: "text-green-500" };
const PRIORITY_LABEL = { high: "高", medium: "中", low: "低" };

const defaultPlanForm = {
  name: "", visionId: "none", startDate: format(new Date(), "yyyy-MM-dd"),
  endDate: "", estimatedHours: "", tags: "", notes: "", status: "pending",
};
const defaultModuleForm = { name: "", estimatedHours: "", priority: "medium" };

export default function PlanManagement() {
  const { visions, plans, addPlan, updatePlan, deletePlan, addModule, updateModule, deleteModule, getPlanCompletionRate, startTimer } = useApp();
  const [activeTab, setActiveTab] = useState("all");
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [planForm, setPlanForm] = useState(defaultPlanForm);
  const [editPlanId, setEditPlanId] = useState(null);
  const [showAddModule, setShowAddModule] = useState(null);
  const [moduleForm, setModuleForm] = useState(defaultModuleForm);
  const [editModule, setEditModule] = useState(null); // { planId, moduleId }
  const [editModuleForm, setEditModuleForm] = useState({});
  const [dragging, setDragging] = useState(null);

  const filteredPlans = useMemo(() => {
    if (activeTab === "all") return plans;
    return plans.filter(p => p.status === activeTab);
  }, [plans, activeTab]);

  const handleAddPlan = () => {
    if (!planForm.name.trim()) return;
    const data = {
      ...planForm,
      visionId: planForm.visionId === "none" ? "" : planForm.visionId,
      estimatedHours: +planForm.estimatedHours || 0,
      tags: planForm.tags ? planForm.tags.split(",").map(t => t.trim()) : [],
    };
    if (editPlanId) {
      updatePlan(editPlanId, data);
      setEditPlanId(null);
    } else {
      addPlan(data);
    }
    setShowAddPlan(false);
    setPlanForm(defaultPlanForm);
  };

  const openEditPlan = (plan) => {
    setEditPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      visionId: plan.visionId || "none",
      startDate: plan.startDate ? format(new Date(plan.startDate), "yyyy-MM-dd") : "",
      endDate: plan.endDate ? format(new Date(plan.endDate), "yyyy-MM-dd") : "",
      estimatedHours: plan.estimatedHours || "",
      tags: (plan.tags || []).join(","),
      notes: plan.notes || "",
      status: plan.status,
    });
    setShowAddPlan(true);
  };

  const handleAddModule = (planId) => {
    if (!moduleForm.name.trim()) return;
    addModule(planId, { ...moduleForm, estimatedHours: +moduleForm.estimatedHours || 0 });
    setShowAddModule(null);
    setModuleForm(defaultModuleForm);
  };

  const handleSaveEditModule = () => {
    if (!editModule) return;
    updateModule(editModule.planId, editModule.moduleId, {
      ...editModuleForm,
      estimatedHours: +editModuleForm.estimatedHours || 0,
    });
    setEditModule(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">计划管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">将愿景拆解为可执行的计划和模块</p>
        </div>
        <Button onClick={() => { setEditPlanId(null); setPlanForm(defaultPlanForm); setShowAddPlan(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Plus className="w-4 h-4" /> 新建计划
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              activeTab === tab.key ? "bg-white shadow-sm text-indigo-700" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">
              {tab.key === "all" ? plans.length : plans.filter(p => p.status === tab.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Plans List - 双列网格 */}
      {filteredPlans.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="text-sm">暂无计划，点击右上角新建</div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {filteredPlans.map(plan => {
          const rate = getPlanCompletionRate(plan.id);
          const totalModules = plan.modules.length;
          const doneModules = plan.modules.filter(m => m.status === "completed").length;
          const vision = visions.find(v => v.id === plan.visionId);
          const visionCfg = vision ? getVisionColor(vision.color) : null;
          const isExpanded = expandedPlan === plan.id;
          const isOverdue = plan.endDate && new Date(plan.endDate) < new Date() && plan.status !== "completed";

          return (
            <Card key={plan.id} className={cn("overflow-hidden transition-opacity", plan.status === "pending" && "opacity-40" || plan.status === "completed" && "opacity-40")}>
              {/* 愿景颜色顶条 */}
              {visionCfg && <div className={cn("h-1 bg-gradient-to-r", visionCfg.gradient)} />}
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-start gap-3">
                  {/* 愿景颜色左侧竖条 */}
                  {visionCfg && <div className={cn("w-1 self-stretch rounded-full flex-shrink-0 my-0.5", visionCfg.bar)} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800 text-sm">{plan.name}</h3>
                      {isOverdue && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> 已逾期
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-400">
                      {vision && (
                        <span className={cn("flex items-center gap-1 font-medium", visionCfg?.text)}>
                          <span className={cn("w-2 h-2 rounded-full inline-block", visionCfg?.dot)} />
                          {vision.title}
                        </span>
                      )}
                      {plan.endDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(plan.endDate), "yyyy/MM/dd")}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{plan.estimatedHours || 0}h预计</span>
                      {(plan.tags || []).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs h-4 px-1">{tag}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", visionCfg ? visionCfg.bar : "bg-indigo-500")}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-bold flex-shrink-0", visionCfg ? visionCfg.text : "text-indigo-600")}>
                        {doneModules}/{totalModules} <span className="font-normal opacity-70">({rate}%)</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Select value={plan.status} onValueChange={v => updatePlan(plan.id, { status: v })}>
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">待开始</SelectItem>
                        <SelectItem value="in_progress">进行中</SelectItem>
                        <SelectItem value="completed">已完成</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={() => openEditPlan(plan)} className="p-1.5 hover:bg-slate-100 rounded-md">
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button onClick={() => deletePlan(plan.id)} className="p-1.5 hover:bg-red-50 rounded-md">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <button onClick={() => setExpandedPlan(isExpanded ? null : plan.id)} className="p-1.5 hover:bg-slate-100 rounded-md">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 border-t border-slate-100">
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">时间模块 ({plan.modules.length})</span>
                      <button
                        onClick={() => { setShowAddModule(plan.id); setModuleForm(defaultModuleForm); }}
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> 添加模块
                      </button>
                    </div>

                    {showAddModule === plan.id && (
                      <div className="flex gap-2 p-3 bg-indigo-50 rounded-lg items-end">
                        <div className="flex-1 space-y-1.5">
                          <Input placeholder="模块名称" value={moduleForm.name} onChange={e => setModuleForm(p => ({ ...p, name: e.target.value }))} className="h-8 text-xs" autoFocus />
                          <div className="flex gap-2">
                            <Input type="number" placeholder="预计时长(h)" value={moduleForm.estimatedHours} onChange={e => setModuleForm(p => ({ ...p, estimatedHours: e.target.value }))} className="h-7 text-xs w-32" />
                            <Select value={moduleForm.priority} onValueChange={v => setModuleForm(p => ({ ...p, priority: v }))}>
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">高优先级</SelectItem>
                                <SelectItem value="medium">中优先级</SelectItem>
                                <SelectItem value="low">低优先级</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleAddModule(plan.id)} className="p-1.5 text-emerald-600 bg-white rounded-md hover:bg-emerald-50 border border-emerald-200">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowAddModule(null)} className="p-1.5 text-slate-400 bg-white rounded-md hover:bg-slate-50 border border-slate-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {plan.modules.length === 0 && showAddModule !== plan.id && (
                      <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                        暂无模块，添加第一个执行单元
                      </div>
                    )}

                    {plan.modules.map(module => {
                      const isEditingThis = editModule?.moduleId === module.id;
                      const progress = module.status === "completed" ? 100 : 0;
                      return (
                        <div key={module.id} className="flex items-start gap-2 p-2.5 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 group transition-all">
                          <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-1 flex-shrink-0 cursor-grab" />
                          {isEditingThis ? (
                            <div className="flex-1 space-y-1.5">
                              <Input value={editModuleForm.name || ""} onChange={e => setEditModuleForm(p => ({ ...p, name: e.target.value }))} className="h-7 text-xs" autoFocus />
                              <div className="flex gap-2">
                                <Input type="number" value={editModuleForm.estimatedHours || ""} onChange={e => setEditModuleForm(p => ({ ...p, estimatedHours: e.target.value }))} className="h-7 text-xs w-28" placeholder="预计时长" />
                                <Select value={editModuleForm.priority} onValueChange={v => setEditModuleForm(p => ({ ...p, priority: v }))}>
                                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="high">高</SelectItem>
                                    <SelectItem value="medium">中</SelectItem>
                                    <SelectItem value="low">低</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select value={editModuleForm.status} onValueChange={v => setEditModuleForm(p => ({ ...p, status: v }))}>
                                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">待开始</SelectItem>
                                    <SelectItem value="in_progress">进行中</SelectItem>
                                    <SelectItem value="completed">已完成</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={handleSaveEditModule} className="p-1 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditModule(null)} className="p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {module.status === "completed"
                                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                    : module.status === "in_progress"
                                    ? <PlayCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                                  <span className="text-xs font-medium text-slate-800 truncate">{module.name}</span>
                                  <Flag className={cn("w-3 h-3 flex-shrink-0", PRIORITY_COLOR[module.priority])} />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-400 flex-shrink-0">{module.actualHours || 0}/{module.estimatedHours || 0}h</span>
                                </div>
                              </div>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startTimer(module.id, module.name, plan.id)}
                                  className="p-1 text-indigo-500 hover:bg-indigo-50 rounded"
                                  title="开始计时"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => { setEditModule({ planId: plan.id, moduleId: module.id }); setEditModuleForm({ name: module.name, estimatedHours: module.estimatedHours, priority: module.priority, status: module.status }); }}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteModule(plan.id, module.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
      )}

      {/* Add/Edit Plan Dialog */}
      <Dialog open={showAddPlan} onOpenChange={setShowAddPlan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editPlanId ? "编辑计划" : "新建计划"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">计划名称 *</Label>
              <Input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="输入计划名称" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">关联愿景</Label>
              <Select value={planForm.visionId || "none"} onValueChange={v => setPlanForm(p => ({ ...p, visionId: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="选择愿景" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {visions.map(v => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">开始日期</Label>
                <Input type="date" value={planForm.startDate} onChange={e => setPlanForm(p => ({ ...p, startDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">截止日期</Label>
                <Input type="date" value={planForm.endDate} onChange={e => setPlanForm(p => ({ ...p, endDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">预计时长 (h)</Label>
                <Input type="number" value={planForm.estimatedHours} onChange={e => setPlanForm(p => ({ ...p, estimatedHours: e.target.value }))} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">状态</Label>
                <Select value={planForm.status} onValueChange={v => setPlanForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待开始</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">标签 (逗号分隔)</Label>
              <Input value={planForm.tags} onChange={e => setPlanForm(p => ({ ...p, tags: e.target.value }))} placeholder="技术,学习" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">备注</Label>
              <Textarea value={planForm.notes} onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1 resize-none text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddPlan(false)}>取消</Button>
            <Button onClick={handleAddPlan} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {editPlanId ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
