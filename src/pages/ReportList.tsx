import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import {
  FileText,
  Calendar,
  User,
  Share2,
  Trash2,
  Eye,
  Copy,
  Check,
  Search,
  Download,
} from 'lucide-react';
import Modal from '../components/Modal';

export default function ReportList() {
  const navigate = useNavigate();
  const { reports, loadReports, deleteReport } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.funnelName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleShare = async (id: string) => {
    try {
      const { reportApi } = await import('../services/api');
      const result = await reportApi.share(id);
      setShareUrl(window.location.origin + result.shareUrl);
      setCurrentReportId(id);
      setShareModalOpen(true);
    } catch (error) {
      alert('生成分享链接失败');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert('复制失败，请手动复制');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个报告吗？')) {
      deleteReport(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="animate-fade-in">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 font-display">
            分析报告
          </h1>
          <p className="text-neutral-500 mt-1">
            管理和分享你的漏斗分析报告
          </p>
        </div>
      </div>

      {/* 搜索和统计 */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索报告..."
            className="input-field pl-10"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-neutral-500">
            共 <span className="font-semibold text-neutral-700">{reports.length}</span> 份报告
          </div>
        </div>
      </div>

      {/* 报告列表 */}
      {filteredReports.length === 0 ? (
        <div className="card-dashboard flex flex-col items-center justify-center py-16">
          <FileText className="w-16 h-16 text-neutral-300 mb-4" />
          <h3 className="text-lg font-medium text-neutral-600 mb-2">
            暂无报告
          </h3>
          <p className="text-neutral-400 mb-4">
            进入漏斗分析页面，保存你的第一份分析报告
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            去创建漏斗
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report, index) => (
            <div
              key={report.id}
              className="card-dashboard cursor-pointer group hover:-translate-y-0.5 transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20 flex-shrink-0">
                  <FileText className="w-7 h-7 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-1 group-hover:text-primary-600 transition-colors truncate">
                        {report.title}
                      </h3>
                      <p className="text-sm text-neutral-500 mb-3 line-clamp-2">
                        {report.description || '暂无描述'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(report.id);
                        }}
                        className="p-2 text-neutral-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                        title="分享"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(report.id);
                        }}
                        className="p-2 text-neutral-400 hover:text-accent-500 hover:bg-accent-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-neutral-500">
                      <span className="px-2 py-0.5 rounded bg-primary-50 text-primary-600 text-xs font-medium">
                        {report.funnelName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-400">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(report.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-400">
                      <User className="w-4 h-4" />
                      <span>{report.createdBy}</span>
                    </div>
                    {report.shareToken && (
                      <div className="flex items-center gap-1 text-emerald-500">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">已分享</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分享弹窗 */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="分享报告"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            复制以下链接分享给团队成员，他们可以查看这份分析报告。
          </p>
          
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={handleCopyLink}
              className="btn-primary flex items-center gap-2 flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  复制
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-700">
              <span className="font-medium">注意：</span>
              任何拥有此链接的人都可以查看报告内容，请妥善保管。
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
