/**
 * Home.jsx
 * Main page for the Stackulator BBM7 Team Grader.
 * Two-column layout (desktop): roster input left, grade display right.
 * Single-column stacked on mobile.
 */

import { useState } from 'react';
import RosterInput from '../components/RosterInput';
import GradeDisplay from '../components/GradeDisplay';
import { gradeTeam } from '../engine/scoringEngine';

export default function Home() {
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const handleAnalyze = (roster, options = {}) => {
    const gradeResult = gradeTeam(roster, options);
    setResult(gradeResult);
    setShowResult(true);
  };

  const handleReset = () => {
    setResult(null);
    setShowResult(false);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      {/* Nav / Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">
              Stack<span className="text-green-400">ulator</span>
            </span>
            <span className="hidden sm:block text-slate-600 text-sm ml-1">·</span>
            <span className="hidden sm:block text-slate-400 text-sm">BBM7 Team Grader</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md font-mono">
              BBM7 / 2026
            </span>
            <span className="text-xs text-slate-500">
              1.6M teams calibrated
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Grade Your{' '}
            <span className="text-green-400">Best Ball</span>{' '}
            Roster
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto">
            Enter your 18-round BBM7 draft picks and get a data-driven letter grade.
            Calibrated from advance-rate analysis of 1.6 million BBM II–V rosters.
          </p>
        </div>

        {/* Score methodology pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { label: 'Construction', pct: '35%', icon: '🏗️', tip: 'WR/RB/QB/TE count buckets' },
            { label: 'Value',        pct: '35%', icon: '💰', tip: 'ADP efficiency + capital allocation' },
            { label: 'Stack',        pct: '20%', icon: '⚡', tip: 'QB stack + Week 17 game tier' },
            { label: 'Risk',         pct: '10%', icon: '🎲', tip: 'RB1 timing + dead zones' },
          ].map(({ label, pct, icon, tip }) => (
            <div
              key={label}
              title={tip}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700
                         rounded-full text-sm cursor-help"
            >
              <span>{icon}</span>
              <span className="text-white font-medium">{label}</span>
              <span className="text-green-400 font-bold">{pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {!showResult ? (
          /* Input view — centered single column for the table */
          <div className="max-w-3xl mx-auto">
            <RosterInput onAnalyze={handleAnalyze} />
          </div>
        ) : (
          /* Results view — two-column on desktop */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: roster table (collapsed / re-editable) */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                  Your Roster
                </h2>
                <button
                  onClick={handleReset}
                  className="text-xs text-green-400 hover:text-green-300 transition-colors"
                >
                  Edit / New Roster →
                </button>
              </div>
              <RosterInput onAnalyze={handleAnalyze} />
            </div>

            {/* Right: grade display */}
            <div className="lg:sticky lg:top-20">
              <div className="mb-3">
                <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                  Grade Report
                </h2>
              </div>
              <GradeDisplay result={result} onReset={handleReset} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8 py-6 text-center">
        <p className="text-slate-600 text-xs">
          Stackulator · Calibrated from BBM II–V + Best Bowl Mania data ·
          Not affiliated with Underdog Fantasy
        </p>
      </footer>
    </div>
  );
}
