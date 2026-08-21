import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/contexts/AppContext';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Play, Pause, Square, Plus, Trash2, Edit3, Clock, ChevronLeft, ChevronRight, Timer, BookOpen, Download, CheckCircle2, Circle, FileDown, Calendar, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils'; // ─── 颜色映射（十六进制）─────────────────────────────────────────────────────

const VISION_HEX = {
  indigo: {
    bg: '#6366f1',
    light: '#eef2ff',
    text: '#4338ca',
  },
  violet: {
    bg: '#8b5cf6',
    light: '#f5f3ff',
    text: '#6d28d9',
  },
  rose: {
    bg: '#f43f5e',
    light: '#fff1f2',
    text: '#be123c',
  },
  amber: {
    bg: '#f59e0b',
    light: '#fffbeb',
    text: '#b45309',
  },
  emerald: {
    bg: '#10b981',
    light: '#ecfdf5',
    text: '#065f46',
  },
  cyan: {
    bg: '#06b6d4',
    light: '#ecfeff',
    text: '#0e7490',
  },
};

const getHex = (colorKey) => VISION_HEX[colorKey] || VISION_HEX.indigo; // ─── 工具函数 ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 56; // px per hour（LogDialog 预览用）

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0分';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
  return `${m}分`;
}

function formatTime(isoStr) {
  try {
    return format(parseISO(isoStr), 'HH:mm');
  } catch {
    return '--:--';
  }
} // "HH:MM" → 分钟数

function timeStrToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
} // 分钟数 → "HH:MM"

function minutesToTimeStr(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
} // ─── Stopwatch ───────────────────────────────────────────────────────────────

function Stopwatch({ onStop }) {
  const { activeTimer, pauseTimer, resumeTimer, stopTimer } = useApp();
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!activeTimer) return;
    const id = setInterval(() => {
      if (!activeTimer.paused) setElapsed(Math.floor((Date.now() - activeTimer.startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);
  const fmt = (s) => {
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  return (
    <div className='text-center space-y-4'>
      <div>
        <div className='text-xs text-slate-500 mb-1'>正在计时：{activeTimer?.moduleName}</div>
        <div className='text-5xl font-mono font-bold text-indigo-600'>{fmt(elapsed)}</div>
        {activeTimer?.paused && <div className='text-xs text-amber-600 mt-1'>⏸ 已暂停</div>}
      </div>
      <div className='flex justify-center gap-3'>
        <Button variant='outline' onClick={activeTimer?.paused ? resumeTimer : pauseTimer} className='gap-2'>
          {activeTimer?.paused ? <Play className='w-4 h-4' /> : <Pause className='w-4 h-4' />}
          {activeTimer?.paused ? '继续' : '暂停'}
        </Button>
        <Button
          onClick={() => {
            stopTimer(notes);
            onStop();
          }}
          className='bg-red-500 hover:bg-red-600 text-white gap-2'
        >
          <Square className='w-4 h-4' /> 完成
        </Button>
      </div>
      <div>
        <Label className='text-xs'>备注</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='记录这段时间做了什么...' rows={2} className='mt-1 text-sm resize-none' />
      </div>
    </div>
  );
} // ─── 新建/编辑 记录弹窗 ──────────────────────────────────────────────────────

function LogDialog({ open, onClose, onSave, onDelete, initialData, plans, visions, planColorMap }) {
  // initialData: { date, startTime("HH:MM"), moduleId?, notes?, tags?, id?, duration? }
  const isEdit = !!initialData?.id;
  const [moduleId, setModuleId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  useEffect(() => {
    if (open && initialData) {
      setModuleId(initialData.moduleId || '');
      setStartTime(initialData.startTime || '09:00');
      setDurationMinutes(initialData.duration ? Math.round(initialData.duration / 60) : 60);
      setNotes(initialData.notes || '');
      setTags((initialData.tags || []).join(', '));
    }
  }, [open, initialData]);
  const endTime = useMemo(() => {
    const endMins = timeStrToMinutes(startTime) + Math.max(5, durationMinutes);
    return minutesToTimeStr(Math.min(endMins, 23 * 60 + 59));
  }, [startTime, durationMinutes]); // 预览块颜色
  const previewHex = useMemo(() => {
    if (!moduleId) return getHex('indigo');
    const plan = plans.find((p) => p.modules.some((m) => m.id === moduleId));
    return plan ? planColorMap[plan.id] || getHex('indigo') : getHex('indigo');
  }, [moduleId, plans, planColorMap]); // 预览块高度（按比例）
  const previewHeight = Math.max(24, (durationMinutes / 60) * HOUR_HEIGHT);
  const handleSave = () => {
    if (!moduleId) return;
    const allMods = plans.flatMap((p) => p.modules);
    const mod = allMods.find((m) => m.id === moduleId);
    const plan = plans.find((p) => p.modules.some((m) => m.id === moduleId));
    const duration = Math.max(60, durationMinutes * 60);
    const startISO = `${initialData.date}T${startTime}:00`;
    const endMins = timeStrToMinutes(startTime) + durationMinutes;
    const endISO = `${initialData.date}T${minutesToTimeStr(Math.min(endMins, 23 * 60 + 59))}:00`;
    onSave({
      id: initialData.id,
      moduleId,
      moduleName: mod?.name || '未知模块',
      planId: plan?.id,
      startTime: startISO,
      endTime: endISO,
      duration,
      notes,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      date: initialData.date,
    });
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {isEdit ? <Edit3 className='w-4 h-4 text-indigo-500' /> : <Plus className='w-4 h-4 text-indigo-500' />}
            {isEdit ? '编辑时间块' : '新增时间块'}
            <span className='text-sm font-normal text-slate-400 ml-1'>{initialData?.date}</span>
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          {/* 分类选择 */}
          <div>
            <Label className='text-xs font-medium'>分类模块 *</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger className='mt-1'>
                <SelectValue placeholder='选择所属模块（关联愿景颜色）' />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p, __dnd_i) => {
                  const v = visions.find((v) => v.id === p.visionId);
                  const hex = planColorMap[p.id] || getHex('indigo');
                  return (
                    <div key={p.id}>
                      <div className='px-2 py-1.5 text-xs font-semibold bg-slate-50 flex items-center gap-1.5'>
                        <span
                          className='w-2 h-2 rounded-full inline-block flex-shrink-0'
                          style={{
                            backgroundColor: hex.bg,
                          }}
                        />
                        {p.name}
                        {v && <span className='text-slate-400 font-normal'>· {v.title}</span>}
                      </div>
                      {p.modules.map((m, __dnd_i) => (
                        <SelectItem key={m.id} value={m.id} className='pl-5'>
                          {m.name}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 时间设置 */}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <Label className='text-xs font-medium'>开始时间</Label>
              <Input type='time' value={startTime} onChange={(e) => setStartTime(e.target.value)} className='mt-1 h-9' />
            </div>
            <div>
              <Label className='text-xs font-medium'>持续时长（分钟）</Label>
              <Input type='number' min={5} max={1440} value={durationMinutes} onChange={(e) => setDurationMinutes(Math.max(5, +e.target.value || 5))} className='mt-1 h-9' />
            </div>
          </div>

          {/* 时间预览 */}
          <div className='flex items-center gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2'>
            <Clock className='w-3.5 h-3.5 text-slate-400 flex-shrink-0' />
            <span>
              {startTime} → {endTime}
            </span>
            <span className='text-slate-400'>共 {formatDuration(durationMinutes * 60)}</span>
            {/* 等比预览块 */}
            <div className='ml-auto flex items-center gap-1.5'>
              <span className='text-slate-400'>预览：</span>
              <div
                className='w-5 rounded-sm flex-shrink-0'
                style={{
                  height: Math.max(8, Math.min(48, previewHeight * 0.5)),
                  backgroundColor: previewHex.light,
                  borderLeft: `3px solid ${previewHex.bg}`,
                }}
              />
            </div>
          </div>

          {/* 备注 */}
          <div>
            <Label className='text-xs font-medium'>具体内容 / 备注</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className='mt-1 resize-none text-sm' placeholder='记录这段时间做了什么、学了什么...' />
          </div>

          {/* 标签 */}
          <div>
            <Label className='text-xs font-medium'>标签（逗号分隔）</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} className='mt-1 h-9' placeholder='学习, 专注, 编码' />
          </div>
        </div>

        <DialogFooter className='gap-2'>
          {isEdit && (
            <Button
              variant='ghost'
              size='sm'
              className='text-red-500 hover:bg-red-50 mr-auto'
              onClick={() => {
                onDelete(initialData.id);
                onClose();
              }}
            >
              <Trash2 className='w-3.5 h-3.5 mr-1' /> 删除
            </Button>
          )}
          <Button variant='ghost' onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!moduleId} className='bg-indigo-600 hover:bg-indigo-700 text-white'>
            {isEdit ? '保存修改' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} // ─── 常量 ──────────────────────────────────────────────────────────────────────

const SNAP = 15;

const MIN_DURATION = 15; // 最小时长15分钟

const ROW_HEIGHT = 52; // 每行（每天）高度

const TOTAL_MINS = 24 * 60; // 每分钟对应的像素宽度（在容器宽度内动态计算，这里用百分比）
// 我们用 left% 和 width% 来定位，百分比 = minutes / TOTAL_MINS * 100

function snapMins(m) {
  return Math.round(m / SNAP) * SNAP;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
} // 柔和随机色

const SOFT_COLORS = [
  {
    bg: '#6366f1',
    light: '#eef2ff',
    text: '#4338ca',
  },
  {
    bg: '#8b5cf6',
    light: '#f5f3ff',
    text: '#6d28d9',
  },
  {
    bg: '#ec4899',
    light: '#fdf2f8',
    text: '#be185d',
  },
  {
    bg: '#f59e0b',
    light: '#fffbeb',
    text: '#b45309',
  },
  {
    bg: '#10b981',
    light: '#ecfdf5',
    text: '#065f46',
  },
  {
    bg: '#06b6d4',
    light: '#ecfeff',
    text: '#0e7490',
  },
  {
    bg: '#f97316',
    light: '#fff7ed',
    text: '#c2410c',
  },
  {
    bg: '#84cc16',
    light: '#f7fee7',
    text: '#3f6212',
  },
];

function randomColor() {
  return SOFT_COLORS[Math.floor(Math.random() * SOFT_COLORS.length)];
} // ─── 单个时间块 ────────────────────────────────────────────────────────────────

const HBLOCK_VIEW_START = 7 * 60;

const HBLOCK_VIEW_MINS = (24 - 7) * 60; // 1020

function HBlock({ log, plans, visions, containerRef, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(log.notes || log.moduleName || '');
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [hovered, setHovered] = useState(false);
  const blockRef = useRef(null);
  const inputRef = useRef(null);
  const leaveTimer = useRef(null); // 从 log 解析 startMinutes 和 durationMinutes
  const startMins = useMemo(() => {
    if (!log.startTime) return 0;
    try {
      const d = parseISO(log.startTime);
      return d.getHours() * 60 + d.getMinutes();
    } catch {
      return 0;
    }
  }, [log.startTime]);
  const durMins = useMemo(() => Math.max(MIN_DURATION, Math.round((log.duration || 3600) / 60)), [log.duration]); // 颜色：优先用计划对应颜色，否则用 log.color 字段，否则 indigo
  const hex = useMemo(() => {
    const plan = plans.find((p) => p.id === log.planId);
    const vision = plan ? visions.find((v) => v.id === plan.visionId) : null;
    if (vision) return getHex(vision.color);
    if (log.color) return log.color;
    return getHex('indigo');
  }, [log.planId, log.color, plans, visions]); // 聚焦
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  const commitLabel = () => {
    setEditing(false);
    onUpdate(log.id, {
      notes: label,
      moduleName: label || log.moduleName,
    });
  }; // 延迟隐藏（给鼠标移到工具栏的时间）
  const handleMouseEnter = () => {
    clearTimeout(leaveTimer.current);
    setHovered(true);
  };
  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 200);
  }; // ── 拖拽移动（按住主体） ──
  const handleMoveStart = (e) => {
    if (editing) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const cw = container.getBoundingClientRect().width;
    const minsPerPx = HBLOCK_VIEW_MINS / cw;
    const startX = e.clientX;
    const origStart = startMins; // 显示 tooltip
    const tip = makeTip();
    let live = origStart;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const raw = origStart + dx * minsPerPx;
      live = clamp(snapMins(raw), HBLOCK_VIEW_START, HBLOCK_VIEW_START + HBLOCK_VIEW_MINS - durMins);
      const newStart = minutesToTimeStr(live);
      const newEnd = minutesToTimeStr(Math.min(live + durMins, TOTAL_MINS - 1)); // 立即更新 DOM 用 style（不走 React state，避免卡顿）
      const el = e.currentTarget?.closest ? e.currentTarget : null;
      moveTip(tip, ev.clientX, ev.clientY, `${newStart}–${newEnd}`);
    };
    const onUp = (ev) => {
      const dx = ev.clientX - startX;
      const raw = origStart + dx * minsPerPx;
      const snapped = clamp(snapMins(raw), HBLOCK_VIEW_START, HBLOCK_VIEW_START + HBLOCK_VIEW_MINS - durMins);
      removeTip(tip);
      const newStart = minutesToTimeStr(snapped);
      const newEnd = minutesToTimeStr(Math.min(snapped + durMins, TOTAL_MINS - 1));
      onUpdate(log.id, {
        startTime: `${log.date}T${newStart}:00`,
        endTime: `${log.date}T${newEnd}:00`,
      });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }; // ── 拖拽左边缘（缩短/拉长左侧） ──
  const handleResizeLeft = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const cw = container.getBoundingClientRect().width;
    const minsPerPx = HBLOCK_VIEW_MINS / cw;
    const startX = e.clientX;
    const origStart = startMins;
    const origDur = durMins;
    const tip = makeTip();
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const newStart = clamp(snapMins(origStart + dx * minsPerPx), 0, origStart + origDur - MIN_DURATION);
      const newDur = origStart + origDur - newStart;
      moveTip(tip, ev.clientX, ev.clientY, `${minutesToTimeStr(newStart)} (${newDur}分钟)`);
    };
    const onUp = (ev) => {
      const dx = ev.clientX - startX;
      const newStart = clamp(snapMins(origStart + dx * minsPerPx), 0, origStart + origDur - MIN_DURATION);
      const newDur = origStart + origDur - newStart;
      removeTip(tip);
      const st = minutesToTimeStr(newStart);
      const et = minutesToTimeStr(Math.min(newStart + newDur, TOTAL_MINS - 1));
      onUpdate(log.id, {
        startTime: `${log.date}T${st}:00`,
        endTime: `${log.date}T${et}:00`,
        duration: newDur * 60,
      });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }; // ── 拖拽右边缘（调整时长） ──
  const handleResizeRight = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const cw = container.getBoundingClientRect().width;
    const minsPerPx = HBLOCK_VIEW_MINS / cw;
    const startX = e.clientX;
    const origDur = durMins;
    const tip = makeTip();
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const newDur = Math.max(MIN_DURATION, snapMins(origDur + dx * minsPerPx));
      moveTip(tip, ev.clientX, ev.clientY, `${newDur}分钟`);
    };
    const onUp = (ev) => {
      const dx = ev.clientX - startX;
      const newDur = Math.max(MIN_DURATION, snapMins(origDur + dx * minsPerPx));
      const et = minutesToTimeStr(clamp(startMins + newDur, MIN_DURATION, TOTAL_MINS - 1));
      removeTip(tip);
      onUpdate(log.id, {
        endTime: `${log.date}T${et}:00`,
        duration: newDur * 60,
      });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const leftPct = ((startMins - HBLOCK_VIEW_START) / HBLOCK_VIEW_MINS) * 100;
  const widthPct = (durMins / HBLOCK_VIEW_MINS) * 100;
  const narrow = durMins < 30; // 当前关联的愿景
  const currentPlan = plans.find((p) => p.id === log.planId);
  const currentVision = visions.find((v) => v.id === currentPlan?.visionId); // portal 渲染：工具栏 + 浮层，全部 fixed，全部 pointerEvents:auto
  // 不用全屏遮罩，直接把每个面板单独渲染
  const toolbarEl =
    hovered || showPlanPicker
      ? (() => {
          if (!blockRef.current) return null;
          const r = blockRef.current.getBoundingClientRect();
          return createPortal(
            <div
              style={{
                position: 'fixed',
                top: r.top - 28,
                right: window.innerWidth - r.right,
                zIndex: 9999,
                pointerEvents: 'auto',
                display: 'flex',
                gap: 3,
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                className='flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-xs font-medium whitespace-nowrap shadow-md'
                style={{
                  backgroundColor: hex.bg,
                  fontSize: 10,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setShowPlanPicker((v) => !v);
                }}
              >
                {currentVision ? `● ${currentVision.title}` : '选择愿景'}
              </button>
              <button
                className='w-5 h-5 rounded flex items-center justify-center text-white font-bold shadow-md'
                style={{
                  backgroundColor: '#ef4444',
                  fontSize: 13,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setHovered(false);
                  setShowPlanPicker(false);
                  onDelete(log.id);
                }}
              >
                ×
              </button>
            </div>,
            document.body,
          );
        })()
      : null;
  const pickerEl = showPlanPicker
    ? createPortal(
        <>
          {/* 透明遮罩：点击空白关闭弹窗 */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
            }}
            onMouseDown={() => setShowPlanPicker(false)}
          />
          <div
            className='bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto'
            style={(() => {
              if (!blockRef.current)
                return {
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  minWidth: 220,
                  maxHeight: 280,
                  zIndex: 10000,
                  pointerEvents: 'auto',
                };
              const r = blockRef.current.getBoundingClientRect();
              const PICKER_W = 240;
              const PICKER_MAX_H = 320;
              const MARGIN = 6;
              const vw = window.innerWidth;
              const vh = window.innerHeight; // 水平：优先左对齐，超右边界则右对齐
              let left = r.left;
              if (left + PICKER_W > vw - MARGIN) left = Math.max(MARGIN, r.right - PICKER_W); // 垂直：下方空间够就向下，否则向上
              const spaceBelow = vh - r.bottom - MARGIN;
              const spaceAbove = r.top - MARGIN;
              let top, maxHeight;
              if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
                // 向下弹出
                top = r.bottom + 4;
                maxHeight = Math.min(PICKER_MAX_H, spaceBelow);
              } else {
                // 向上弹出
                maxHeight = Math.min(PICKER_MAX_H, spaceAbove);
                top = r.top - 4 - maxHeight;
              }
              return {
                position: 'fixed',
                top,
                left,
                minWidth: PICKER_W,
                maxHeight,
                zIndex: 10000,
                pointerEvents: 'auto',
              };
            })()}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between px-3 py-2 border-b border-slate-100'>
              <span className='text-xs font-semibold text-slate-600'>关联愿景 / 计划</span>
              <button
                className='w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 font-bold'
                style={{
                  fontSize: 14,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setShowPlanPicker(false);
                }}
              >
                ×
              </button>
            </div>
            <div className='p-1.5'>
              {/* 不关联 */}
              <div
                className='px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer'
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onUpdate(log.id, {
                    planId: '',
                    moduleId: '',
                    moduleName: label || '',
                  });
                  setShowPlanPicker(false);
                  setHovered(false);
                }}
              >
                — 不关联计划
              </div>
              {/* 按愿景分组 */}
              {visions.map((vision, __dnd_i) => {
                const vh = getHex(vision.color);
                const vp = plans.filter((p) => p.visionId === vision.id && p.status !== 'completed');
                if (vp.length === 0) return null;
                return (
                  <div key={vision.id} className='mt-1'>
                    <div
                      className='flex items-center gap-1.5 px-2 py-1 rounded-lg'
                      style={{
                        backgroundColor: vh.light,
                      }}
                    >
                      <div
                        className='w-2 h-2 rounded-full flex-shrink-0'
                        style={{
                          backgroundColor: vh.bg,
                        }}
                      />
                      <span
                        className='text-xs font-semibold'
                        style={{
                          color: vh.text,
                        }}
                      >
                        {vision.title}
                      </span>
                    </div>
                    {vp.map((p, __dnd_i) => (
                      <div key={p.id}>
                        <div className='px-3 py-0.5 text-xs text-slate-400 font-medium'>{p.name}</div>
                        {(p.modules || [])
                          .filter((m) => m.status !== 'completed')
                          .map((m, __dnd_i) => (
                            <div
                              key={m.id}
                              className='flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 rounded-lg cursor-pointer'
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                onUpdate(log.id, {
                                  planId: p.id,
                                  moduleId: m.id,
                                  moduleName: m.name,
                                });
                                setLabel(m.name);
                                setShowPlanPicker(false);
                                setHovered(false);
                              }}
                            >
                              <div
                                className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                                style={{
                                  backgroundColor: vh.bg,
                                }}
                              />
                              {m.name}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                );
              })}
              {/* 无愿景的计划 */}
              {plans
                .filter((p) => !p.visionId && p.status !== 'completed')
                .map((p, __dnd_i) => (
                  <div key={p.id} className='mt-1'>
                    <div className='px-2 py-0.5 text-xs text-slate-400 font-medium bg-slate-50 rounded'>{p.name}</div>
                    {(p.modules || [])
                      .filter((m) => m.status !== 'completed')
                      .map((m, __dnd_i) => (
                        <div
                          key={m.id}
                          className='px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer'
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onUpdate(log.id, {
                              planId: p.id,
                              moduleId: m.id,
                              moduleName: m.name,
                            });
                            setLabel(m.name);
                            setShowPlanPicker(false);
                            setHovered(false);
                          }}
                        >
                          {m.name}
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          </div>
        </>,
        document.body,
      )
    : null;
  return (
    <>
      <div
        ref={blockRef}
        data-log-block
        className='absolute top-1 rounded overflow-hidden select-none w-auto h-auto'
        style={{
          left: `${leftPct}%`,
          backgroundColor: hex.light,
          border: `1.5px solid ${hex.bg}`,
          zIndex: 3,
          minWidth: 8,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {/* 左边缘拖拽 */}
        <div
          className='absolute left-0 top-0 bottom-0 w-2 z-10'
          style={{
            cursor: 'ew-resize',
          }}
          onMouseDown={handleResizeLeft}
        />
        {/* 右边缘拖拽 */}
        <div
          className='absolute right-0 top-0 bottom-0 w-2 z-10'
          style={{
            cursor: 'ew-resize',
          }}
          onMouseDown={handleResizeRight}
        />
        {/* 主体拖拽 */}
        <div
          className='absolute inset-0 mx-2'
          style={{
            cursor: 'grab',
          }}
          onMouseDown={handleMoveStart}
        />
        {/* 文字内容 */}
        <div
          className='absolute inset-0 mx-2 flex flex-col justify-center overflow-hidden pointer-events-none'
          style={{
            zIndex: 6,
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') {
                  setLabel(log.notes || log.moduleName || '');
                  setEditing(false);
                }
              }}
              className='w-full border-0 outline-none bg-transparent text-xs font-medium p-0 pointer-events-auto'
              style={{
                color: hex.text,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className='truncate leading-tight font-medium'
              style={{
                color: hex.text,
                fontSize: 10,
              }}
            >
              {label ||
                (!narrow ? (
                  <span
                    style={{
                      opacity: 0.35,
                    }}
                  >
                    双击编辑
                  </span>
                ) : null)}
            </span>
          )}
          {!narrow && (
            <span
              className='opacity-50 truncate'
              style={{
                color: hex.text,
                fontSize: 9,
              }}
            >
              {minutesToTimeStr(startMins)}–{minutesToTimeStr(startMins + durMins)}
            </span>
          )}
        </div>
      </div>
      {/* 工具栏和浮层：portal 渲染到 body，不受任何 overflow:hidden 影响 */}
      {toolbarEl}
      {pickerEl}
    </>
  );
} // tooltip 工具

function makeTip() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;z-index:99999;background:#1e293b;color:#fff;font-size:11px;padding:3px 7px;border-radius:5px;pointer-events:none;white-space:nowrap;';
  document.body.appendChild(el);
  return el;
}

function moveTip(el, x, y, text) {
  el.textContent = text;
  el.style.left = x + 14 + 'px';
  el.style.top = y - 8 + 'px';
}

function removeTip(el) {
  try {
    document.body.removeChild(el);
  } catch {}
} // ─── 纵向时间块（单日，Y轴=时间） ────────────────────────────────────────────

const VBLOCK_VIEW_START = 7 * 60;
const VBLOCK_VIEW_MINS = (24 - 7) * 60; // 1020

function VBlock({ log, plans, visions, containerRef, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(log.notes || log.moduleName || '');
  const [memo, setMemo] = useState(log.memo || ''); // 备忘内容
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [showDetail, setShowDetail] = useState(false); // 详情编辑面板（点击块打开）
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false); // 选中态，用于键盘删除
  const blockRef = useRef(null);
  const inputRef = useRef(null);
  const leaveTimer = useRef(null);

  // 选中后支持按 Delete/Backspace 键快速删除
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editing && !showDetail) {
        e.preventDefault();
        onDelete(log.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, editing, showDetail, onDelete, log.id]);

  // 点击块外部取消选中
  useEffect(() => {
    if (!selected) return;
    const onDocMouseDown = (e) => {
      if (blockRef.current && !blockRef.current.contains(e.target) && !e.target.closest('[data-vblock-detail]')) {
        setSelected(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [selected]);

  const startMins = useMemo(() => {
    if (!log.startTime) return 0;
    try {
      const d = parseISO(log.startTime);
      return d.getHours() * 60 + d.getMinutes();
    } catch {
      return 0;
    }
  }, [log.startTime]);
  const durMins = useMemo(() => Math.max(MIN_DURATION, Math.round((log.duration || 3600) / 60)), [log.duration]);
  const hex = useMemo(() => {
    const plan = plans.find((p) => p.id === log.planId);
    const vision = plan ? visions.find((v) => v.id === plan.visionId) : null;
    if (vision) return getHex(vision.color);
    if (log.color) return log.color;
    return getHex('indigo');
  }, [log.planId, log.color, plans, visions]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitLabel = () => {
    setEditing(false);
    onUpdate(log.id, { notes: label, moduleName: label || log.moduleName });
  };

  const handleMouseEnter = () => {
    clearTimeout(leaveTimer.current);
    setHovered(true);
  };
  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 200);
  };

  // 根据鼠标坐标探测当前悬停在哪一天的列（用于跨天拖拽）
  const findDayColAt = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    const col = el && el.closest ? el.closest('[data-day-col]') : null;
    return col ? { date: col.getAttribute('data-day-col'), rect: col.getBoundingClientRect() } : null;
  };

  // ── 拖拽移动（按住主体，支持跨天）；移动距离很小则视为单击（onClickAction 可自定义点击行为） ──
  const handleMoveStart = (e, onClickAction) => {
    if (editing) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origStart = startMins;
    const origDate = log.date;
    let dragged = false;
    let tip = null;
    let liveDate = origDate;
    let liveStart = origStart;
    const onMove = (ev) => {
      const totalDist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (!dragged && totalDist > 4) {
        dragged = true;
        tip = makeTip();
      }
      if (!dragged) return;
      // 探测鼠标当前所在的日期列，支持跨天拖拽
      const hit = findDayColAt(ev.clientX, ev.clientY);
      const targetRect = hit ? hit.rect : container.getBoundingClientRect();
      const targetDate = hit ? hit.date : origDate;
      const y = ev.clientY - targetRect.top;
      const pct = y / targetRect.height;
      const raw = VBLOCK_VIEW_START + pct * VBLOCK_VIEW_MINS;
      const live = clamp(snapMins(raw), VBLOCK_VIEW_START, VBLOCK_VIEW_START + VBLOCK_VIEW_MINS - durMins);
      liveDate = targetDate;
      liveStart = live;
      const newStart = minutesToTimeStr(live);
      const newEnd = minutesToTimeStr(Math.min(live + durMins, TOTAL_MINS - 1));
      const dateLabel = targetDate !== origDate ? `${format(parseISO(targetDate), 'M/d')} ` : '';
      moveTip(tip, ev.clientX, ev.clientY, `${dateLabel}${newStart}–${newEnd}`);
    };
    const onUp = () => {
      if (dragged) {
        removeTip(tip);
        const newStart = minutesToTimeStr(liveStart);
        const newEnd = minutesToTimeStr(Math.min(liveStart + durMins, TOTAL_MINS - 1));
        onUpdate(log.id, { date: liveDate, startTime: `${liveDate}T${newStart}:00`, endTime: `${liveDate}T${newEnd}:00` });
      } else if (onClickAction) {
        onClickAction();
      } else {
        // 未拖拽，视为单击选中
        setSelected(true);
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── 拖拽上边缘（调整开始时间） ──
  const handleResizeTop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const ch = container.getBoundingClientRect().height;
    const minsPerPx = VBLOCK_VIEW_MINS / ch;
    const startY = e.clientY;
    const origStart = startMins;
    const origDur = durMins;
    const tip = makeTip();
    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      const newStart = clamp(snapMins(origStart + dy * minsPerPx), 0, origStart + origDur - MIN_DURATION);
      const newDur = origStart + origDur - newStart;
      moveTip(tip, ev.clientX, ev.clientY, `${minutesToTimeStr(newStart)} (${newDur}分钟)`);
    };
    const onUp = (ev) => {
      const dy = ev.clientY - startY;
      const newStart = clamp(snapMins(origStart + dy * minsPerPx), 0, origStart + origDur - MIN_DURATION);
      const newDur = origStart + origDur - newStart;
      removeTip(tip);
      const st = minutesToTimeStr(newStart);
      const et = minutesToTimeStr(Math.min(newStart + newDur, TOTAL_MINS - 1));
      onUpdate(log.id, { startTime: `${log.date}T${st}:00`, endTime: `${log.date}T${et}:00`, duration: newDur * 60 });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── 拖拽下边缘（调整时长） ──
  const handleResizeBottom = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const ch = container.getBoundingClientRect().height;
    const minsPerPx = VBLOCK_VIEW_MINS / ch;
    const startY = e.clientY;
    const origDur = durMins;
    const tip = makeTip();
    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      const newDur = Math.max(MIN_DURATION, snapMins(origDur + dy * minsPerPx));
      moveTip(tip, ev.clientX, ev.clientY, `${newDur}分钟`);
    };
    const onUp = (ev) => {
      const dy = ev.clientY - startY;
      const newDur = Math.max(MIN_DURATION, snapMins(origDur + dy * minsPerPx));
      const et = minutesToTimeStr(clamp(startMins + newDur, MIN_DURATION, TOTAL_MINS - 1));
      removeTip(tip);
      onUpdate(log.id, { endTime: `${log.date}T${et}:00`, duration: newDur * 60 });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const topPct = ((startMins - VBLOCK_VIEW_START) / VBLOCK_VIEW_MINS) * 100;
  const heightPct = (durMins / VBLOCK_VIEW_MINS) * 100;
  const narrow = durMins < 30;
  const currentPlan = plans.find((p) => p.id === log.planId);
  const currentVision = visions.find((v) => v.id === currentPlan?.visionId);

  // 悬浮工具栏：仅一个"编辑"入口按钮，点击打开完整详情面板（更易点击，避免误触）
  const toolbarEl =
    (hovered || selected) && !showDetail
      ? (() => {
          if (!blockRef.current) return null;
          const r = blockRef.current.getBoundingClientRect();
          return createPortal(
            <div
              style={{ position: 'fixed', top: r.top, left: r.right + 6, zIndex: 9999, pointerEvents: 'auto' }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                className='flex items-center gap-1 px-2 py-1 rounded-lg text-white text-xs font-medium whitespace-nowrap shadow-md hover:brightness-110 transition-all'
                style={{ backgroundColor: hex.bg, fontSize: 11 }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelected(true);
                  setShowDetail(true);
                }}
              >
                <Edit3 style={{ width: 11, height: 11 }} />
                编辑
              </button>
            </div>,
            document.body,
          );
        })()
      : null;

  const pickerEl = showPlanPicker
    ? createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onMouseDown={() => setShowPlanPicker(false)} />
          <div
            className='bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto'
            style={(() => {
              if (!blockRef.current) return { position: 'fixed', top: 0, left: 0, minWidth: 220, maxHeight: 280, zIndex: 10000, pointerEvents: 'auto' };
              const r = blockRef.current.getBoundingClientRect();
              const PICKER_W = 240;
              const PICKER_MAX_H = 320;
              const MARGIN = 6;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              let left = r.right + 6;
              if (left + PICKER_W > vw - MARGIN) left = Math.max(MARGIN, r.left - PICKER_W - 6);
              const spaceBelow = vh - r.top - MARGIN;
              const spaceAbove = r.bottom - MARGIN;
              let top, maxHeight;
              if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
                top = r.top;
                maxHeight = Math.min(PICKER_MAX_H, spaceBelow);
              } else {
                maxHeight = Math.min(PICKER_MAX_H, spaceAbove);
                top = r.bottom - maxHeight;
              }
              return { position: 'fixed', top, left, minWidth: PICKER_W, maxHeight, zIndex: 10000, pointerEvents: 'auto' };
            })()}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between px-3 py-2 border-b border-slate-100'>
              <span className='text-xs font-semibold text-slate-600'>关联愿景 / 计划</span>
              <button
                className='w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 font-bold'
                style={{ fontSize: 14 }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setShowPlanPicker(false);
                }}
              >
                ×
              </button>
            </div>
            <div className='p-1.5'>
              <div
                className='px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer'
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onUpdate(log.id, { planId: '', moduleId: '', moduleName: label || '' });
                  setShowPlanPicker(false);
                  setHovered(false);
                }}
              >
                — 不关联计划
              </div>
              {visions.map((vision) => {
                const vh = getHex(vision.color);
                const vp = plans.filter((p) => p.visionId === vision.id && p.status !== 'completed');
                if (vp.length === 0) return null;
                return (
                  <div key={vision.id} className='mt-1'>
                    <div className='flex items-center gap-1.5 px-2 py-1 rounded-lg' style={{ backgroundColor: vh.light }}>
                      <div className='w-2 h-2 rounded-full flex-shrink-0' style={{ backgroundColor: vh.bg }} />
                      <span className='text-xs font-semibold' style={{ color: vh.text }}>{vision.title}</span>
                    </div>
                    {vp.map((p) => (
                      <div key={p.id}>
                        <div className='px-3 py-0.5 text-xs text-slate-400 font-medium'>{p.name}</div>
                        {(p.modules || []).filter((m) => m.status !== 'completed').map((m) => (
                          <div
                            key={m.id}
                            className='flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 rounded-lg cursor-pointer'
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onUpdate(log.id, { planId: p.id, moduleId: m.id, moduleName: m.name });
                              setLabel(m.name);
                              setShowPlanPicker(false);
                              setHovered(false);
                            }}
                          >
                            <div className='w-1.5 h-1.5 rounded-full flex-shrink-0' style={{ backgroundColor: vh.bg }} />
                            {m.name}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
              {plans.filter((p) => !p.visionId && p.status !== 'completed').map((p) => (
                <div key={p.id} className='mt-1'>
                  <div className='px-2 py-0.5 text-xs text-slate-400 font-medium bg-slate-50 rounded'>{p.name}</div>
                  {(p.modules || []).filter((m) => m.status !== 'completed').map((m) => (
                    <div
                      key={m.id}
                      className='px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer'
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onUpdate(log.id, { planId: p.id, moduleId: m.id, moduleName: m.name });
                        setLabel(m.name);
                        setShowPlanPicker(false);
                        setHovered(false);
                      }}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )
    : null;

  // ── 详情编辑面板：点击"编辑"按钮打开，支持精确输入开始/结束时间、名称、关联计划、删除 ──
  const [draftStart, setDraftStart] = useState(minutesToTimeStr(startMins));
  const [draftEnd, setDraftEnd] = useState(minutesToTimeStr(startMins + durMins));
  useEffect(() => {
    if (showDetail) {
      setDraftStart(minutesToTimeStr(startMins));
      setDraftEnd(minutesToTimeStr(startMins + durMins));
    }
  }, [showDetail, startMins, durMins]);

  const applyTimeChange = () => {
    const [sh, sm] = draftStart.split(':').map(Number);
    const [eh, em] = draftEnd.split(':').map(Number);
    if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return;
    let newStartMins = clamp(sh * 60 + sm, 0, TOTAL_MINS - MIN_DURATION);
    let newEndMins = clamp(eh * 60 + em, newStartMins + MIN_DURATION, TOTAL_MINS);
    onUpdate(log.id, {
      startTime: `${log.date}T${minutesToTimeStr(newStartMins)}:00`,
      endTime: `${log.date}T${minutesToTimeStr(newEndMins)}:00`,
      duration: (newEndMins - newStartMins) * 60,
    });
  };

  const detailEl = showDetail
    ? createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10001 }} onMouseDown={() => setShowDetail(false)} />
          <div
            data-vblock-detail
            className='bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72'
            style={(() => {
              if (!blockRef.current) return { position: 'fixed', top: '30%', left: '40%', zIndex: 10002 };
              const r = blockRef.current.getBoundingClientRect();
              const PANEL_W = 288;
              const MARGIN = 10;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              let left = r.right + 10;
              if (left + PANEL_W > vw - MARGIN) left = Math.max(MARGIN, r.left - PANEL_W - 10);
              let top = clamp(r.top, MARGIN, vh - 340);
              return { position: 'fixed', top, left, zIndex: 10002 };
            })()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between mb-3'>
              <span className='text-sm font-semibold text-slate-700'>编辑时间块</span>
              <button className='w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100' onClick={() => setShowDetail(false)}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* 名称 */}
            <label className='text-xs text-slate-400 mb-1 block'>名称</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => onUpdate(log.id, { notes: label, moduleName: label || log.moduleName })}
              placeholder='输入任务名称'
              className='w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 mb-3'
            />

            {/* 精确时间 */}
            <label className='text-xs text-slate-400 mb-1 block'>时间</label>
            <div className='flex items-center gap-2 mb-3'>
              <input
                type='time'
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                onBlur={applyTimeChange}
                className='flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400'
              />
              <span className='text-slate-300 text-sm'>–</span>
              <input
                type='time'
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                onBlur={applyTimeChange}
                className='flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400'
              />
            </div>
            <div className='text-xs text-slate-400 mb-3'>时长 {durMins} 分钟</div>

            {/* 关联计划 */}
            <label className='text-xs text-slate-400 mb-1 block'>关联计划</label>
            <button
              className='w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm mb-4 border transition-all'
              style={
                currentVision
                  ? { backgroundColor: hex.light, borderColor: hex.bg, color: hex.text }
                  : { borderColor: '#e2e8f0', color: '#94a3b8' }
              }
              onMouseDown={(e) => {
                e.stopPropagation();
                setShowPlanPicker((v) => !v);
              }}
            >
              <div className='w-2 h-2 rounded-full flex-shrink-0' style={{ backgroundColor: currentVision ? hex.bg : '#cbd5e1' }} />
              {currentVision ? currentVision.title : '未关联，点击选择'}
            </button>

            {/* 备忘 */}
            <label className='text-xs text-slate-400 mb-1 block'>备忘</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onBlur={() => onUpdate(log.id, { memo })}
              placeholder='记录一些补充说明…'
              rows={3}
              className='w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 mb-4 resize-none'
            />

            {/* 删除 */}
            <button
              className='w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-all'
              onMouseDown={(e) => {
                e.stopPropagation();
                setShowDetail(false);
                onDelete(log.id);
              }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
              删除此时间块
            </button>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={blockRef}
        data-log-block
        className='absolute left-1 right-1 rounded overflow-hidden select-none transition-shadow'
        style={{
          top: `${topPct}%`,
          height: `${heightPct}%`,
          backgroundColor: hex.light,
          border: selected ? `2px solid ${hex.bg}` : `1.5px solid ${hex.bg}`,
          boxShadow: selected ? `0 0 0 3px ${hex.bg}33` : 'none',
          zIndex: selected ? 5 : 3,
          minHeight: 8,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {/* 上边缘拖拽 */}
        <div className='absolute left-0 right-0 top-0 h-2 z-10' style={{ cursor: 'ns-resize' }} onMouseDown={handleResizeTop} />
        {/* 下边缘拖拽 */}
        <div className='absolute left-0 right-0 bottom-0 h-2 z-10' style={{ cursor: 'ns-resize' }} onMouseDown={handleResizeBottom} />
        {/* 主体拖拽（文字区域之外的空白部分） */}
        <div className='absolute inset-0 my-2' style={{ cursor: 'grab' }} onMouseDown={handleMoveStart} />
        {/* 文字内容：始终可直接编辑，单击进入编辑态，同时支持拖拽移动（含跨天） */}
        <div
          className={cn('absolute inset-0 my-1.5 mx-2 flex overflow-hidden z-[6]', narrow ? 'flex-row items-center gap-1.5' : 'flex-col justify-center')}
          style={{ cursor: editing ? 'text' : 'grab' }}
          onMouseDown={(e) => {
            if (editing) return;
            handleMoveStart(e, () => {
              setSelected(true);
              setEditing(true);
            });
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') {
                  setLabel(log.notes || log.moduleName || '');
                  setEditing(false);
                }
              }}
              className='w-full border-0 outline-none bg-transparent text-xs font-medium p-0 pointer-events-auto'
              style={{ color: hex.text }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className='truncate leading-tight font-medium' style={{ color: hex.text, fontSize: 10 }}>
              {label || (!narrow ? <span style={{ opacity: 0.35 }}>点击输入名称</span> : null)}
            </span>
          )}
          <span className='opacity-50 truncate flex-shrink-0' style={{ color: hex.text, fontSize: 9 }}>
            {minutesToTimeStr(startMins)}–{minutesToTimeStr(startMins + durMins)}
          </span>
        </div>
        {/* 备忘标记：有备忘内容时在右上角显示小图标 */}
        {memo && (
          <div className='absolute top-0.5 right-0.5 z-[7] pointer-events-none' title={memo}>
            <BookOpen style={{ width: 9, height: 9, color: hex.text, opacity: 0.55 }} />
          </div>
        )}
      </div>
      {toolbarEl}
      {pickerEl}
      {detailEl}
    </>
  );
} // ─── 纵向单日时间轴（Y轴=时间，仅显示选中日期） ───────────────────────────────

const VIEW_START = 7 * 60;
const VIEW_END = 24 * 60;
const VIEW_MINS = VIEW_END - VIEW_START;
const VWEEK_TRACK_HEIGHT = 900; // 纵向时间轴总高度（px）

// 单日一列：纵向时间轴（配合 VWeekTimeline 并排使用）
function VDayColumn({ date, timeLogs, plans, visions, onAddLog, onUpdateLog, onDeleteLog, isToday, nowMins, isLast }) {
  const containerRef = useRef(null);
  const dayLogs = useMemo(() => timeLogs.filter((l) => l.date === date), [timeLogs, date]);
  const minsToViewPct = (m) => ((m - VIEW_START) / VIEW_MINS) * 100;
  const hourTicks = Array.from({ length: VIEW_MINS / 60 + 1 }, (_, i) => i + 7);
  const nowPct = minsToViewPct(nowMins);

  // 双击背景 → 新建时间块（基于 Y 坐标）
  const lastDown = useRef(0);
  const handleAreaMouseDown = useCallback(
    (e) => {
      if (e.target.closest('[data-log-block]')) return;
      const now = Date.now();
      const prev = lastDown.current || 0;
      if (now - prev < 400) {
        lastDown.current = 0;
        const rowEl = containerRef.current;
        if (!rowEl) return;
        const rect = rowEl.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const pct = y / rect.height;
        const rawMins = VIEW_START + pct * VIEW_MINS;
        const snapped = clamp(snapMins(rawMins), VIEW_START, VIEW_END - 60);
        const color = randomColor();
        const st = minutesToTimeStr(snapped);
        const et = minutesToTimeStr(snapped + 60);
        onAddLog({
          date,
          startTime: `${date}T${st}:00`,
          endTime: `${date}T${et}:00`,
          duration: 3600,
          notes: '',
          moduleName: '',
          moduleId: '',
          planId: '',
          color,
          tags: [],
        });
      } else {
        lastDown.current = now;
      }
    },
    [onAddLog, date],
  );

  // 悬停显示时间线
  const [hoverY, setHoverY] = useState(null);
  const handleAreaMouseMove = useCallback((e) => {
    if (e.target.closest('[data-log-block]')) {
      setHoverY(null);
      return;
    }
    const rowEl = containerRef.current;
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = y / rect.height;
    const snapped = snapMins(clamp(VIEW_START + pct * VIEW_MINS, VIEW_START, VIEW_END));
    setHoverY({ y, label: minutesToTimeStr(snapped) });
  }, []);

  return (
    <div
      ref={containerRef}
      data-day-col={date}
      className={cn('flex-1 relative min-w-[104px]', !isLast && 'border-r border-slate-100')}
      style={{ height: VWEEK_TRACK_HEIGHT, cursor: 'crosshair' }}
      onMouseDown={handleAreaMouseDown}
      onMouseMove={handleAreaMouseMove}
      onMouseLeave={() => setHoverY(null)}
    >
      {/* 整点横线 */}
      {hourTicks.map((h) => (
        <div
          key={h}
          className='absolute left-0 right-0 pointer-events-none'
          style={{ top: `${minsToViewPct(h * 60)}%`, borderTop: h % 6 === 0 ? '1px solid #e2e8f0' : '1px solid #f1f5f9' }}
        />
      ))}
      {/* 每15分钟横线 */}
      {Array.from({ length: VIEW_MINS / 15 + 1 }, (_, i) => i)
        .filter((i) => i % 4 !== 0)
        .map((i) => (
          <div
            key={i}
            className='absolute left-0 right-0 pointer-events-none'
            style={{ top: `${minsToViewPct(VIEW_START + i * 15)}%`, borderTop: '1px dashed #f8fafc' }}
          />
        ))}

      {/* 悬停时间线 */}
      {hoverY && (
        <div className='absolute left-0 right-0 pointer-events-none' style={{ top: hoverY.y, zIndex: 10 }}>
          <div className='h-px w-full bg-indigo-400 opacity-60' />
          <div
            className='absolute -translate-y-1/2 text-white rounded px-1'
            style={{ left: 2, background: '#6366f1', fontSize: 9, whiteSpace: 'nowrap' }}
          >
            {hoverY.label}
          </div>
        </div>
      )}

      {/* 当前时间横线（仅今天所在列） */}
      {isToday && (
        <div className='absolute left-0 right-0 pointer-events-none' style={{ top: `${clamp(nowPct, 0, 100)}%`, zIndex: 8 }}>
          <div className='h-px w-full' style={{ backgroundColor: '#ef4444', opacity: 0.85 }} />
          <div className='absolute -translate-y-1/2 rounded-full' style={{ left: -3, width: 6, height: 6, backgroundColor: '#ef4444' }} />
        </div>
      )}

      {/* 时间块 */}
      {dayLogs.map((log) => (
        <VBlock
          key={log.id}
          log={log}
          plans={plans}
          visions={visions}
          containerRef={containerRef}
          onUpdate={onUpdateLog}
          onDelete={onDeleteLog}
        />
      ))}
    </div>
  );
}

// 7天并排的纵向周时间轴：左侧统一时间刻度，右侧7列每列一天
function VWeekTimeline({ weekStart, timeLogs, plans, visions, onAddLog, onUpdateLog, onDeleteLog }) {
  const minsToViewPct = (m) => ((m - VIEW_START) / VIEW_MINS) * 100;
  const hourTicks = Array.from({ length: VIEW_MINS / 60 + 1 }, (_, i) => i + 7);
  const today = format(new Date(), 'yyyy-MM-dd');

  const [nowMins, setNowMins] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    };
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className='bg-white rounded-xl border border-slate-200 overflow-hidden select-none'>
      <div className='overflow-x-auto'>
        <div className='flex' style={{ minWidth: 56 + 7 * 104 }}>
          {/* 左上角占位 */}
          <div className='w-14 flex-shrink-0 border-r border-b border-slate-100 bg-slate-50 sticky left-0 z-20' />
          {/* 日期表头 */}
          {days.map((day) => {
            const ds = format(day, 'yyyy-MM-dd');
            const isTod = ds === today;
            return (
              <div
                key={ds}
                className={cn(
                  'flex-1 min-w-[104px] flex flex-col items-center justify-center py-1.5 border-b border-slate-100',
                  isTod ? 'bg-indigo-50' : 'bg-slate-50',
                )}
              >
                <span className={cn('text-xs', isTod ? 'text-indigo-500 font-medium' : 'text-slate-400')}>
                  周{DAY_LABELS[(day.getDay() + 6) % 7]}
                </span>
                <span className={cn('text-sm font-bold', isTod ? 'text-indigo-600' : 'text-slate-600')}>{format(day, 'd')}</span>
              </div>
            );
          })}
        </div>

        <div className='flex' style={{ minWidth: 56 + 7 * 104 }}>
          {/* 左侧时间刻度 */}
          <div className='w-14 flex-shrink-0 border-r border-slate-100 relative bg-slate-50 sticky left-0 z-10' style={{ height: VWEEK_TRACK_HEIGHT }}>
            {hourTicks.map((h) => (
              <div
                key={h}
                className='absolute right-2 text-xs text-slate-300 -translate-y-1/2'
                style={{ top: `${minsToViewPct(h * 60)}%` }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {/* 7天并排的纵向列 */}
          {days.map((day, i) => {
            const ds = format(day, 'yyyy-MM-dd');
            return (
              <VDayColumn
                key={ds}
                date={ds}
                timeLogs={timeLogs}
                plans={plans}
                visions={visions}
                onAddLog={onAddLog}
                onUpdateLog={onUpdateLog}
                onDeleteLog={onDeleteLog}
                isToday={ds === today}
                nowMins={nowMins}
                isLast={i === 6}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
} // ─── 旧版：横向日时间轴（每行=一天，X轴=时间，已弃用，保留代码备查） ─────────────────────


function ExportDialog({ open, onClose, timeLogs, plans, visions, reviewNotes, defaultDates, weekStart }) {
  const [selectedDates, setSelectedDates] = useState([]);
  const [exportFormat, setExportFormat] = useState('csv'); // 每次弹窗打开时同步默认选中日期
  useEffect(() => {
    if (open && defaultDates?.length) {
      setSelectedDates(defaultDates);
    }
  }, [open, defaultDates]); // 生成本周7天供选择
  const weekDays = useMemo(
    () =>
      Array.from(
        {
          length: 7,
        },
        (_, i) => {
          const d = addDays(weekStart, i);
          return {
            date: format(d, 'yyyy-MM-dd'),
            label: format(d, 'M/d EEE', {
              locale: zhCN,
            }),
          };
        },
      ),
    [weekStart],
  );
  const toggleDate = (d) => {
    setSelectedDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };
  const handleExport = () => {
    const logsToExport = timeLogs.filter((l) => selectedDates.includes(l.date));
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    const visionMap = Object.fromEntries(visions.map((v) => [v.id, v]));
    if (exportFormat === 'csv') {
      // CSV 格式
      const headers = ['日期', '模块名称', '所属计划', '所属愿景', '开始时间', '结束时间', '时长(分钟)', '备注', '备忘', '当日复盘'];
      const rows = logsToExport.map((log) => {
        const plan = planMap[log.planId];
        const vision = plan ? visionMap[plan.visionId] : null;
        const startFmt = log.startTime ? format(parseISO(log.startTime), 'HH:mm') : '';
        const endFmt = log.endTime ? format(parseISO(log.endTime), 'HH:mm') : '';
        const dur = log.duration ? Math.round(log.duration / 60) : 0;
        const review = reviewNotes[log.date] || '';
        return [log.date, log.moduleName || '', plan?.name || '', vision?.title || '', startFmt, endFmt, dur, log.notes || '', log.memo || '', review];
      });
      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `时间日志_${selectedDates.join('_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // JSON 格式
      const data = selectedDates.map((date) => ({
        date,
        reviewNote: reviewNotes[date] || '',
        logs: logsToExport
          .filter((l) => l.date === date)
          .map((log) => {
            const plan = planMap[log.planId];
            const vision = plan ? visionMap[plan.visionId] : null;
            return {
              moduleName: log.moduleName || '',
              planName: plan?.name || '',
              visionTitle: vision?.title || '',
              startTime: log.startTime ? format(parseISO(log.startTime), 'HH:mm') : '',
              endTime: log.endTime ? format(parseISO(log.endTime), 'HH:mm') : '',
              durationMinutes: log.duration ? Math.round(log.duration / 60) : 0,
              notes: log.notes || '',
            };
          }),
      }));
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `时间日志_${selectedDates.join('_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FileDown className='w-5 h-5 text-indigo-500' /> 导出时间日志
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4 py-2'>
          {/* 选择日期 */}
          <div>
            <Label className='text-sm font-medium text-slate-700 mb-2 block flex items-center gap-1.5'>
              <Calendar className='w-4 h-4' /> 选择导出日期
            </Label>
            <div className='grid grid-cols-4 gap-1.5'>
              {weekDays.map(({ date, label }, __dnd_i) => {
                const isSelected = selectedDates.includes(date);
                const hasLogs = timeLogs.some((l) => l.date === date);
                return (
                  <button
                    key={date}
                    onClick={() => toggleDate(date)}
                    className={cn('py-1.5 px-2 rounded-lg text-xs font-medium border transition-all', isSelected ? 'bg-indigo-600 text-white border-indigo-600' : hasLogs ? 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}
                  >
                    {label}
                    {hasLogs && <span className='ml-1 text-xs opacity-70'>●</span>}
                  </button>
                );
              })}
            </div>
            <div className='flex gap-2 mt-2'>
              <button className='text-xs text-indigo-600 hover:underline' onClick={() => setSelectedDates(weekDays.map((d) => d.date))}>
                全选本周
              </button>
              <button className='text-xs text-slate-400 hover:underline' onClick={() => setSelectedDates([])}>
                清空
              </button>
            </div>
          </div>

          {/* 导出格式 */}
          <div>
            <Label className='text-sm font-medium text-slate-700 mb-2 block'>导出格式</Label>
            <div className='flex gap-3'>
              {[
                {
                  value: 'csv',
                  label: 'CSV 表格',
                },
                {
                  value: 'json',
                  label: 'JSON 数据',
                },
              ].map((opt, __dnd_i) => (
                <button key={opt.value} onClick={() => setExportFormat(opt.value)} className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-all', exportFormat === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 统计预览 */}
          {selectedDates.length > 0 &&
            (() => {
              const logCount = timeLogs.filter((l) => selectedDates.includes(l.date)).length;
              const noteCount = selectedDates.filter((d) => reviewNotes[d]?.trim()).length;
              return (
                <div className='bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-0.5'>
                  <div>
                    已选 {selectedDates.length} 天，共 {logCount} 条时间记录
                  </div>
                  {noteCount > 0 && <div>{noteCount} 天有复盘笔记</div>}
                </div>
              );
            })()}
        </div>
        <DialogFooter className='gap-2 flex-wrap'>
          <Button variant='outline' onClick={onClose}>
            取消
          </Button>
          <Button
            variant='outline'
            disabled={selectedDates.length === 0 || !selectedDates.some((d) => reviewNotes[d]?.trim())}
            className='gap-1.5 text-slate-600'
            onClick={() => {
              const sorted = [...selectedDates].sort();
              const lines = sorted
                .map((date) => {
                  const note = reviewNotes[date]?.trim();
                  const dateLabel = format(new Date(date), 'yyyy年M月d日 EEEE', {
                    locale: zhCN,
                  });
                  return note ? `${dateLabel}\n${'─'.repeat(30)}\n${note}` : `${dateLabel}\n${'─'.repeat(30)}\n（暂无复盘笔记）`;
                })
                .join('\n\n');
              const blob = new Blob([lines], {
                type: 'text/plain;charset=utf-8',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `复盘笔记_${sorted[0]}${sorted.length > 1 ? `_至_${sorted[sorted.length - 1]}` : ''}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              onClose();
            }}
          >
            <FileDown className='w-4 h-4' /> 下载复盘笔记
          </Button>
          <Button onClick={handleExport} disabled={selectedDates.length === 0} className='bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5'>
            <Download className='w-4 h-4' /> 下载时间记录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} // ─── Main Page ────────────────────────────────────────────────────────────────
export default function TimeLog() {
  const { plans, visions, timeLogs, addTimeLog, updateTimeLog, deleteTimeLog, activeTimer, startTimer, getAllModules, getLogsForDate, dailyPlans, getDailyPlansForDate, addDailyPlanItem, updateDailyPlanItem, toggleDailyPlanItem, removeDailyPlanItem, reviewNotes, updateReviewNote } = useApp();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showTimer, setShowTimer] = useState(false);
  const [startModuleId, setStartModuleId] = useState(''); // 弹窗状态（新建 & 编辑共用 LogDialog）
  const [logDialog, setLogDialog] = useState({
    open: false,
    data: null,
  }); // data: initialData
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDates, setExportDates] = useState([]);
  const [openPickerId, setOpenPickerId] = useState(null); // 当前展开计划选择的任务行 id
  const [focusNewPlanId, setFocusNewPlanId] = useState(null); // 需要聚焦的新任务 id
  // 使用 AppContext 中的 dailyPlans
  const getDailyPlans = (date) => getDailyPlansForDate(date);
  const addDailyPlan = (date) => {
    const id = `dp-${Date.now()}`;
    addDailyPlanItem(date, id);
    setFocusNewPlanId(id);
  };
  const updateDailyPlan = (date, id, patch) => updateDailyPlanItem(date, id, patch);
  const toggleDailyPlan = (date, id) => toggleDailyPlanItem(date, id);
  const removeDailyPlan = (date, id) => removeDailyPlanItem(date, id);
  const allModules = getAllModules();
  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), {
      weekStartsOn: 1,
    });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);
  const weekLabel = useMemo(() => `${format(weekStart, 'M月d日')} – ${format(addDays(weekStart, 6), 'M月d日')}`, [weekStart]);
  const dayLogs = getLogsForDate(selectedDate);
  const totalSeconds = dayLogs.reduce((s, l) => s + (l.duration || 0), 0);
  const planColorMap = useMemo(() => {
    const map = {};
    plans.forEach((p) => {
      const v = visions.find((v) => v.id === p.visionId);
      map[p.id] = v ? getHex(v.color) : getHex('indigo');
    });
    return map;
  }, [plans, visions]); // 时间轴：双击新建色块
  const handleAddLog = useCallback(
    (data) => {
      addTimeLog(data);
    },
    [addTimeLog],
  ); // 时间轴：内联更新（文字/时长）
  const handleUpdateLog = useCallback(
    (id, data) => {
      updateTimeLog(id, data);
    },
    [updateTimeLog],
  ); // 下方复盘列表：点击 → 弹窗编辑（仍保留弹窗方式供详细编辑）
  const handleClickLog = useCallback((log) => {
    const st = log.startTime ? format(parseISO(log.startTime), 'HH:mm') : '09:00';
    setLogDialog({
      open: true,
      data: {
        id: log.id,
        date: log.date,
        startTime: st,
        moduleId: log.moduleId,
        duration: log.duration,
        notes: log.notes,
        tags: log.tags,
      },
    });
  }, []); // 弹窗保存（仅用于下方复盘列表的详细编辑）
  const handleSaveLog = useCallback(
    (data) => {
      if (data.id) {
        updateTimeLog(data.id, {
          moduleId: data.moduleId,
          moduleName: data.moduleName,
          planId: data.planId,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: data.duration,
          notes: data.notes,
          tags: data.tags,
        });
      } else {
        addTimeLog(data);
      }
    },
    [addTimeLog, updateTimeLog],
  );
  const handleStartTimer = () => {
    if (!startModuleId) return;
    const mod = allModules.find((m) => m.id === startModuleId);
    if (mod) {
      const plan = plans.find((p) => p.modules.some((m) => m.id === startModuleId));
      startTimer(startModuleId, mod.name, plan?.id);
      setShowTimer(true);
    }
  };
  return (
    <div className='p-4 md:p-6 max-w-6xl mx-auto space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-slate-800'>时间日志</h1>
          <p className='text-sm text-slate-500 mt-0.5'>双击行空白处创建色块 · 双击色块编辑文字 · 左右拖拽边缘调整时长 · 拖拽主体移动位置</p>
        </div>
        <div className='flex gap-2'>
          <Button size='sm' onClick={() => (activeTimer ? setShowTimer(true) : null)} className={cn('gap-1.5 text-white', activeTimer ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700')}>
            <Timer className='w-3.5 h-3.5' />
            {activeTimer ? '查看计时' : '开始计时'}
          </Button>
        </div>
      </div>

      {/* 快速计时 */}
      {!activeTimer && (
        <Card>
          <CardContent className='pt-3 pb-3'>
            <div className='flex gap-2 items-center'>
              <div className='flex-1'>
                <Select value={startModuleId} onValueChange={setStartModuleId}>
                  <SelectTrigger className='h-9'>
                    <SelectValue placeholder='选择模块开始计时...' />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((p) => p.status !== 'completed')
                      .map((p, __dnd_i) => (
                        <div key={p.id}>
                          <div className='px-2 py-1 text-xs text-slate-400 font-medium bg-slate-50'>{p.name}</div>
                          {p.modules
                            .filter((m) => m.status !== 'completed')
                            .map((m, __dnd_i) => (
                              <SelectItem key={m.id} value={m.id} className='pl-4'>
                                {m.name}
                              </SelectItem>
                            ))}
                        </div>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleStartTimer} disabled={!startModuleId} className='bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9 flex-shrink-0'>
                <Play className='w-4 h-4' /> 开始
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 纵向时间轴 */}
      <div>
        <div className='flex items-center justify-between mb-2'>
          <button onClick={() => setWeekOffset((v) => v - 1)} className='p-1.5 rounded-lg hover:bg-slate-100'>
            <ChevronLeft className='w-4 h-4' />
          </button>
          <div className='flex items-center gap-3'>
            <span className='text-sm font-medium text-slate-700'>{weekLabel}</span>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className='text-xs text-indigo-600 hover:underline'>
                回到本周
              </button>
            )}
          </div>
          <button onClick={() => setWeekOffset((v) => v + 1)} className='p-1.5 rounded-lg hover:bg-slate-100'>
            <ChevronRight className='w-4 h-4' />
          </button>
        </div>

        {/* 本周7天快速切换 */}
        <div className='flex items-center justify-center gap-1.5 mb-3'>
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
            const ds = format(day, 'yyyy-MM-dd');
            const isSel = ds === selectedDate;
            const isTod = ds === today;
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={cn(
                  'flex flex-col items-center justify-center w-11 h-12 rounded-xl transition-all',
                  isSel ? 'bg-indigo-600 text-white shadow-sm' : isTod ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-500',
                )}
              >
                <span className='text-[10px] opacity-70'>周{DAY_LABELS[(day.getDay() + 6) % 7]}</span>
                <span className='text-sm font-bold'>{format(day, 'd')}</span>
              </button>
            );
          })}
        </div>

<div className='text-xs text-slate-400 text-center mb-1.5 flex items-center justify-center gap-4 flex-wrap'>
<span>双击空白 → 创建色块</span>
<span>点击色块文字 → 直接输入名称</span>
<span>点击"编辑"按钮 → 精确设置时间/计划</span>
<span>拖拽上下边缘 → 调整时长</span>
<span>拖拽色块 → 移动时间（可跨天拖到其他日期）</span>
<span>选中后按 Delete → 删除</span>
        </div>
        <VWeekTimeline weekStart={weekStart} timeLogs={timeLogs} plans={plans} visions={visions} onAddLog={handleAddLog} onUpdateLog={handleUpdateLog} onDeleteLog={deleteTimeLog} />
      </div>

      {/* 当日计划 + 当日复盘 */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-4'>
        {/* 当日计划 */}
        <Card className='relative'>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm flex items-center gap-1.5'>
                <CheckCircle2 className='w-4 h-4 text-indigo-500' />
                当日计划
              </CardTitle>
              <div className='flex items-center gap-1.5'>
                <span className='text-xs text-slate-400'>
                  {format(new Date(selectedDate), 'M月d日', {
                    locale: zhCN,
                  })}
                </span>
                <Button size='sm' variant='ghost' className='h-6 w-6 p-0 text-indigo-500 hover:bg-indigo-50' onClick={() => addDailyPlan(selectedDate)} title='新增任务'>
                  <Plus className='w-3.5 h-3.5' />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-1.5 pb-3'>
            {/* 计划列表 */}
            {getDailyPlans(selectedDate).length === 0 ? (
              <div className='h-16 flex items-center justify-center text-xs text-slate-400'>
                <div className='text-center'>
                  <Circle className='w-5 h-5 mx-auto mb-1 opacity-30' />
                  点击 + 添加今日任务
                </div>
              </div>
            ) : (
              getDailyPlans(selectedDate).map((item, __dnd_i) => {
                // 根据关联计划取颜色
                const vh = item.visionId
                  ? getHex(visions.find((v) => v.id === item.visionId)?.color || 'indigo')
                  : {
                      bg: '#94a3b8',
                      light: '#f8fafc',
                      text: '#64748b',
                    }; // 构建下拉选项：只显示计划名+模块名，不含愿景
                const moduleOptions = [];
                visions.forEach((vis) => {
                  const vps = plans.filter((p) => p.visionId === vis.id && p.status !== 'completed');
                  vps.forEach((p) => {
                    (p.modules || [])
                      .filter((m) => m.status !== 'completed')
                      .forEach((m) => {
                        moduleOptions.push({
                          value: m.id,
                          label: `${p.name} / ${m.name}`,
                          visionId: vis.id,
                          visionColor: vis.color,
                          planId: p.id,
                          planName: p.name,
                          moduleName: m.name,
                          estimatedHours: m.estimatedHours || 0,
                        });
                      });
                  });
                });
                plans
                  .filter((p) => !p.visionId && p.status !== 'completed')
                  .forEach((p) => {
                    (p.modules || [])
                      .filter((m) => m.status !== 'completed')
                      .forEach((m) => {
                        moduleOptions.push({
                          value: m.id,
                          label: `${p.name} / ${m.name}`,
                          visionId: '',
                          visionColor: '',
                          planId: p.id,
                          planName: p.name,
                          moduleName: m.name,
                          estimatedHours: m.estimatedHours || 0,
                        });
                      });
                  }); // 真实创建日（兼容旧数据没有 createdDate 字段的情况）
                const itemCreatedDate = item.createdDate || selectedDate;
                const itemTargetDate = item.targetDate || itemCreatedDate;
                const isTargetDiff = itemTargetDate !== itemCreatedDate; // 跨日任务：在目标日展示时，显示"来自 M月d日"；在创建日展示时，显示"截止 M月d日"
                const isViewingTarget = itemCreatedDate !== selectedDate; // 正在用目标日期视角查看
                return (
                  <div key={item.id} className={cn('group rounded-xl border transition-all', item.done ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/20')}>
                    <div className='flex items-center gap-2 px-2 py-1.5'>
                      {/* 完成勾选 */}
                      <button className='flex-shrink-0' onClick={() => toggleDailyPlan(itemCreatedDate, item.id)}>
                        {item.done ? (
                          <CheckCircle2
                            className='w-3.5 h-3.5'
                            style={{
                              color: vh.bg,
                            }}
                          />
                        ) : (
                          <Circle className='w-3.5 h-3.5 text-slate-200 hover:text-slate-300' />
                        )}
                      </button>
                      {/* 任务名称输入框 */}
                      <input
                        className={cn('flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-300', item.done ? 'line-through text-slate-400' : 'text-slate-700')}
                        placeholder='输入任务名称…'
                        value={item.customName}
                        ref={(el) => {
                          if (el && focusNewPlanId === item.id) {
                            el.focus();
                            setFocusNewPlanId(null);
                          }
                        }}
                        onChange={(e) =>
                          updateDailyPlan(itemCreatedDate, item.id, {
                            customName: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addDailyPlan(selectedDate);
                          }
                        }}
                      />
                      {/* 跨日标签 */}
                      {(isTargetDiff || isViewingTarget) && (
                        <span className='flex-shrink-0 text-xs px-1 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-100 whitespace-nowrap'>{isViewingTarget ? `来自 ${format(new Date(itemCreatedDate), 'M/d')}` : `→ ${format(new Date(itemTargetDate), 'M/d')}`}</span>
                      )}
                      {/* 关联计划色块触发器 */}
                      {(() => {
                        const isOpen = openPickerId === item.id;
                        return (
                          <div className='relative flex-shrink-0'>
                            <button
                              data-picker-trigger={item.id}
                              className='w-4 h-4 rounded-full flex items-center justify-center focus:outline-none'
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenPickerId(isOpen ? null : item.id);
                              }}
                              title={item.moduleId ? item.planName + (item.moduleName ? ` / ${item.moduleName}` : '') : '关联计划'}
                            >
                              {item.moduleId ? (
                                <div
                                  className='w-4 h-4 rounded-full border-2 border-white shadow-sm'
                                  style={{
                                    backgroundColor: vh.bg,
                                  }}
                                />
                              ) : (
                                <div className='w-4 h-4 rounded-full border border-dashed border-slate-300 flex items-center justify-center'>
                                  <Plus className='w-2.5 h-2.5 text-slate-300' />
                                </div>
                              )}
                            </button>
                            {isOpen &&
                              createPortal(
                                <>
                                  {/* 遮罩，点击关闭 */}
                                  <div className='fixed inset-0 z-[9998]' onMouseDown={() => setOpenPickerId(null)} />
                                  {/* 自定义下拉列表 */}
                                  <div
                                    className='fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px] max-h-48 overflow-y-auto'
                                    style={(() => {
                                      const el = document.querySelector(`[data-picker-trigger="${item.id}"]`);
                                      if (!el)
                                        return {
                                          top: 0,
                                          left: 0,
                                        };
                                      const r = el.getBoundingClientRect();
                                      return {
                                        top: r.bottom + 4,
                                        left: Math.min(r.right - 160, window.innerWidth - 168),
                                      };
                                    })()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {/* 不关联选项 */}
                                    <div
                                      className='flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 cursor-pointer'
                                      onMouseDown={() => {
                                        updateDailyPlan(selectedDate, item.id, {
                                          moduleId: '',
                                          planId: '',
                                          moduleName: '',
                                          planName: '',
                                          visionId: '',
                                          estimatedHours: 0,
                                        });
                                        setOpenPickerId(null);
                                      }}
                                    >
                                      <div className='w-2 h-2 rounded-full border border-dashed border-slate-300 flex-shrink-0' />
                                      <span>不关联</span>
                                    </div>
                                    {/* 计划模块选项 */}
                                    {moduleOptions.map((o, __dnd_i) => {
                                      const oc = o.visionId
                                        ? getHex(visions.find((v) => v.id === o.visionId)?.color || 'indigo')
                                        : {
                                            bg: '#94a3b8',
                                          };
                                      return (
                                        <div
                                          key={o.value}
                                          className={cn('flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer', item.moduleId === o.value ? 'bg-slate-50 font-medium text-slate-800' : 'text-slate-600 hover:bg-slate-50')}
                                          onMouseDown={() => {
                                            updateDailyPlan(selectedDate, item.id, {
                                              moduleId: o.value,
                                              planId: o.planId,
                                              moduleName: o.moduleName,
                                              planName: o.planName,
                                              visionId: o.visionId,
                                              estimatedHours: o.estimatedHours,
                                            });
                                            setOpenPickerId(null);
                                          }}
                                        >
                                          <div
                                            className='w-2 h-2 rounded-full flex-shrink-0'
                                            style={{
                                              backgroundColor: oc.bg,
                                            }}
                                          />
                                          <span className='truncate'>{o.label}</span>
                                        </div>
                                      );
                                    })}
                                    {moduleOptions.length === 0 && <div className='px-3 py-2 text-xs text-slate-300 text-center'>暂无可用计划</div>}
                                  </div>
                                </>,
                                document.body,
                              )}
                          </div>
                        );
                      })()}
                      {/* 目标日期选择器 */}
                      <div className='relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all'>
                        <button
                          className='w-4 h-4 flex items-center justify-center text-slate-300 hover:text-indigo-400 transition-colors'
                          title={`目标完成日期：${itemTargetDate}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const input = e.currentTarget.nextSibling;
                            input.showPicker ? input.showPicker() : input.click();
                          }}
                        >
                          <Calendar className='w-3 h-3' />
                        </button>
                        <input
                          type='date'
                          className='absolute inset-0 opacity-0 w-4 h-4 cursor-pointer'
                          value={itemTargetDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateDailyPlan(itemCreatedDate, item.id, {
                                targetDate: e.target.value,
                              });
                            }
                          }}
                        />
                      </div>
                      {/* 删除按钮 */}
                      <button className='opacity-0 group-hover:opacity-100 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 transition-all' onClick={() => removeDailyPlan(itemCreatedDate, item.id)}>
                        <Trash2 className='w-3 h-3' />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* 当日总计时 */}
            {totalSeconds > 0 && (
              <div className='pt-1 mt-1 border-t border-slate-100 flex items-center justify-between'>
                <span className='text-xs text-slate-400'>今日总计</span>
                <span className='text-xs font-bold text-indigo-600'>{formatDuration(totalSeconds)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 当日复盘 */}
        <div className='lg:col-span-3 space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-medium text-slate-500 flex items-center gap-1'>
              <BookOpen className='w-3.5 h-3.5' />
              {format(new Date(selectedDate), 'M月d日 EEEE', {
                locale: zhCN,
              })}{' '}
              当日复盘
            </span>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                className='h-7 text-xs gap-1'
                onClick={() => {
                  setExportDates([selectedDate]);
                  setExportOpen(true);
                }}
              >
                <Download className='w-3 h-3' /> 导出
              </Button>
              <div className='flex gap-1'>
                {Array.from(
                  {
                    length: 7,
                  },
                  (_, i) => addDays(weekStart, i),
                ).map((day, __dnd_i) => {
                  const ds = format(day, 'yyyy-MM-dd');
                  const isSelected = ds === selectedDate;
                  const isTod = ds === today;
                  return (
                    <button key={ds} onClick={() => setSelectedDate(ds)} className={cn('w-7 h-7 text-xs rounded-lg transition-all font-medium', isSelected ? 'bg-indigo-600 text-white' : isTod ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500')}>
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 复盘笔记输入 */}
          <Card>
            <CardContent className='pt-3 pb-3'>
              <div className='flex items-center justify-between mb-1.5'>
                <Label className='text-xs text-slate-500'>今日复盘笔记</Label>
                {reviewNotes[selectedDate]?.trim() && (
                  <button
                    className='flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 transition-colors'
                    title='下载复盘笔记'
                    onClick={() => {
                      const note = reviewNotes[selectedDate] || '';
                      const dateLabel = format(new Date(selectedDate), 'yyyy年M月d日', {
                        locale: zhCN,
                      });
                      const content = `${dateLabel} 复盘笔记\n${'─'.repeat(30)}\n\n${note}`;
                      const blob = new Blob([content], {
                        type: 'text/plain;charset=utf-8',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `复盘笔记_${selectedDate}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className='w-3 h-3' />
                    下载笔记
                  </button>
                )}
              </div>
              <Textarea value={reviewNotes[selectedDate] || ''} onChange={(e) => updateReviewNote(selectedDate, e.target.value)} placeholder='记录今天的收获、问题和明日计划...' rows={3} className='text-sm resize-none' />
            </CardContent>
          </Card>

          {/* 时间记录列表（双列，按时间倒序） */}
          {dayLogs.length === 0 ? (
            <Card>
              <CardContent className='py-8 text-center text-slate-400'>
                <Clock className='w-7 h-7 mx-auto mb-2 opacity-30' />
                <div className='text-sm'>本日暂无时间记录</div>
                <div className='text-xs mt-1'>点击上方时间轴空白处快速添加</div>
              </CardContent>
            </Card>
          ) : (
            <div className='grid grid-cols-2 gap-2'>
              {[...dayLogs]
                .sort((a, b) => {
                  const ta = a.startTime ? new Date(a.startTime).getTime() : a.startMinutes || 0;
                  const tb = b.startTime ? new Date(b.startTime).getTime() : b.startMinutes || 0;
                  return tb - ta; // 倒序：最近的在前
                })
                .map((log, __dnd_i) => {
                  const hex = planColorMap[log.planId] || getHex('indigo');
                  return (
                    <Card
                      key={log.id}
                      className='hover:shadow-sm transition-all cursor-pointer overflow-hidden'
                      style={{
                        borderLeft: `3px solid ${hex.bg}`,
                      }}
                      onClick={() => handleClickLog(log)}
                    >
                      <CardContent className='py-2.5 px-3'>
                        <div className='flex items-start gap-2'>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2 flex-wrap'>
                              <span className='text-sm font-medium text-slate-800 truncate'>{log.moduleName || '未知模块'}</span>
                              <span
                                className='text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0'
                                style={{
                                  backgroundColor: hex.light,
                                  color: hex.text,
                                }}
                              >
                                {formatDuration(log.duration)}
                              </span>
                            </div>
                            <div className='flex items-center gap-1.5 mt-0.5 text-xs text-slate-400'>
                              <Clock className='w-3 h-3 flex-shrink-0' />
                              {formatTime(log.startTime)} – {formatTime(log.endTime)}
                            </div>
                            {log.notes && <div className='mt-0.5 text-xs text-slate-500 truncate'>{log.notes}</div>}
                            {log.memo && (
                              <div className='mt-1 flex items-start gap-1 text-xs text-slate-400 bg-slate-50 rounded-md px-1.5 py-1'>
                                <BookOpen className='w-3 h-3 flex-shrink-0 mt-0.5 opacity-60' />
                                <span className='line-clamp-2'>{log.memo}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTimeLog(log.id);
                            }}
                            className='p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* 导出弹窗 */}
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} timeLogs={timeLogs} plans={plans} visions={visions} reviewNotes={reviewNotes} defaultDates={exportDates} weekStart={weekStart} />

      {/* 新建/编辑 时间块弹窗 */}
      <LogDialog
        open={logDialog.open}
        onClose={() =>
          setLogDialog({
            open: false,
            data: null,
          })
        }
        onSave={handleSaveLog}
        onDelete={deleteTimeLog}
        initialData={logDialog.data}
        plans={plans}
        visions={visions}
        planColorMap={planColorMap}
      />

      {/* 秒表弹窗 */}
      <Dialog open={showTimer} onOpenChange={setShowTimer}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Timer className='w-5 h-5 text-indigo-500' /> 秒表计时
            </DialogTitle>
          </DialogHeader>
          {activeTimer ? (
            <Stopwatch onStop={() => setShowTimer(false)} />
          ) : (
            <div className='text-center py-6 text-slate-400'>
              <div className='text-sm'>当前没有进行中的计时</div>
              <Button variant='outline' className='mt-3' onClick={() => setShowTimer(false)}>
                关闭
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
