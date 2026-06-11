import { Activity } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';
import type { HealthReport, HealthGrade, SubScores } from '../health/healthTypes';
import type { VaultHealthCardProps } from './types';

const GRADE_LABEL: Record<HealthGrade, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

/** Ring / accent color for a grade band. */
function gradeColor(grade: HealthGrade): string {
  if (grade === 'fair') return 'var(--ogi-amber)';
  if (grade === 'poor') return 'var(--ogi-danger)';
  return 'var(--ogi-accent)'; // excellent / good
}

const SUB_SCORE_META: { key: keyof SubScores; label: string; title?: string }[] = [
  { key: 'connectivity', label: 'Connectivity' },
  { key: 'cohesion', label: 'Cohesion' },
  { key: 'freshness', label: 'Freshness' },
  {
    key: 'discoverability',
    label: 'Discoverability',
    title: 'Counts inline #tags only; YAML frontmatter tags are not included',
  },
];

const labelStyle: CSSProperties = {
  fontFamily: 'var(--ogi-font-label)',
  fontSize: 9,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--ogi-marginalia)',
  fontWeight: 700,
};

const monoStyle: CSSProperties = {
  fontFamily: 'var(--ogi-font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

function Gauge({ overall, grade }: { overall: number; grade: HealthGrade }) {
  const size = 132;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, overall / 100));
  const color = gradeColor(grade);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} role="img" aria-label={`Overall vault health ${overall} out of 100, ${GRADE_LABEL[grade]}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ogi-rule)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * fraction} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <span style={{ ...monoStyle, fontSize: 34, fontWeight: 700, color: 'var(--ogi-ink)', lineHeight: 1 }}>
          {overall}
        </span>
        <span style={{ ...labelStyle, color }}>{GRADE_LABEL[grade]}</span>
      </div>
    </div>
  );
}

function SubScoreBars({ subScores }: { subScores: SubScores }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
      {SUB_SCORE_META.map(({ key, label, title }) => {
        const value = subScores[key];
        return (
          <div key={key} title={title}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
              <span style={labelStyle}>{label}</span>
              <span style={{ ...monoStyle, fontSize: 11, color: 'var(--ogi-ink-dim)' }}>{value}</span>
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: 'var(--ogi-rule)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, value))}%`,
                  background: 'var(--ogi-accent)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ trend }: { trend: NonNullable<VaultHealthCardProps['trend']> }) {
  const points = trend.sparkline;
  const delta = trend.delta;

  let deltaNode: ReactElement | null = null;
  if (typeof delta === 'number') {
    let text: string;
    let color: string;
    if (delta > 0) {
      text = `+${delta} since last`;
      color = 'var(--ogi-accent)';
    } else if (delta < 0) {
      text = `${delta} since last`;
      color = 'var(--ogi-danger)';
    } else {
      text = 'no change';
      color = 'var(--ogi-marginalia)';
    }
    deltaNode = (
      <span style={{ ...monoStyle, fontSize: 10, color }}>{text}</span>
    );
  }

  if (points.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ogi-marginalia)', fontStyle: 'italic' }}>
          Collecting trend data...
        </span>
        {deltaNode}
      </div>
    );
  }

  const w = 160;
  const h = 32;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (p - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <svg width={w} height={h} role="img" aria-label="Vault health trend" style={{ overflow: 'visible' }}>
        <polyline
          points={coords}
          fill="none"
          stroke="var(--ogi-accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {deltaNode}
    </div>
  );
}

function TopFixes({ report }: { report: HealthReport }) {
  if (report.topFixes.length === 0) {
    return (
      <p style={{ fontSize: 11, color: 'var(--ogi-marginalia)', fontStyle: 'italic', margin: 0 }}>
        No fixes suggested -- nice work.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {report.topFixes.map((fix) => (
        <li
          key={fix.fixId}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
            paddingBottom: 6,
            borderBottom: 'var(--ogi-hairline) solid var(--ogi-rule)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ogi-ink)' }}>{fix.title}</div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ogi-ink-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fix.description}
            </div>
          </div>
          <span
            style={{
              ...monoStyle,
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--ogi-accent)',
              background: 'var(--ogi-accent-soft)',
              borderRadius: 3,
              padding: '2px 6px',
            }}
            title="Estimated impact on overall score"
          >
            +{fix.estimatedImpact}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VaultHealthCard({ report, trend }: VaultHealthCardProps) {
  if (report.noteCount === 0) {
    return (
      <div className="ogi-card" style={{ padding: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--ogi-marginalia)', margin: 0 }}>
          No notes yet -- add notes to see your vault health.
        </p>
      </div>
    );
  }

  return (
    <div className="ogi-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Gauge overall={report.overall} grade={report.grade} />
        <SubScoreBars subScores={report.subScores} />
      </div>

      <div>
        <div style={{ ...labelStyle, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={11} aria-hidden="true" />
          Trend
        </div>
        {trend ? (
          <Sparkline trend={trend} />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--ogi-marginalia)', fontStyle: 'italic' }}>
            Collecting trend data...
          </span>
        )}
      </div>

      <div>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Top Fixes</div>
        <TopFixes report={report} />
      </div>
    </div>
  );
}
