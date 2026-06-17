import { useState, useEffect } from 'react';
import type { FunnelAnalysisStep } from '../types';
import { Users, TrendingDown, ChevronRight } from 'lucide-react';

interface FunnelChartProps {
  steps: FunnelAnalysisStep[];
  title?: string;
  onStepClick?: (stepIndex: number) => void;
  colorScheme?: 'primary' | 'accent' | 'blue' | 'purple';
  animate?: boolean;
}

const colorSchemes = {
  primary: {
    start: '#1e3a5f',
    end: '#3a6cf5',
  },
  accent: {
    start: '#c73d18',
    end: '#ff7b3d',
  },
  blue: {
    start: '#0369a1',
    end: '#38bdf8',
  },
  purple: {
    start: '#6d28d9',
    end: '#a78bfa',
  },
};

export default function FunnelChart({
  steps,
  title,
  onStepClick,
  colorScheme = 'primary',
  animate = true,
}: FunnelChartProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!steps || steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-neutral-400">
        暂无数据
      </div>
    );
  }

  const colors = colorSchemes[colorScheme];
  const maxValue = steps[0]?.userCount || 1;

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">{title}</h3>
      )}
      
      <div className="flex flex-col items-center space-y-3">
        {steps.map((step, index) => {
          const widthPercent = 40 + ((step.userCount / maxValue) * 60);
          const isHovered = hoveredStep === index;
          const prevCount = index > 0 ? steps[index - 1].userCount : step.userCount;
          const dropCount = prevCount - step.userCount;
          
          return (
            <div key={step.stepId} className="w-full flex items-center gap-4">
              {/* 步骤序号 */}
              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-neutral-500">
                  {index + 1}
                </span>
              </div>

              {/* 漏斗条 */}
              <div className="flex-1 flex justify-center">
                <div
                  className={cn(
                    'relative h-16 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-between px-6',
                    isHovered && 'scale-[1.02] shadow-lg'
                  )}
                  style={{
                    width: `${widthPercent}%`,
                    background: `linear-gradient(135deg, ${colors.start} 0%, ${colors.end} 100%)`,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transitionDelay: `${index * 100}ms`,
                  }}
                  onMouseEnter={() => setHoveredStep(index)}
                  onMouseLeave={() => setHoveredStep(null)}
                  onClick={() => onStepClick?.(index)}
                >
                  <div className="text-white">
                    <p className="font-medium">{step.stepName}</p>
                    <p className="text-sm text-white/80">
                      {step.userCount.toLocaleString()} 人
                    </p>
                  </div>
                  <div className="text-right text-white">
                    <p className="font-semibold text-lg">
                      {step.conversionRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-white/70">
                      总转化率
                    </p>
                  </div>

                  {isHovered && onStepClick && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <ChevronRight className="w-5 h-5 text-white/80" />
                    </div>
                  )}
                </div>
              </div>

              {/* 流失指标 */}
              <div className="w-28 flex-shrink-0 text-right">
                {index > 0 && (
                  <div className="flex items-center justify-end gap-1 text-accent-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      -{step.dropOffRate.toFixed(1)}%
                    </span>
                  </div>
                )}
                {index > 0 && (
                  <p className="text-xs text-neutral-400">
                    流失 {dropCount.toLocaleString()} 人
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部统计 */}
      <div className="mt-6 pt-4 border-t border-neutral-100 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-primary-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-2xl font-bold">
              {steps[0]?.userCount.toLocaleString() || 0}
            </span>
          </div>
          <p className="text-xs text-neutral-500">初始用户数</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-accent-500 mb-1">
            {steps[steps.length - 1]?.conversionRate.toFixed(1) || 0}%
          </div>
          <p className="text-xs text-neutral-500">最终转化率</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-700 mb-1">
            {steps.length}
          </div>
          <p className="text-xs text-neutral-500">转化步骤</p>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
