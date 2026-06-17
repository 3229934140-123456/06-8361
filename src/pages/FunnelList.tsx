import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Plus, Trash2, ChevronRight, Funnel, Calendar, Users } from 'lucide-react';
import Modal from '../components/Modal';

export default function FunnelList() {
  const navigate = useNavigate();
  const { funnels, loadFunnels, deleteFunnel, events, loadMeta } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFunnel, setNewFunnel] = useState({
    name: '',
    description: '',
    steps: [{ name: '', eventName: '' }],
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadFunnels();
    loadMeta();
  }, [loadFunnels, loadMeta]);

  const handleCreateFunnel = () => {
    setIsModalOpen(true);
    setNewFunnel({
      name: '',
      description: '',
      steps: [{ name: '', eventName: '' }],
    });
  };

  const handleAddStep = () => {
    setNewFunnel((prev) => ({
      ...prev,
      steps: [...prev.steps, { name: '', eventName: '' }],
    }));
  };

  const handleRemoveStep = (index: number) => {
    if (newFunnel.steps.length <= 1) return;
    setNewFunnel((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  const handleStepChange = (index: number, field: 'name' | 'eventName', value: string) => {
    setNewFunnel((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
  };

  const handleSubmit = async () => {
    if (!newFunnel.name || newFunnel.steps.some((s) => !s.name || !s.eventName)) {
      alert('请填写完整的漏斗信息');
      return;
    }

    try {
      const { createFunnel } = useAppStore.getState();
      await createFunnel(newFunnel);
      setIsModalOpen(false);
      loadFunnels();
    } catch (error) {
      alert('创建漏斗失败');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个漏斗吗？')) {
      setDeletingId(id);
      await deleteFunnel(id);
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="animate-fade-in">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 font-display">
            漏斗管理
          </h1>
          <p className="text-neutral-500 mt-1">
            创建和管理你的转化漏斗，分析用户转化路径
          </p>
        </div>
        <button onClick={handleCreateFunnel} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          新建漏斗
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Funnel className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">{funnels.length}</p>
              <p className="text-sm text-neutral-500">漏斗总数</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl" />
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">2,000+</p>
              <p className="text-sm text-neutral-500">分析用户数</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-accent-500/5 rounded-full blur-2xl" />
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">近30天</p>
              <p className="text-sm text-neutral-500">数据周期</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
        </div>
      </div>

      {/* 漏斗列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {funnels.map((funnel, index) => (
          <div
            key={funnel.id}
            className="card-dashboard cursor-pointer group hover:-translate-y-1"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => navigate(`/funnel/${funnel.id}`)}
          >
            {/* 头部 */}
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Funnel className="w-6 h-6 text-white" />
              </div>
              <button
                onClick={(e) => handleDelete(funnel.id, e)}
                className="p-2 text-neutral-300 hover:text-accent-500 hover:bg-accent-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                disabled={deletingId === funnel.id}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* 标题和描述 */}
            <h3 className="text-lg font-semibold text-neutral-800 mb-2 group-hover:text-primary-600 transition-colors">
              {funnel.name}
            </h3>
            <p className="text-sm text-neutral-500 mb-4 line-clamp-2">
              {funnel.description || '暂无描述'}
            </p>

            {/* 步骤标签 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {funnel.steps.slice(0, 4).map((step, i) => (
                <span
                  key={step.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-neutral-100 text-neutral-600"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                  {step.name}
                </span>
              ))}
              {funnel.steps.length > 4 && (
                <span className="text-xs px-2 py-1 text-neutral-400">
                  +{funnel.steps.length - 4} 更多
                </span>
              )}
            </div>

            {/* 底部信息 */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-1 text-sm text-neutral-400">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(funnel.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1 text-primary-500 text-sm font-medium">
                查看分析
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}

        {/* 新建漏斗卡片 */}
        <div
          onClick={handleCreateFunnel}
          className="card-dashboard border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center min-h-[220px] cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
        >
          <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
            <Plus className="w-7 h-7 text-neutral-400" />
          </div>
          <p className="text-neutral-500 font-medium">创建新漏斗</p>
          <p className="text-sm text-neutral-400 mt-1">自定义你的转化分析漏斗</p>
        </div>
      </div>

      {/* 新建漏斗模态框 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="新建转化漏斗"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              漏斗名称 *
            </label>
            <input
              type="text"
              value={newFunnel.name}
              onChange={(e) => setNewFunnel((prev) => ({ ...prev, name: e.target.value }))}
              className="input-field"
              placeholder="例如：注册转化漏斗"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              漏斗描述
            </label>
            <textarea
              value={newFunnel.description}
              onChange={(e) => setNewFunnel((prev) => ({ ...prev, description: e.target.value }))}
              className="input-field h-20 resize-none"
              placeholder="描述这个漏斗的用途..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-neutral-700">
                漏斗步骤 *
              </label>
              <button
                onClick={handleAddStep}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + 添加步骤
              </button>
            </div>
            
            <div className="space-y-3">
              {newFunnel.steps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                      className="input-field mb-2"
                      placeholder="步骤名称"
                    />
                    <select
                      value={step.eventName}
                      onChange={(e) => handleStepChange(index, 'eventName', e.target.value)}
                      className="input-field"
                    >
                      <option value="">选择埋点事件</option>
                      {events.map((evt) => (
                        <option key={evt.name} value={evt.name}>
                          {evt.name} ({evt.count.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  {newFunnel.steps.length > 1 && (
                    <button
                      onClick={() => handleRemoveStep(index)}
                      className="p-2 text-neutral-400 hover:text-accent-500 hover:bg-accent-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button onClick={handleSubmit} className="btn-primary">
              创建漏斗
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
