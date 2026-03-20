"use client";

import { FormEvent, useState, useTransition } from "react";
import type { StoredProposal } from "@/lib/schema";

const samplePrompts = [
  "A 10-person leadership retreat in the mountains for 3 days with a $4k budget.",
  "A 40-person sales kickoff near the beach for 2 days with a $12k budget and space for workshops.",
  "An executive strategy offsite for 8 people in a quiet wellness setting for 3 days with a $6k budget.",
];

type ConciergeShellProps = {
  initialHistory: StoredProposal[];
};

export function ConciergeShell({ initialHistory }: ConciergeShellProps) {
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [history, setHistory] = useState(initialHistory);
  const [activeProposal, setActiveProposal] = useState<StoredProposal | null>(
    initialHistory[0] ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isLoading || isPending;

  async function submitPrompt(submittedPrompt: string) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: submittedPrompt }),
      });

      const data = (await response.json()) as {
        error?: string;
        proposal?: StoredProposal;
      };

      if (!response.ok || !data.proposal) {
        throw new Error(data.error ?? "The planner did not return a proposal.");
      }

      startTransition(() => {
        setActiveProposal(data.proposal ?? null);
        setHistory((currentHistory) => [
          data.proposal as StoredProposal,
          ...currentHistory.filter((item) => item.id !== data.proposal?.id),
        ]);
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Something went wrong while planning the event.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedPrompt = prompt.trim();
    if (!submittedPrompt) {
      return;
    }

    void submitPrompt(submittedPrompt);
  }

  return (
    <div className="page-shell">
      <div className="ambient-orb ambient-orb--one" />
      <div className="ambient-orb ambient-orb--two" />
      <main className="layout">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">AI Event Concierge</p>
            <h1>Plan a polished corporate offsite from one natural-language brief.</h1>
            <p className="hero-text">
              This assignment build turns a freeform event request into a structured
              venue proposal, stores each result in SQLite, and keeps prior searches
              visible after refresh.
            </p>
          </div>

          <form className="planner-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="event-brief">
              Describe the offsite
            </label>
            <textarea
              id="event-brief"
              name="event-brief"
              className="planner-input"
              placeholder="Example: A 25-person strategy offsite in a quiet lakeside setting for 2 days with a $9k budget."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
            />

            <div className="form-toolbar">
              <p className="form-hint">
                Include group size, destination vibe, duration, and budget for the
                strongest match.
              </p>
              <button className="primary-button" type="submit" disabled={isBusy}>
                {isBusy ? (
                  <>
                    <span className="button-spinner" aria-hidden="true" />
                    AI is planning...
                  </>
                ) : (
                  "Generate proposal"
                )}
              </button>
            </div>
          </form>

          {isBusy ? (
            <div className="planner-status" role="status" aria-live="polite">
              <span className="button-spinner" aria-hidden="true" />
              Matching the brief to a venue style, estimating cost, and writing the
              fit summary.
            </div>
          ) : null}

          {error ? <p className="error-banner">{error}</p> : null}

          <div className="sample-strip" aria-label="Sample prompts">
            {samplePrompts.map((samplePrompt) => (
              <button
                key={samplePrompt}
                className="sample-chip"
                type="button"
                onClick={() => {
                  setPrompt(samplePrompt);
                  setError(null);
                }}
              >
                {samplePrompt}
              </button>
            ))}
          </div>
        </section>

        <section className="overview-grid" aria-label="Project overview">
          <article className="overview-card">
            <span className="overview-label">Saved proposals</span>
            <strong>{history.length}</strong>
            <p>Every successful search is written to local SQLite persistence.</p>
          </article>
          <article className="overview-card">
            <span className="overview-label">AI mode</span>
            <strong>
              {activeProposal
                ? activeProposal.source === "demo"
                  ? "Demo fallback"
                  : "OpenAI"
                : "Ready for first run"}
            </strong>
            <p>
              Add an `OPENAI_API_KEY` for live structured responses. Demo mode is
              optional for local UI testing.
            </p>
          </article>
          <article className="overview-card">
            <span className="overview-label">Refresh-safe history</span>
            <strong>
              {history[0] ? formatDate(history[0].createdAt) : "Waiting for first plan"}
            </strong>
            <p>The latest proposal remains visible after the page reloads.</p>
          </article>
        </section>

        <section className="content-grid">
          <div className="panel panel--feature">
            <div className="panel-header">
              <div>
                <p className="eyebrow eyebrow--small">Current proposal</p>
                <h2>{activeProposal ? activeProposal.venueName : "No proposal yet"}</h2>
              </div>
              {activeProposal ? (
                <span
                  className={`badge ${
                    activeProposal.source === "demo" ? "badge--demo" : "badge--live"
                  }`}
                >
                  {activeProposal.source === "demo" ? "Demo source" : "OpenAI source"}
                </span>
              ) : null}
            </div>

            {activeProposal ? (
              <article className="proposal-card proposal-card--featured">
                <p className="proposal-location">{activeProposal.location}</p>
                <dl className="detail-grid">
                  <div className="detail-box">
                    <dt>Estimated total</dt>
                    <dd>{activeProposal.estimatedCost}</dd>
                  </div>
                  <div className="detail-box">
                    <dt>Created</dt>
                    <dd>{formatDate(activeProposal.createdAt)}</dd>
                  </div>
                </dl>

                <div className="proposal-section">
                  <h3>Original brief</h3>
                  <p>{activeProposal.prompt}</p>
                </div>

                <div className="proposal-section">
                  <h3>Why it fits</h3>
                  <p>{activeProposal.whyItFits}</p>
                </div>

                <div className="proposal-section">
                  <h3>Highlights</h3>
                  <div className="highlight-row">
                    {activeProposal.highlights.map((highlight) => (
                      <span key={highlight} className="highlight-chip">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ) : (
              <div className="empty-state">
                <h3>Your first offsite plan will appear here.</h3>
                <p>
                  Submit a brief above and the dashboard will generate a venue, cost
                  estimate, and justification.
                </p>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow eyebrow--small">Search history</p>
                <h2>Previous briefs</h2>
              </div>
            </div>

            {history.length ? (
              <div className="history-list">
                {history.map((proposal) => (
                  <button
                    key={proposal.id}
                    className={`history-card ${
                      proposal.id === activeProposal?.id ? "history-card--active" : ""
                    }`}
                    type="button"
                    onClick={() => setActiveProposal(proposal)}
                  >
                    <div className="history-card__top">
                      <div>
                        <h3>{proposal.venueName}</h3>
                        <p className="proposal-location">{proposal.location}</p>
                      </div>
                      <span className="history-card__time">{formatDate(proposal.createdAt)}</span>
                    </div>

                    <p className="history-card__prompt">{proposal.prompt}</p>

                    <div className="history-card__bottom">
                      <strong>{proposal.estimatedCost}</strong>
                      <span
                        className={`badge ${
                          proposal.source === "demo" ? "badge--demo" : "badge--live"
                        }`}
                      >
                        {proposal.source}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <h3>No saved searches yet.</h3>
                <p>
                  Once the first proposal is generated, it will appear here and stay
                  available after refresh.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
