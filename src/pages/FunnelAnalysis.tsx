import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import FunnelChart from '../components/FunnelChart';
import Empty from '../components/Empty';
import {
  ArrowLeft,
  Calendar,
  BarChart2,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Download,
  Share2,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import Modal from '../components/Modal';
import type { FunnelAnalysis, FunnelAnalysisStep } from '../types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface ComparePeriod {
  startDate: string;
  endDate: string;
  label: string;
}

export default function FunnelAnalysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentFunnel, funnelAnalysis, loadFunnelById, loadAnalysis, loading, error } = useAppStore();
  
  const [dateRange, setDateRange] = useState('30');
  const [breakdown, setBreakdown] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [compareAnalysis, setCompareAnalysis] = useState<FunnelAnalysis | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [activePeriodTab, setActivePeriodTab] = useState<'current' | 'compare'>('current');

  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => 
    new Date(endDate.getTime() - parseInt(dateRange) * 24 * 60 * 60 * 1000),
    [endDate, dateRange]
  );

  const [compareStart, setCompareStart] = useState<string>(() => {
    const compareEnd = addDays(new Date(), -parseInt(dateRange));
    const compareStart = addDays(compareEnd, -parseInt(dateRange));
    return formatDate(compareStart);
  });
  const [compareEnd, setCompareEnd] = useState<string>(() => {
    return formatDate(addDays(new Date(), -parseInt(dateRange)));
  });

  useEffect(() => {
    if (id) {
      loadFunnelById(id);
    }
  }, [id, loadFunnelById]);

  useEffect(() => {
    if (id) {
      loadAnalysis(id, {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        breakdown: breakdown || undefined,
      });
    }
  }, [id, dateRange, breakdown, startDate, endDate, loadAnalysis]);

  useEffect(() => {
    if (showCompare && id && compareStart && compareEnd) {
      loadCompareAnalysis();
    }
  }, [showCompare, id, compareStart, compareEnd, breakdown]);

  const loadCompareAnalysis = async () => {
    if (!id) return;
    setCompareLoading(true);
    try {
      const params = {
        startDate: compareStart,
        endDate: compareEnd,
        breakdown: breakdown || undefined,
      };
      const searchParams = new URLSearchParams();
      if (params.startDate) searchParams.append('startDate', params.startDate);
      if (params.endDate) searchParams.append('endDate', params.endDate);
      if (params.breakdown) searchParams.append('breakdown', params.breakdown);
      
      const response = await fetch(`/api/funnels/${id}/analyze?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to load compare analysis');
      const data = await response.json();
      setCompareAnalysis(data);
    } catch (err) {
      console.error('Failed to load compare analysis:', err);
    } finally {
      setCompareLoading(false);
    }
  };

  const quickCompareOptions = [
    { label: '上一周期', getRange: () => {
        const days = parseInt(dateRange);
        const compareEnd = addDays(startDate, -1);
        const compareStart = addDays(compareEnd, -days + 1);
        return { start: formatDate(compareStart), end: formatDate(compareEnd) };
      }
    },
    { label: '上周同期', getRange: () => {
        const compareStart = addDays(startDate, -7);
        const compareEnd = addDays(endDate, -7);
        return { start: formatDate(compareStart), end: formatDate(compareEnd) };
      }
    },
    { label: '上月同期', getRange: () => {
        const compareStart = addDays(startDate, -30);
        const compareEnd = addDays(endDate, -30);
        return { start: formatDate(compareStart), end: formatDate(compareEnd) };
      }
    },
  ];

  const handleQuickCompare = (option: typeof quickCompareOptions[0]) => {
    const range = option.getRange();
    setCompareStart(range.start);
    setCompareEnd(range.end);
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex > 0) {
      navigate(`/funnel/${id}/churn?step=${stepIndex}`);
    }
  };

  const handleSaveReport = async () => {
    if (!reportTitle || !funnelAnalysis) return;
    
    const { createReport } = useAppStore.getState();
    await createReport({
      title: reportTitle,
      funnelId: id!,
      funnelName: currentFunnel?.name || '',
      description: reportDesc,
      analysisData: funnelAnalysis,
    });
    
    setIsReportModalOpen(false);
    setReportTitle('');
    setReportDesc('');
    alert('报告保存成功！');
  };

  const getStepDiff = (stepA: FunnelAnalysisStep | undefined, stepB: FunnelAnalysisStep | undefined) => {
    if (!stepA || !stepB) return null;
    return {
      conversionDiff: (stepA.conversionRate - stepB.conversionRate).toFixed(2),
      userDiff: stepA.userCount - stepB.userCount,
    };
  };

  const hasData = funnelAnalysis && funnelAnalysis.totalUsers > 0;
  const hasCompareData = compareAnalysis && compareAnalysis.totalUsers > 0;

  const dimensions = [
    { value: 'channel', label: '来源渠道' },
    { value: 'city', label: '城市' },
    { value: 'user_level', label: '用户等级' },
  ];

  const dateRanges = [
    { value: '7', label: '近7天' },
    { value: '14', label: '近14天' },
    { value: '30', label: '近30天' },
    { value: '90', label: '近90天' },
  ];

  const currentDisplayAnalysis = activePeriodTab === 'current' ? funnelAnalysis : compareAnalysis;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="w-16 h-16 text-accent-500 mb-4" />
        <h3 className="text-xl font-semibold text-neutral-800 mb-2">加载出错</h3>
        <p className="text-neutral-500 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 font-display">
            {currentFunnel?.name || '漏斗分析'}
          </h1>
          <p className="text-neutral-500 text-sm mt-0.5">
            {currentFunnel?.description || '查看漏斗转化数据'}
          </p>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* 时间范围选择 */}
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-neutral-200 shadow-sm">
          {dateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setDateRange(range.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                dateRange === range.value
                  ? 'bg-primary-500 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* 分群维度 */}
        <div className="relative">
          <select
            value={breakdown || ''}
            onChange={(e) => setBreakdown(e.target.value || null)}
            className="input-field pr-10 appearance-none cursor-pointer"
          >
            <option value="">全部用户</option>
            {dimensions.map((dim) => (
              <option key={dim.value} value={dim.value}>
                按{dim.label}拆分
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>

        <div className="flex-1" />

        {/* 操作按钮 */}
        <button
          onClick={() => setShowCompare(!showCompare)}
          className={`btn-secondary flex items-center gap-2 ${
            showCompare ? 'bg-primary-50 text-primary-600 border-primary-200' : ''
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          {showCompare ? '关闭对比' : '周期对比'}
        </button>
        
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          保存报告
        </button>

        <button className="btn-primary flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          分享
        </button>
      </div>

      {/* 对比时间段选择器 */}
      {showCompare && (
        <div className="card-dashboard mb-6 border-primary-200 bg-primary-50/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary-600" />
              周期对比设置
            </h3>
            <button
              onClick={() => setShowCompare(false)}
              className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">快捷选择</label>
              <div className="flex gap-2">
                {quickCompareOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleQuickCompare(opt)}
                    className="px-3 py-1.5 text-sm bg-white border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">对比开始日期</label>
              <input
                type="date"
                value={compareStart}
                onChange={(e) => setCompareStart(e.target.value)}
                className="input-field"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">对比结束日期</label>
              <input
                type="date"
                value={compareEnd}
                onChange={(e) => setCompareEnd(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary-500"></div>
              <span className="text-neutral-600">
                当前周期: {formatDate(startDate)} ~ {formatDate(endDate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-500"></div>
              <span className="text-neutral-600">
                对比周期: {compareStart} ~ {compareEnd}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 空态处理 */}
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-neutral-400">加载中...</div>
        </div>
      ) : !hasData ? (
        <Empty />
      ) : (
        <>
          {/* 周期切换Tab (对比模式下显示) */}
          {showCompare && hasCompareData && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setActivePeriodTab('current')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activePeriodTab === 'current'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:border-primary-300'
                }`}
              >
                当前周期
              </button>
              <button
                onClick={() => setActivePeriodTab('compare')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activePeriodTab === 'compare'
                    ? 'bg-accent-500 text-white'
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:border-accent-300'
                }`}
              >
                对比周期
              </button>
              <button
                onClick={loadCompareAnalysis}
                className="ml-2 p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="刷新对比数据"
              >
                <RefreshCw className={`w-4 h-4 ${compareLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* 核心指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <span className="text-sm text-neutral-500">初始用户</span>
              </div>
              <p className="text-2xl font-bold text-neutral-800 count-animate">
                {currentDisplayAnalysis?.totalUsers.toLocaleString() || 0}
              </p>
              {showCompare && hasData && hasCompareData && (
                <p className={`text-sm mt-1 ${
                  (funnelAnalysis?.totalUsers || 0) >= (compareAnalysis?.totalUsers || 0)
                    ? 'text-emerald-600'
                    : 'text-accent-600'
                }`}>
                  {(funnelAnalysis?.totalUsers || 0) >= (compareAnalysis?.totalUsers || 0) ? '↑' : '↓'}
                  {' '}{Math.abs((funnelAnalysis?.totalUsers || 0) - (compareAnalysis?.totalUsers || 0)).toLocaleString()} 人
                </p>
              )}
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-neutral-500">最终转化率</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 count-animate">
                {currentDisplayAnalysis?.steps[currentDisplayAnalysis.steps.length - 1]?.conversionRate.toFixed(1) || 0}%
              </p>
              {showCompare && hasData && hasCompareData && (() => {
                const diff = getStepDiff(
                  funnelAnalysis?.steps[funnelAnalysis.steps.length - 1],
                  compareAnalysis?.steps[compareAnalysis.steps.length - 1]
                );
                if (!diff) return null;
                const isPositive = parseFloat(diff.conversionDiff) >= 0;
                return (
                  <p className={`text-sm mt-1 ${isPositive ? 'text-emerald-600' : 'text-accent-600'}`}>
                    {isPositive ? '↑' : '↓'} {Math.abs(parseFloat(diff.conversionDiff))}%
                  </p>
                );
              })()}
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-accent-600" />
                </div>
                <span className="text-sm text-neutral-500">最大流失率</span>
              </div>
              <p className="text-2xl font-bold text-accent-600 count-animate">
                {currentDisplayAnalysis ? Math.max(...currentDisplayAnalysis.steps.slice(1).map(s => s.dropOffRate)).toFixed(1) : 0}%
              </p>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-neutral-500">转化步骤</span>
              </div>
              <p className="text-2xl font-bold text-purple-600 count-animate">
                {currentDisplayAnalysis?.steps.length || 0}
              </p>
            </div>
          </div>

          {/* 漏斗图 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 主漏斗图 */}
            <div className="card-dashboard">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                转化漏斗
                {showCompare && (
                  <span className={`ml-2 text-sm font-normal ${
                    activePeriodTab === 'current' ? 'text-primary-600' : 'text-accent-600'
                  }`}>
                    ({activePeriodTab === 'current' ? '当前周期' : '对比周期'})
                  </span>
                )}
              </h3>
              {loading ? (
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-pulse text-neutral-400">加载中...</div>
                </div>
              ) : currentDisplayAnalysis ? (
                <FunnelChart
                  steps={currentDisplayAnalysis.steps}
                  onStepClick={handleStepClick}
                  colorScheme={activePeriodTab === 'current' ? 'primary' : 'accent'}
                />
              ) : null}
            </div>

            {/* 分群对比 */}
            <div className="card-dashboard">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                {breakdown ? `${dimensions.find(d => d.value === breakdown)?.label}分布` : '用户分群对比'}
              </h3>
              
              {currentDisplayAnalysis?.breakdown && currentDisplayAnalysis.breakdown.groups.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {currentDisplayAnalysis.breakdown.groups.map((group, index) => (
                    <div
                      key={group.groupName}
                      className="p-4 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-neutral-700">{group.groupName}</span>
                        <span className="text-sm text-primary-600 font-semibold">
                          {group.steps[group.steps.length - 1]?.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                      
                      {/* 迷你漏斗条 */}
                      <div className="flex items-end gap-1 h-12">
                        {group.steps.map((step, i) => {
                          const maxCount = group.steps[0]?.userCount || 1;
                          const heightPercent = (step.userCount / maxCount) * 100;
                          return (
                            <div
                              key={step.stepId}
                              className="flex-1 rounded-t transition-all duration-500"
                              style={{
                                height: `${heightPercent}%`,
                                background: `linear-gradient(135deg, ${
                                  ['#3a6cf5', '#ff6b35', '#10b981', '#8b5cf6'][index % 4]
                                } 0%, ${
                                  ['#1e3a5f', '#c73d18', '#047857', '#6d28d9'][index % 4]
                                } 100%)`,
                                opacity: 0.7 + (i / group.steps.length) * 0.3,
                              }}
                              title={`${step.stepName}: ${step.userCount.toLocaleString()}人`}
                            />
                          );
                        })}
                      </div>
                      
                      <div className="flex justify-between mt-2 text-xs text-neutral-400">
                        <span>{group.steps[0]?.userCount.toLocaleString()}人</span>
                        <span>转化率 {group.steps[group.steps.length - 1]?.conversionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-80 flex flex-col items-center justify-center text-neutral-400">
                  <Users className="w-12 h-12 mb-3 opacity-30" />
                  <p>选择分群维度查看对比</p>
                  <p className="text-sm mt-1">支持按渠道、城市、等级等维度拆分</p>
                </div>
              )}
            </div>
          </div>

          {/* 对比差异详情表 (对比模式下显示) */}
          {showCompare && hasData && hasCompareData && (
            <div className="card-dashboard mt-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">周期对比差异</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">步骤</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-primary-600">当前周期</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-accent-600">对比周期</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">转化率变化</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">用户数变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelAnalysis?.steps.map((step, index) => {
                      const compareStep = compareAnalysis?.steps[index];
                      const diff = getStepDiff(step, compareStep);
                      const conversionDiff = diff ? parseFloat(diff.conversionDiff) : 0;
                      const userDiff = diff?.userDiff || 0;
                      
                      return (
                        <tr
                          key={step.stepId}
                          className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </div>
                              <span className="font-medium text-neutral-700">{step.stepName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-primary-600">
                            {step.conversionRate.toFixed(2)}%
                            <span className="text-xs text-neutral-400 block">
                              ({step.userCount.toLocaleString()}人)
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-accent-600">
                            {compareStep?.conversionRate.toFixed(2) || '-'}%
                            <span className="text-xs text-neutral-400 block">
                              ({compareStep?.userCount.toLocaleString() || '-'}人)
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`font-medium ${
                              conversionDiff >= 0 ? 'text-emerald-600' : 'text-accent-600'
                            }`}>
                              {conversionDiff >= 0 ? '+' : ''}{conversionDiff}%
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`font-medium ${
                              userDiff >= 0 ? 'text-emerald-600' : 'text-accent-600'
                            }`}>
                              {userDiff >= 0 ? '+' : ''}{userDiff.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 步骤详情表格 */}
          <div className="card-dashboard mt-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">步骤详情</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">步骤</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">用户数</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">总转化率</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">步骤转化率</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">流失数</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">流失率</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-neutral-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDisplayAnalysis?.steps.map((step, index) => (
                    <tr
                      key={step.stepId}
                      className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <span className="font-medium text-neutral-700">{step.stepName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-neutral-800">
                        {step.userCount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-primary-600 font-medium">
                          {step.conversionRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-emerald-600 font-medium">
                          {step.stepConversionRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-neutral-600">
                        {step.dropOffCount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-accent-600 font-medium">
                          {index > 0 ? `-${step.dropOffRate.toFixed(2)}%` : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {index > 0 ? (
                          <button
                            onClick={() => handleStepClick(index)}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            查看流失
                          </button>
                        ) : (
                          <span className="text-neutral-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 保存报告模态框 */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="保存分析报告"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              报告标题 *
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="input-field"
              placeholder="请输入报告标题"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              报告描述
            </label>
            <textarea
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              className="input-field h-24 resize-none"
              placeholder="添加报告说明..."
            />
          </div>

          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-primary-700">
                <p className="font-medium">报告将包含</p>
                <ul className="mt-1 space-y-1 text-primary-600">
                  <li>• 漏斗转化数据</li>
                  <li>• 分群对比分析</li>
                  <li>• {dateRange} 天数据周期</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button onClick={handleSaveReport} className="btn-primary">
              保存报告
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
