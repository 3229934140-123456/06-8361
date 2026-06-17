import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Bell,
  Plus,
  Trash2,
  Settings,
  Mail,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Play,
  RefreshCw,
  ChevronDown,
  TrendingDown,
} from 'lucide-react';
import Modal from '../components/Modal';
import Empty from '../components/Empty';
import type { MonitorRule, MonitorAlert } from '../types';

export default function MonitorConfig() {
  const { monitors, monitorAlerts, loadMonitors, loadFunnels, toggleMonitor, deleteMonitor, createMonitor, loadMeta, checkMonitor, loadAlerts } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [checkingMonitorId, setCheckingMonitorId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    funnelId: '',
    stepIndex: 0,
    stepName: '',
    threshold: 10,
    frequency: 'daily' as 'daily' | 'hourly',
    notifyEmails: [''],
  });

  useEffect(() => {
    loadMonitors();
    loadFunnels();
    loadMeta();
    loadAlerts();
  }, [loadMonitors, loadFunnels, loadMeta, loadAlerts]);

  const selectedFunnel = monitors.length > 0 ? useAppStore.getState().funnels.find((f) => f.id === newRule.funnelId) : useAppStore.getState().funnels[0];
  const funnels = useAppStore.getState().funnels;

  const handleAddEmail = () => {
    setNewRule((prev) => ({
      ...prev,
      notifyEmails: [...prev.notifyEmails, ''],
    }));
  };

  const handleRemoveEmail = (index: number) => {
    if (newRule.notifyEmails.length <= 1) return;
    setNewRule((prev) => ({
      ...prev,
      notifyEmails: prev.notifyEmails.filter((_, i) => i !== index),
    }));
  };

  const handleEmailChange = (index: number, value: string) => {
    setNewRule((prev) => {
      const emails = [...prev.notifyEmails];
      emails[index] = value;
      return { ...prev, notifyEmails: emails };
    });
  };

  const handleFunnelChange = (funnelId: string) => {
    const funnel = funnels.find((f) => f.id === funnelId);
    setNewRule((prev) => ({
      ...prev,
      funnelId,
      stepIndex: 1,
      stepName: funnel?.steps[1]?.name || '',
    }));
  };

  const handleStepChange = (stepIndex: number) => {
    const step = selectedFunnel?.steps[stepIndex];
    setNewRule((prev) => ({
      ...prev,
      stepIndex,
      stepName: step?.name || '',
    }));
  };

  const handleSubmit = async () => {
    const validEmails = newRule.notifyEmails.filter((e) => e.trim());
    if (!newRule.funnelId || validEmails.length === 0) {
      alert('请填写完整信息');
      return;
    }

    try {
      await createMonitor({
        funnelId: newRule.funnelId,
        funnelName: selectedFunnel?.name || '',
        stepIndex: newRule.stepIndex,
        stepName: newRule.stepName,
        threshold: newRule.threshold,
        frequency: newRule.frequency,
        notifyEmails: validEmails,
      });
      setIsModalOpen(false);
      setNewRule({
        funnelId: '',
        stepIndex: 0,
        stepName: '',
        threshold: 10,
        frequency: 'daily',
        notifyEmails: [''],
      });
    } catch (error) {
      alert('创建监控规则失败');
    }
  };

  const handleCheckMonitor = async (monitor: MonitorRule) => {
    if (!window.confirm(`确定要手动检测「${monitor.funnelName}」的监控规则吗？这将立即发送预警邮件（如果触发阈值）。`)) {
      return;
    }

    setCheckingMonitorId(monitor.id);
    try {
      const result = await checkMonitor(monitor.id);
      alert(`检测完成：${result.message}\n转化率下降：${result.dropPercentage.toFixed(2)}%\n当前转化率：${result.currentRate.toFixed(2)}%\n之前转化率：${result.previousRate.toFixed(2)}%`);
    } catch (error) {
      alert('检测失败：' + (error as Error).message);
    } finally {
      setCheckingMonitorId(null);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      alert('请输入收件人邮箱');
      return;
    }

    try {
      const { monitorApi } = await import('../services/api');
      const result = await monitorApi.testEmail(testEmail);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: (error as Error).message });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getStatusIcon = (status: MonitorAlert['status']) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-accent-500" />;
      default:
        return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getStatusText = (status: MonitorAlert['status']) => {
    switch (status) {
      case 'sent':
        return '已发送';
      case 'failed':
        return '发送失败';
      default:
        return '待处理';
    }
  };

  const todayAlerts = monitorAlerts.filter((alert) => {
    const alertDate = new Date(alert.triggeredAt).toDateString();
    const today = new Date().toDateString();
    return alertDate === today;
  });

  return (
    <div className="animate-fade-in">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 font-display">
            监控预警
          </h1>
          <p className="text-neutral-500 mt-1">
            配置监控规则，转化率异常时自动发送预警通知
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTestModalOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            测试邮件
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            新建监控
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">
              {monitors.length}
            </p>
              <p className="text-sm text-neutral-500">监控规则</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl" />
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Settings className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">
                {monitors.filter((m) => m.enabled).length}
              </p>
              <p className="text-sm text-neutral-500">运行中</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">{todayAlerts.length}</p>
              <p className="text-sm text-neutral-500">今日预警</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-800">{monitorAlerts.length}</p>
              <p className="text-sm text-neutral-500">历史预警</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 监控规则列表 */}
        <div className="lg:col-span-2">
          <div className="card-dashboard">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-800">监控规则</h3>
              <button
                onClick={() => loadMonitors()}
                className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {monitors.length === 0 ? (
              <div className="py-16 text-center">
              <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 mb-4">暂无监控规则</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  创建第一个监控规则
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {monitors.map((monitor, index) => (
                  <div
                    key={monitor.id}
                    className="p-4 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            monitor.enabled
                              ? 'bg-primary-100 text-primary-600'
                              : 'bg-neutral-200 text-neutral-400'
                          }`}
                        >
                          <Bell className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-medium text-neutral-800">
                            {monitor.funnelName}
                          </h4>
                          <p className="text-sm text-neutral-500">
                            监控「{monitor.stepName}」步骤转化率
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-lg font-bold text-accent-600">
                              {monitor.threshold}%
                            </p>
                            <p className="text-xs text-neutral-400">
                              预警阈值
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-neutral-600">
                              {monitor.frequency === 'daily' ? '每天' : '每小时'}
                            </p>
                            <p className="text-xs text-neutral-400">检测频率</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-neutral-600">
                              {monitor.notifyEmails.length} 人
                            </p>
                            <p className="text-xs text-neutral-400">通知人</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-neutral-200">
                          <button
                            onClick={() => handleCheckMonitor(monitor)}
                            disabled={checkingMonitorId === monitor.id}
                            className={`p-2 rounded-lg transition-colors ${
                              checkingMonitorId === monitor.id
                                ? 'bg-neutral-100 text-neutral-400 cursor-wait'
                                : 'text-neutral-400 hover:text-primary-600 hover:bg-primary-50'
                            }`}
                            title="立即检测"
                          >
                            <Play className={`w-4 h-4 ${checkingMonitorId === monitor.id ? 'animate-pulse' : ''}`} />
                          </button>
                          <button
                            onClick={() => toggleMonitor(monitor.id)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              monitor.enabled ? 'bg-primary-500' : 'bg-neutral-300'
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              monitor.enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                            />
                          </button>
                          <button
                            onClick={() => deleteMonitor(monitor.id)}
                            className="p-2 text-neutral-400 hover:text-accent-500 hover:bg-accent-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-200">
                      <div className="flex items-center gap-1 text-xs text-neutral-400">
                        <Mail className="w-3.5 h-3.5" />
                        <span>通知：</span>
                        {monitor.notifyEmails.map((email, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-white rounded text-xs text-neutral-600"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>创建于 {formatDate(monitor.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 预警历史 */}
        <div className="lg:col-span-1">
          <div className="card-dashboard">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-800">预警历史</h3>
              <button
                onClick={() => loadAlerts()}
                className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {monitorAlerts.length === 0 ? (
              <Empty
                title="暂无预警记录"
                description="当监控规则检测到转化率异常下降时，会在此处显示预警记录"
                icon="chart"
              />
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {monitorAlerts.slice(0, 20).map((alert, index) => (
                  <div
                    key={alert.id}
                    className="p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.status === 'sent' ? 'bg-emerald-500' : 
                          alert.status === 'failed' ? 'bg-accent-500' : 'bg-neutral-400'
                        }`} />
                        <span className="font-medium text-neutral-700 text-sm">
                          {alert.funnelName}
                        </span>
                      </div>
                      {getStatusIcon(alert.status)}
                    </div>
                    
                    <p className="text-xs text-neutral-500 mb-2">
                      「{alert.stepName}」下降 {alert.dropPercentage.toFixed(2)}%
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-accent-600 font-medium">
                          {alert.currentRate.toFixed(1)}%
                        </span>
                        <span className="text-neutral-300">→</span>
                        <span className="text-neutral-500">
                          {alert.previousRate.toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-neutral-400">
                        {formatDateTime(alert.triggeredAt)}
                      </span>
                    </div>

                    {alert.status === 'failed' && alert.message && (
                      <p className="mt-2 text-xs text-accent-600 bg-accent-50 px-2 py-1 rounded">
                        {alert.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {monitorAlerts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <button
                  onClick={() => setIsAlertModalOpen(true)}
                  className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  查看全部预警记录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新建监控模态框 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="新建监控规则"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              选择漏斗 *
            </label>
            <select
              value={newRule.funnelId}
              onChange={(e) => handleFunnelChange(e.target.value)}
              className="input-field"
            >
              <option value="">请选择漏斗</option>
              {funnels.map((funnel) => (
                <option key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </select>
          </div>

          {selectedFunnel && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                监控步骤 *
              </label>
              <select
                value={newRule.stepIndex}
                onChange={(e) => handleStepChange(parseInt(e.target.value))}
                className="input-field"
              >
                {selectedFunnel.steps.slice(1).map((step, index) => (
                  <option key={step.id} value={index + 1}>
                    {step.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              预警阈值 *
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="50"
                value={newRule.threshold}
                onChange={(e) =>
                  setNewRule((prev) => ({
                    ...prev,
                    threshold: parseInt(e.target.value),
                  }))
                }
                className="flex-1"
              />
              <span className="w-20 text-center font-bold text-accent-600 text-lg">
                {newRule.threshold}%
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              当转化率下降超过此阈值时触发预警
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              检测频率
            </label>
            <div className="flex gap-3">
              {[
                { value: 'daily', label: '每天 (09:00)' },
                { value: 'hourly', label: '每小时' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setNewRule((prev) => ({
                      ...prev,
                      frequency: opt.value as 'daily' | 'hourly',
                    }))
                  }
                  className={`flex-1 py-2.5 rounded-lg border font-medium transition-colors ${
                    newRule.frequency === opt.value
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-neutral-700">
                通知邮箱 *
              </label>
              <button
                onClick={handleAddEmail}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + 添加通知人
              </button>
            </div>
            <div className="space-y-2">
              {newRule.notifyEmails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    className="input-field flex-1"
                    placeholder="请输入邮箱地址"
                  />
                  {newRule.notifyEmails.length > 1 && (
                    <button
                      onClick={() => handleRemoveEmail(index)}
                      className="p-2 text-neutral-400 hover:text-accent-500 hover:bg-accent-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-primary-700">
                <p className="font-medium">预警通知说明</p>
                <p className="mt-1 text-primary-600">
                  系统将按照设定的频率自动检测转化率，当下降幅度超过阈值时，将向以上邮箱发送预警邮件。
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button onClick={handleSubmit} className="btn-primary">
              创建监控
            </button>
          </div>
        </div>
      </Modal>

      {/* 预警历史详情模态框 */}
      <Modal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        title="预警历史记录"
        size="xl"
      >
        {monitorAlerts.length === 0 ? (
          <Empty
            title="暂无预警记录"
            description="当监控规则检测到转化率异常下降时，会在此处显示预警记录"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">触发时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">漏斗</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">步骤</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">当前转化率</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">下降幅度</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">阈值</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-neutral-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {monitorAlerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {formatDateTime(alert.triggeredAt)}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-neutral-800">
                      {alert.funnelName}
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {alert.stepName}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-primary-600 font-medium">
                      {alert.currentRate.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-accent-600 font-medium">
                      -{alert.dropPercentage.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-neutral-600">
                      {alert.threshold}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-50">
                        {getStatusIcon(alert.status)}
                        <span className="text-xs text-neutral-600">{getStatusText(alert.status)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* 测试邮件模态框 */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => {
          setIsTestModalOpen(false);
          setTestEmail('');
          setTestResult(null);
        }}
        title="测试邮件发送"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              收件人邮箱 *
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="input-field"
              placeholder="请输入收件人邮箱地址"
            />
          </div>

          <div className="p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-neutral-700">
                <p className="font-medium">测试说明</p>
                <p className="mt-1 text-neutral-600">
                  点击发送按钮后，系统将发送一封测试预警邮件到指定邮箱。如果发送失败，请检查邮箱配置。
                </p>
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg ${
              testResult.success ? 'bg-emerald-50' : 'bg-accent-50'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-accent-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm">
                  <p className={`font-medium ${
                    testResult.success ? 'text-emerald-700' : 'text-accent-700'
                  }`}>
                    {testResult.success ? '发送成功' : '发送失败'}
                  </p>
                  <p className={`mt-1 ${
                    testResult.success ? 'text-emerald-600' : 'text-accent-600'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setIsTestModalOpen(false);
                setTestEmail('');
                setTestResult(null);
              }}
              className="btn-secondary"
            >
              关闭
            </button>
            <button onClick={handleSendTestEmail} className="btn-primary">
              发送测试邮件
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
