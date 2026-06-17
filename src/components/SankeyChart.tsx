import { useMemo } from 'react';
import type { BehaviorPath } from '../types';

interface SankeyChartProps {
  data: BehaviorPath;
  title?: string;
  height?: number;
}

export default function SankeyChart({ data, title, height = 400 }: SankeyChartProps) {
  const chartData = useMemo(() => {
    if (!data.nodes.length || !data.links.length) return null;

    const padding = { top: 20, right: 120, bottom: 20, left: 120 };
    const width = 700;
    const chartHeight = height - padding.top - padding.bottom;

    const nodeWidth = 20;
    const nodePadding = 15;

    const nodeValueMap = new Map(data.nodes.map(n => [n.id, n.value]));
    
    const sourceValues = new Map<string, number>();
    const targetValues = new Map<string, number>();
    
    data.links.forEach(link => {
      sourceValues.set(link.source, (sourceValues.get(link.source) || 0) + link.value);
      targetValues.set(link.target, (targetValues.get(link.target) || 0) + link.value);
    });

    const layers: string[][] = [];
    const visited = new Set<string>();
    
    const startNodes = data.nodes.filter(n => !targetValues.has(n.id)).map(n => n.id);
    if (startNodes.length > 0) {
      layers.push(startNodes);
      startNodes.forEach(n => visited.add(n));
    }

    let currentLayer = startNodes;
    let safety = 0;
    while (currentLayer.length > 0 && safety < 10) {
      safety++;
      const nextLayer = new Set<string>();
      currentLayer.forEach(sourceId => {
        data.links
          .filter(l => l.source === sourceId)
          .forEach(l => {
            if (!visited.has(l.target)) {
              nextLayer.add(l.target);
              visited.add(l.target);
            }
          });
      });
      if (nextLayer.size > 0) {
        layers.push(Array.from(nextLayer));
        currentLayer = Array.from(nextLayer);
      } else {
        break;
      }
    }

    const unassigned = data.nodes.filter(n => !visited.has(n.id)).map(n => n.id);
    if (unassigned.length > 0) {
      layers.push(unassigned);
    }

    const layerCount = layers.length;
    const layerWidth = layerCount > 1 
      ? (width - padding.left - padding.right - nodeWidth) / (layerCount - 1)
      : 0;

    const nodePositions = new Map<string, { x: number; y: number; height: number }>();

    layers.forEach((layer, layerIndex) => {
      const x = padding.left + layerIndex * layerWidth;
      
      const totalHeight = layer.reduce((sum, nodeId) => {
        const v = nodeValueMap.get(nodeId) || 0;
        return sum + v;
      }, 0);
      
      const totalPadding = (layer.length - 1) * nodePadding;
      const scale = totalHeight > 0 ? (chartHeight - totalPadding) / totalHeight : 1;
      
      let currentY = padding.top;
      layer.forEach(nodeId => {
        const value = nodeValueMap.get(nodeId) || 0;
        const nodeHeight = Math.max(value * scale, 10);
        nodePositions.set(nodeId, { x, y: currentY, height: nodeHeight });
        currentY += nodeHeight + nodePadding;
      });
    });

    const linkPaths = data.links.map(link => {
      const sourcePos = nodePositions.get(link.source);
      const targetPos = nodePositions.get(link.target);
      
      if (!sourcePos || !targetPos) return null;

      const sourceTotalOut = sourceValues.get(link.source) || 1;
      const targetTotalIn = targetValues.get(link.target) || 1;
      
      const sourceHeight = sourcePos.height * (link.value / sourceTotalOut);
      const targetHeight = targetPos.height * (link.value / targetTotalIn);

      const x1 = sourcePos.x + nodeWidth;
      const x2 = targetPos.x;
      const y1 = sourcePos.y + sourcePos.height / 2;
      const y2 = targetPos.y + targetPos.height / 2;
      const cx = (x1 + x2) / 2;

      return {
        path: `M ${x1} ${y1 - sourceHeight / 2}
               C ${cx} ${y1 - sourceHeight / 2}, ${cx} ${y2 - targetHeight / 2}, ${x2} ${y2 - targetHeight / 2}
               L ${x2} ${y2 + targetHeight / 2}
               C ${cx} ${y2 + targetHeight / 2}, ${cx} ${y1 + sourceHeight / 2}, ${x1} ${y1 + sourceHeight / 2}
               Z`,
        value: link.value,
        source: link.source,
        target: link.target,
      };
    }).filter(Boolean);

    const colorScale = [
      '#3a6cf5',
      '#ff6b35',
      '#10b981',
      '#8b5cf6',
      '#f59e0b',
      '#06b6d4',
      '#ec4899',
    ];

    return {
      width,
      height,
      padding,
      nodeWidth,
      nodePositions: Array.from(nodePositions.entries()).map(([id, pos]) => ({
        id,
        name: data.nodes.find(n => n.id === id)?.name || id,
        value: nodeValueMap.get(id) || 0,
        ...pos,
        color: colorScale[layers.findIndex(layer => layer.includes(id)) % colorScale.length],
      })),
      linkPaths,
    };
  }, [data, height]);

  if (!chartData || !data.nodes.length) {
    return (
      <div className="flex items-center justify-center h-80 text-neutral-400">
        暂无路径数据
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <svg
          width={chartData.width}
          height={chartData.height}
          className="mx-auto"
        >
          <defs>
            {chartData.nodePositions.map((node, i) => (
              <linearGradient
                key={`grad-${i}`}
                id={`gradient-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor={node.color} stopOpacity="0.6" />
                <stop offset="100%" stopColor={node.color} stopOpacity="0.3" />
              </linearGradient>
            ))}
          </defs>

          {chartData.linkPaths.map((link, i) => (
            <path
              key={`link-${i}`}
              d={link?.path}
              fill={chartData.nodePositions[i % chartData.nodePositions.length]?.color || '#3a6cf5'}
              fillOpacity="0.4"
              className="transition-opacity duration-200 hover:fill-opacity-60"
            >
              <title>
                {link?.source} → {link?.target}: {link?.value} 人
              </title>
            </path>
          ))}

          {chartData.nodePositions.map((node, i) => (
            <g key={`node-${i}`}>
              <rect
                x={node.x}
                y={node.y}
                width={chartData.nodeWidth}
                height={node.height}
                fill={node.color}
                rx="3"
                className="transition-all duration-200 hover:opacity-80 cursor-pointer"
              />
              <text
                x={node.x < chartData.width / 2 ? node.x + chartData.nodeWidth + 8 : node.x - 8}
                y={node.y + node.height / 2}
                textAnchor={node.x < chartData.width / 2 ? 'start' : 'end'}
                dominantBaseline="middle"
                className="text-xs fill-neutral-600 font-medium"
              >
                {node.name}
              </text>
              <text
                x={node.x < chartData.width / 2 ? node.x + chartData.nodeWidth + 8 : node.x - 8}
                y={node.y + node.height / 2 + 14}
                textAnchor={node.x < chartData.width / 2 ? 'start' : 'end'}
                dominantBaseline="middle"
                className="text-xs fill-neutral-400"
              >
                {node.value} 人
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
