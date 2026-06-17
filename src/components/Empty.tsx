import { SearchX, BarChart3 } from 'lucide-react';

interface EmptyProps {
  title?: string;
  description?: string;
  icon?: 'search' | 'chart';
}

export default function Empty({ 
  title = '暂无数据', 
  description = '当前筛选条件下没有找到数据，请尝试调整时间范围或筛选条件',
  icon = 'chart'
}: EmptyProps) {
  const Icon = icon === 'search' ? SearchX : BarChart3;
  
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
        <Icon className="h-8 w-8 text-neutral-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-700">{title}</h3>
      <p className="max-w-md text-sm text-neutral-500">{description}</p>
    </div>
  );
}
