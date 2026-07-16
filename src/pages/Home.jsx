/**
 * Home.jsx
 * Main page for the Stackulator BBM7 Team Grader.
 * Flow: RosterInput → AnalysisLoader (~5.8s) → RosterSummary + GradeDisplay
 */

import { useState } from 'react';
import RosterInput from '../components/RosterInput';
import GradeDisplay from '../components/GradeDisplay';
import AnalysisLoader from '../components/AnalysisLoader';
import RosterSummary from '../components/RosterSummary';
import CutoverNotice from '../components/CutoverNotice';
import { gradeTeam } from '../engine/scoringEngine';

export default function Home() {
  const [result, setResult] = useState(null);
  const [pendingResult, setPendingResult] = useState(null); // Change 6: computed immediately for badge unlock
  const [showResult, setShowResult] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submittedRoster, setSubmittedRoster] = useState([]);

  const handleAnalyze = (roster, options = {}) => {
    const gradeResult = gradeTeam(roster, options);
    setPendingResult(gradeResult); // Change 6: store immediately so AnalysisLoader can reveal badges
    setResult(null);
    setSubmittedRoster(roster);
    setShowResult(false);
    setAnalyzing(true);
  };

  const handleLoaderComplete = () => {
    setResult(pendingResult); // Change 6: promote pending result on loader complete
    setAnalyzing(false);
    setShowResult(true);
  };

  const handleReset = () => {
    setResult(null);
    setPendingResult(null);
    setShowResult(false);
    setAnalyzing(false);
    setSubmittedRoster([]);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      {/* Nav / Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">
              Stack<span style={{ color: 'var(--color-orange)' }}>ulator</span>
            </span>
            <span className="hidden sm:block text-slate-600 text-sm ml-1">·</span>
            <span className="hidden sm:block text-slate-400 text-sm">BBM7 Team Grader</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md font-mono">
              BBM7 / 2026
            </span>
            <span className="text-xs text-slate-500">
              2.63M real drafts · 5 seasons
            </span>
          </div>
        </div>
      </header>

      <CutoverNotice />

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Grade Your{' '}
            {/* Change 5 Fix 2: Best Ball accent → orange */}
            <span style={{ color: 'var(--color-orange)' }}>Best Ball</span>{' '}
            Roster
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto">
            Enter your 18-round BBM7 draft picks and get a data-driven letter grade.
            Built on 2,629,295 real BBM rosters across five seasons — and validated on a season the model never saw.
          </p>
        </div>

        {/* Credibility strip */}
        <div style={{ marginBottom: '32px' }}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-center">
            {[
              { big: '2.49x', caption: "A-graded rosters reached the finals at 2.49x the field's rate" },
              { big: '2x', caption: 'Top-10% scores advanced at double the bottom-10%' },
              { big: '5 seasons', caption: 'Validated out-of-sample on a season the model never saw' },
            ].map((stat) => (
              <div key={stat.big} style={{ maxWidth: '220px' }}>
                <div style={{ color: 'var(--color-orange)', fontSize: '24px', fontWeight: 800, lineHeight: 1.1 }}>
                  {stat.big}
                </div>
                <div className="text-slate-400" style={{ fontSize: '12px', marginTop: '4px', lineHeight: 1.4 }}>
                  {stat.caption}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-600" style={{ fontSize: '11px', marginTop: '14px' }}>
            Population-level advance rates from 2.63M historical rosters — no tool can predict champions.
          </p>
        </div>

        {/* Change 5 Fix 3: Weight pills → expandable "How it works" */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <details>
            <summary style={{
              cursor: 'pointer',
              color: 'var(--color-blue-light)',
              fontWeight: 500,
              listStyle: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
            }}>
              <span>How we grade</span>
              <span style={{ fontSize: '11px' }}>▾</span>
            </summary>
            <div style={{
              marginTop: '12px',
              padding: '16px 24px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              maxWidth: '480px',
              margin: '12px auto 0',
              lineHeight: 1.65,
              fontSize: '13px',
              color: 'var(--color-text-light)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--color-cream)', marginBottom: '8px' }}>
                Four components, five seasons of evidence
              </div>
              <div>Construction (30%) — positional distribution and round allocation</div>
              <div>Value (30%) — ADP efficiency and capital discipline</div>
              <div>Stack (25%) — Week 17 game stacks and team correlation (diminishing returns)</div>
              <div>Boom Bust Balance (15%) — floor quality and meaningful Week 17 players</div>
              <div style={{ marginTop: '10px', color: 'var(--color-text-light)', fontSize: '12px', opacity: 0.7 }}>
                Trained on BBM II–V (2021–2024) · Validated out-of-sample on BBM VI (2025) · Recalibrated annually.
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {analyzing ? (
          <AnalysisLoader onComplete={handleLoaderComplete} achievements={pendingResult?.achievements || []} />
        ) : !showResult ? (
          <div className="max-w-3xl mx-auto">
            <RosterInput onAnalyze={handleAnalyze} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="mb-3">
                <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                  Submitted Roster
                </h2>
              </div>
              <RosterSummary roster={submittedRoster} onEdit={handleReset} />
            </div>
            <div className="lg:sticky lg:top-20">
              <div className="mb-3">
                <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                  Grade Report
                </h2>
              </div>
              {/* Pass roster so GradeDisplay can generate the narrative */}
              <GradeDisplay result={result} roster={submittedRoster} onReset={handleReset} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8 py-6 text-center">
        <p className="text-slate-600 text-xs">
          Stackulator · Built on 5 seasons of BBM data (2021–2025) ·
          Not affiliated with Underdog Fantasy
        </p>
      </footer>
    </div>
  );
}
