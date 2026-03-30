import { useEffect } from 'react';
import styles from './Loading.module.css';

interface LoadingProps {
  onDone: () => void;
}

const AGENTS = [
  { name: 'Vibe Agent', status: 'Matching places to your personality...' },
  { name: 'Budget Agent', status: 'Allocating your budget across days...' },
  { name: 'Logistics Agent', status: 'Clustering spots to cut travel time...' },
  { name: 'Diversity Agent', status: 'Checking your plan for variety...' },
  { name: 'Reconciler Agent', status: 'Building your final itinerary...' },
];

export default function Loading({ onDone }: LoadingProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDone, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [onDone]);

  return (
    <section className={styles.screen}>
      <div className={styles.panel}>
        <div className={styles.hero}>
          <p className={styles.step}>Almost there</p>
          <h2 className={styles.title}>Planning your trip...</h2>
          <p className={styles.subtitle}>
            Your planning agents are combining vibe, timing, budget, and route
            logic into one itinerary.
          </p>
        </div>

        <div className={styles.progressShell}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} />
          </div>
        </div>

        <div className={styles.agentList}>
          {AGENTS.map((agent, index) => (
            <div
              className={styles.agentCard}
              key={agent.name}
              style={{ animationDelay: `${index * 0.16}s` }}
            >
              <div className={styles.agentMeta}>
                <span className={styles.agentDot} />
                <span className={styles.agentName}>{agent.name}</span>
              </div>
              <span className={styles.agentStatus}>{agent.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
