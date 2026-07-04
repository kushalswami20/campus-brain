'use client';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
}

/** Minimal dependency-free SVG bar chart. */
export function BarChart({ data, height = 160 }: BarChartProps): React.ReactElement {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No data yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <svg
      viewBox={`0 0 100 ${100}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
      role="img"
    >
      {data.map((d, i) => {
        const h = (d.value / max) * 90;
        return (
          <g key={i}>
            <rect
              x={i * barWidth + barWidth * 0.15}
              y={100 - h}
              width={barWidth * 0.7}
              height={h}
              rx={0.8}
              fill="hsl(var(--primary))"
              opacity={0.85}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
