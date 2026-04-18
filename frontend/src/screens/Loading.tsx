import { useEffect, useRef, useState } from 'react';
import styles from './Loading.module.css';

const AGENTS = [
  { name: 'Vibe Agent', status: 'Matching places to your personality...' },
  { name: 'Budget Calculation', status: 'Allocating your budget across days...' },
  { name: 'Geo-Clustering', status: 'Organizing spots by location...' },
  { name: 'Diversity Check', status: 'Balancing activity categories...' },
  { name: 'Reconciler Agent', status: 'Building your final itinerary...' },
];

const ITERATION_DELAY_MS = 2500;
const COMPLETION_DELAY_MS = 1000;

interface LoadingProps {
  onComplete?: () => void;
  tokensUsed?: number;
  responseTimeMs?: number;
  usedFallback?: boolean;
  retryCount?: number;
}

export default function Loading({
  onComplete,
  tokensUsed,
  responseTimeMs,
  usedFallback,
  retryCount,
}: LoadingProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const hasLoggedFinalPlan = useRef(false);
  const isComplete = activeIndex >= AGENTS.length;

  useEffect(() => {
    if (isComplete) return;

    const timer = window.setTimeout(() => {
      setCompleted((prev) => [...prev, activeIndex]);
      setActiveIndex((prev) => prev + 1);
    }, ITERATION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, isComplete]);

  useEffect(() => {
    if (!isComplete) return;

    const timer = window.setTimeout(() => {
      onComplete?.();
    }, COMPLETION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isComplete, onComplete]);

  useEffect(() => {
    if (isComplete) return;
    const currentAgent = AGENTS[activeIndex];
    if (!currentAgent) return;

    console.log(
      `[loading] iteration ${activeIndex + 1}/${AGENTS.length}: ${currentAgent.name} - ${currentAgent.status}`
    );
  }, [activeIndex, isComplete]);

  useEffect(() => {
    if (!isComplete || hasLoggedFinalPlan.current) return;

    hasLoggedFinalPlan.current = true;
    const finalPlan = AGENTS.map((agent, index) => ({
      step: index + 1,
      agent: agent.name,
      status: completed.includes(index) ? 'done' : 'pending',
      note: agent.status,
    }));

    console.group('[loading] final iteration plan');
    console.table(finalPlan);
    console.log('[loading] execution summary', {
      responseTimeMs: responseTimeMs ?? 0,
      tokensUsed: tokensUsed ?? 0,
      usedFallback: Boolean(usedFallback),
      retryCount: retryCount ?? 0,
    });
    console.groupEnd();
  }, [completed, isComplete, responseTimeMs, retryCount, tokensUsed, usedFallback]);

  const responseTimeSec = responseTimeMs ? (responseTimeMs / 1000).toFixed(1) : '0';
  const fallbackBannerClass = styles.fallbackBanner || styles.warningBanner;
  const metricsContainerClass = styles.devBadge || styles.metricsBox;

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>Planning your trip...</h2>

      {usedFallback && (
        <div className={fallbackBannerClass}>
          <span className={styles.warningIcon}>⚠️</span>
          <span className={styles.warningText}>
            Used fallback scoring for vibe matching (network issue)
          </span>
        </div>
      )}

      <div className={styles.agentList}>
        {AGENTS.map((agent, index) => (
          <div
            key={agent.name}
            className={`${styles.agentRow} ${
              completed.includes(index)
                ? styles.done
                : activeIndex === index
                  ? styles.active
                  : styles.pending
            }`}
          >
            <span className={styles.indicator}>
              {completed.includes(index) ? '✓' : activeIndex === index ? '●' : '○'}
            </span>
            <div>
              <p className={styles.agentName}>{agent.name}</p>
              {(activeIndex === index || completed.includes(index)) && (
                <p className={styles.agentStatus}>{agent.status}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {isComplete && (
        <div className={metricsContainerClass}>
          <p className={styles.metricsText}>
            Generated itinerary in {responseTimeSec}s
            {tokensUsed ? ` using ~${tokensUsed.toLocaleString()} tokens` : ''}
            {retryCount && retryCount > 0 ? ` (${retryCount} retry)` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
