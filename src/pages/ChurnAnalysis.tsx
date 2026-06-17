import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { analysisApi } from '../services/api';
import SankeyChart from '../components/SankeyChart';
import type { ChurnUser, BehaviorPath } from '../types';
import {
  ArrowLeft,
  Users,
  MapPin,
  Tag,
  Calendar,
  ChevronDown,
  TrendingDown,
  ArrowRight,
  User,
} from 'lucide-react';

export default function ChurnAnalysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stepIndex = parseInt(searchParams.get('step') || '1');
  
  const [churnUsers, setChurnUsers] = useState<ChurnUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [behaviorPath, setBehaviorPath] = useState<BehaviorPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepName, setStepName] = useState('');
  const [funnelName, setFunnelName] = useState('');

  const pageSize = 10;

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [usersResult, pathsResult] = await Promise.all([
          analysisApi.getChurnUsers(id, stepIndex, { page, pageSize }),
          analysisApi.getBehaviorPaths(id, stepIndex),
        ]);
        
        setChurnUsers(usersResult.users);
        setTotal(usersResult.total);
        setBehaviorPath(pathsResult);
      } catch (error) {
        console.error('Failed to load churn data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, stepIndex, page]);

  useEffect(() => {
    const loadFunnelInfo = async () => {
      try {
        const { funnelApi } = await import('../services/api');
        const funnel = await funnelApi.getById(id!);
        setFunnelName(funnel.name);
        if (funnel.steps[stepIndex]) {
          setStepName(funnel.steps[stepIndex].name);
        }
      } catch (error) {
        console.error('Failed to load funnel info:', error);
      }
    };
    if (id) loadFunnelInfo();
  }, [id, stepIndex]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-fade-in">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/funnel/${id}`)}
          className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 font-display">
            流失用户分析
          </h1>
          <p className="text-neutral-500 text-sm mt-0.5">
            {funnelName} - {stepName}步骤流失分析
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-accent-600" />
            </div>
            <span className="text-sm text-neutral-500">流失用户数</span>
          </div>
          <p className="text-2xl font-bold text-accent-600 count-animate">
            {total.toLocaleString()}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-sm text-neutral-500">流失占比</span>
          </div>
          <p className="text-2xl font-bold text-primary-600 count-animate">
            {(total > 0 ? '—' : '—')}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-neutral-500">分析样本</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 count-animate">
            {Math.min(total, 200)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 行为路径图 */}
        <div className="lg:col-span-2">
          <div className="card-dashboard">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              流失前行为路径
            </h3>
            <p className="text-sm text-neutral-500 mb-4">
              展示流失用户在离开前的典型行为路径，帮助定位流失原因
            </p>
            
            {loading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="animate-pulse text-neutral-400">加载中...</div>
              </div>
            ) : (
              <SankeyChart data={behaviorPath || { nodes: [], links: [] }} height={350} />
            )}
          </div>
        </div>

        {/* 流失用户列表 */}
        <div className="card-dashboard">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-800">
              流失用户列表
            </h3>
            <span className="text-sm text-neutral-500">
              共 {total} 人
            </span>
          </div>

          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="animate-pulse text-neutral-400">加载中...</div>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {churnUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="p-4 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium text-sm">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-700 truncate">
                          用户 {user.userId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-neutral-400">
                          最后操作：{user.lastAction}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {user.userAttributes.channel && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600">
                          <Tag className="w-3 h-3" />
                          {user.userAttributes.channel}
                        </span>
                      )}
                      {user.userAttributes.city && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-50 text-green-600">
                          <MapPin className="w-3 h-3" />
                          {user.userAttributes.city}
                        </span>
                      )}
                      {user.userAttributes.userLevel && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-purple-50 text-purple-600">
                          <Users className="w-3 h-3" />
                          {user.userAttributes.userLevel}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center gap-1 text-xs text-neutral-400">
                      <Calendar className="w-3 h-3" />
                      最后活跃：{new Date(user.lastActionTime).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-neutral-100">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-neutral-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 流失洞察 */}
      <div className="card-dashboard mt-6">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">流失洞察</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-amber-50 rounded-xl">
            <h4 className="font-medium text-amber-800 mb-2">常见流失节点</h4>
            <p className="text-sm text-amber-600">
              大部分用户在浏览商品后流失，可能是商品吸引力不足或价格因素
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <h4 className="font-medium text-blue-800 mb-2">渠道表现</h4>
            <p className="text-sm text-blue-600">
              自然搜索渠道流失率最低，广告投放渠道流失率较高
            </p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl">
            <h4 className="font-medium text-emerald-800 mb-2">优化建议</h4>
            <p className="text-sm text-emerald-600">
              建议优化商品详情页，增加用户评价和推荐算法
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
