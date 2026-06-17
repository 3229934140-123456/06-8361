import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportApi } from '../services/api';
import FunnelChart from '../components/FunnelChart';
import type { Report } from '../types';
import {
  ArrowLeft,
  Calendar,
  User,
  Share2,
  Download,
  FileText,
  Clock,
  BarChart2,
} from 'lucide-react';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const loadReport = async () => {
      try {
        const data = await reportApi.getById(id);
        setReport(data);
      } catch (error) {
        console.error('Failed to load report:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [id]);

  const handleShare = async () => {
    if (!id) return;
    try {
      const result = await reportApi.share(id);
      const shareUrl = window.location.origin + result.shareUrl;
      await navigator.clipboard.writeText(shareUrl);
      alert('分享链接已复制到剪贴板');
    } catch (error) {
      alert('生成分享链接失败');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-neutral-400">加载中...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <FileText className="w-16 h-16 text-neutral-300 mb-4" />
        <p className="text-neutral-500 mb-4">报告不存在或已删除</p>
        <button onClick={() => navigate('/reports')} className="btn-primary">
          返回报告列表
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-800 font-display">
              {report.title}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {report.createdBy}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(report.createdAt)}
              </span>
              <span className="px-2 py-0.5 rounded bg-primary-50 text-primary-600 text-xs font-medium">
                {report.funnelName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="btn-secondary flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            分享
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 报告描述 */}
      {report.description && (
        <div className="card-dashboard mb-6">
          <h3 className="text-sm font-medium text-neutral-500 mb-2">报告说明</h3>
          <p className="text-neutral-700">{report.description}</p>
        </div>
      )}

      {/* 漏斗图表 */}
      {report.analysisData && (
        <div className="card-dashboard mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-800">转化漏斗</h3>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Clock className="w-4 h-4" />
              <span>
                {new Date(report.analysisData.period.start).toLocaleDateString('zh-CN')}
                {' ~ '}
                {new Date(report.analysisData.period.end).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
          
          <FunnelChart
            steps={report.analysisData.steps}
            colorScheme="primary"
          />
        </div>
      )}

      {/* 步骤详情 */}
      {report.analysisData && (
        <div className="card-dashboard mb-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">详细数据</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">步骤</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-600">用户数</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-600">总转化率</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-600">步骤转化率</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-600">流失数</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-600">流失率</th>
                </tr>
              </thead>
              <tbody>
                {report.analysisData.steps.map((step, index) => (
                  <tr
                    key={step.stepId}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span className="font-medium text-neutral-700">{step.stepName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-neutral-800">
                      {step.userCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-primary-600 font-medium">
                      {step.conversionRate.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                      {step.stepConversionRate.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-600">
                      {step.dropOffCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-accent-600 font-medium">
                      {index > 0 ? `-${step.dropOffRate.toFixed(2)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分群对比 */}
      {report.analysisData?.breakdown && (
        <div className="card-dashboard">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-neutral-800">
              {report.analysisData.breakdown.dimension === 'channel' && '来源渠道'}
              {report.analysisData.breakdown.dimension === 'city' && '城市分布'}
              {report.analysisData.breakdown.dimension === 'user_level' && '用户等级'}
              对比分析
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.analysisData.breakdown.groups.map((group, gIndex) => (
              <div key={group.groupName} className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-neutral-700">{group.groupName}</span>
                  <span className="text-sm text-primary-600 font-semibold">
                    转化率 {group.steps[group.steps.length - 1]?.conversionRate.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex items-end gap-1 h-16">
                  {group.steps.map((step, i) => {
                    const maxCount = group.steps[0]?.userCount || 1;
                    const heightPercent = (step.userCount / maxCount) * 100;
                    const colors = ['#3a6cf5', '#ff6b35', '#10b981', '#8b5cf6'];
                    return (
                      <div
                        key={step.stepId}
                        className="flex-1 rounded-t transition-all"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: colors[gIndex % colors.length],
                          opacity: 0.6 + (i / group.steps.length) * 0.4,
                        }}
                      />
                    );
                  })}
                </div>
                
                <div className="flex justify-between mt-2 text-xs text-neutral-400">
                  <span>{group.steps[0]?.userCount.toLocaleString()}人</span>
                  <span>{group.steps.length} 步</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
