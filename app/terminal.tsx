"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { performance } from "../src/analytics";
const money = (v: unknown) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v ?? 0),
  );
const pct = (v: unknown) =>
  v === null || v === undefined ? "—" : (Number(v) * 100).toFixed(1) + "%";
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : "—");
const tabs = [
  "Overview",
  "RECOMMENDED FOR YOU",
  "Live markets",
  "AI research",
  "Positions",
  "Trade history",
  "Performance",
  "System activity",
  "Strategy",
];
export default function Dashboard({ data: d }: { data: any }) {
  const [tab, setTab] = useState("Overview"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [config, setConfig] = useState(d.strategies[0]?.config ?? {}),
    [message, setMessage] = useState("");
  const router = useRouter();
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => { setClock(Date.now()); const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(timer);
  }, [router]);
  const latest = d.snapshots.at(-1),
    open = d.positions.filter((p: any) => !p.closed_at),
    closed = d.positions.filter((p: any) => p.closed_at),
    realized = closed.reduce(
      (s: number, p: any) => s + Number(p.realized_pnl),
      0,
    ),
    equity = latest?.equity ?? d.account.cash;
  const stats = performance(d.positions, d.snapshots, d.history);
  const fresh =
    d.account.last_quote &&
    Date.now() - Date.parse(d.account.last_quote) < 120000;
  const matches = d.markets.filter((m: any) =>
    m.question.toLowerCase().includes(search.toLowerCase()),
  );
  const drawdown = d.snapshots.reduce(
    (a: { peak: number; max: number }, s: any) => {
      const n = Number(s.equity);
      a.peak = Math.max(a.peak, n);
      a.max = Math.max(a.max, 1 - n / a.peak);
      return a;
    },
    { peak: 1000, max: 0 },
  ).max;
  const chart = () => {
    const rows = d.snapshots;
    if (rows.length < 2)
      return (
        <div className="empty">
          <b>Your experiment starts here</b>
          <p>
            Equity history appears as the worker records portfolio observations.
          </p>
        </div>
      );
    const vals = rows.map((s: any) => Number(s.equity)),
      lo = Math.min(...vals) * 0.999,
      hi = Math.max(...vals) * 1.001,
      points = vals
        .map(
          (v: number, i: number) =>
            `${(i / (vals.length - 1)) * 800},${150 - ((v - lo) / (hi - lo || 1)) * 130}`,
        )
        .join(" ");
    return (
      <>
        <svg
          viewBox="0 0 800 180"
          role="img"
          aria-label="Observed portfolio equity over time"
        >
          <line x1="0" x2="800" y1="150" y2="150" stroke="#dbe4dd" />
          <polyline
            points={points}
            fill="none"
            stroke="#167248"
            strokeWidth="3"
          />
        </svg>
        <div className="chartlabels">
          <span>{date(rows[0].created_at)}</span>
          <span>{date(rows.at(-1).created_at)}</span>
        </div>
      </>
    );
  };
  const marketTable = () => (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Market / long outcome</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>AI probability</th>
            <th>Confidence</th>
            <th>Observed</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m: any) => (
            <tr
              key={m.id}
              onClick={() => setSelected(m)}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSelected(m)}
            >
              <td>
                <b>{m.question}</b>
                <small>
                  {m.raw.marketSides?.find((s: any) => s.long)?.description ??
                    "Long"}{" "}
                  · {m.category}
                </small>
              </td>
              <td>{pct(m.book?.bids[0]?.price)}</td>
              <td>{pct(m.book?.offers[0]?.price)}</td>
              <td>{pct(m.probability)}</td>
              <td>{pct(m.confidence)}</td>
              <td className="muted">
                {m.observed_at
                  ? new Date(m.observed_at).toLocaleTimeString()
                  : "Unavailable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!matches.length && (
        <div className="empty">
          No market observations yet. The scanner will populate this table.
        </div>
      )}
    </div>
  );
  return (
    <div className="shell">
      <aside>
        <div className="wordmark">◈ PolyLab</div>
        <div className="workspace">
          PRIVATE WORKSPACE<small>Polymarket US / Experiment 01</small>
        </div>
        <nav>
          {tabs.map((t, i) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setSelected(null);
              }}
            >
              <span>{["◫", "★", "◉", "⌕", "▤", "↔", "◴", "≋", "⚙"][i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <div className="asidebottom">
          <b>SIMULATION ONLY</b>
          <p>
            Real markets.
            <br />
            Paper capital.
          </p>
          <form action="/api/logout" method="post">
            <button>Sign out ↗</button>
          </form>
        </div>
      </aside>
      <main className="main">
        <header>
          <span>
            WORKSPACE <i>/</i> {tab}
          </span>
          <div>
            <span className={"status " + (fresh ? "good" : "")}>
              {fresh ? "● Data recently received" : "○ Data needs refresh"}
            </span>
            <button className="refresh" onClick={() => router.refresh()}>
              Refresh ↻
            </button>
          </div>
        </header>
        <section className="content">
          <div className="title">
            <div>
              <div className="eyebrow">THE $1,000 EXPERIMENT</div>
              <h1>{tab === "Overview" ? "Find an edge. Measure it." : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "An honest record of how evidence performs against the market."
                  : "Live observations and preserved decisions from your private research terminal."}
              </p>
            </div>
            <span className="badge">PAPER TRADING</span>
          </div>
          <div className="notice">
            <span>◉</span>
            <div>
              <b>
                {d.researchConfigured
                  ? "Research configured"
                  : "AI research awaits configuration"}
              </b>
              <p>
                {d.researchConfigured
                  ? "Research is subject to evidence thresholds and the daily run cap."
                  : "No API key is configured. Market data is real; predictions and simulated trades remain empty."}{" "}
                {d.local
                  ? "Local preview — continuous VPS worker is not deployed."
                  : ""}
              </p>
            </div>
          </div>
          {tab === "RECOMMENDED FOR YOU" && (
            <section aria-label="Personal recommendations">
              <div className="panel">
                <h2>High confidence. Meaningful upside.</h2>
                <p>At least 80% estimated win probability and 80% confidence, 25% potential return if correct, and 10% estimated expected return after the fee reserve. Evidence, liquidity and portfolio limits also apply.</p>
                <p className="muted">{d.runActive ? "Research follows your authorized run and API budget." : "Research run paused — no new paid analysis is running."} Data checked: {date(d.checkedAt)}. Refreshes every 30 seconds.</p>
              </div>
              {!(d.recommendations ?? []).length && <div className="panel empty"><b>No qualifying recommendations yet</b><p>Low-margin picks are filtered out. New qualifying research will appear here with its original recommendation time and suggested paper allocation.</p></div>}
              {(d.recommendations ?? []).map((row: any) => {
                const r = row.payload;
                const active = clock !== null && d.runActive && clock < Date.parse(r.expiresAt);
                return <article className="panel recommendation" key={row.id}>
                  <div className="sectionhead"><h2>{r.question}</h2><span className="badge">{active ? "CURRENT PAPER IDEA" : "EXPIRED — RECHECK REQUIRED"}</span></div>
                  <h3>{r.outcome}</h3>
                  <p>Recommended <time dateTime={r.recommendedAt}>{date(r.recommendedAt)}</time>{clock !== null && ` · ${Math.max(0, Math.floor((clock - Date.parse(r.recommendedAt)) / 60000))} min ago`}</p>
                  <div className="recommendation-grid">
                    <div><small>Confidence in analysis</small><strong>{pct(r.confidence)}</strong></div>
                    <div><small>Estimated win probability</small><strong>{pct(r.probability)}</strong></div>
                    <div><small>Return if correct</small><strong>{pct(r.returnIfWin)}</strong></div>
                    <div><small>Suggested paper amount at issue</small><strong>{money(r.recommendedAmount)}</strong></div>
                  </div>
                  <p>Entry price: {(r.entryPrice * 100).toFixed(1)}¢ · Profit if correct: {money(r.profitIfWin)} · Maximum loss: {money(r.maxLoss)}</p>
                  <p>Estimated expected return: {pct(r.expectedReturn)}. This averages winning and losing outcomes; it is not a promised return.</p>
                  <p className="muted">Quote observed {date(r.quoteAt)} · Valid until {date(r.expiresAt)}. {active ? "Check the current price and exact outcome in Polymarket US before acting." : "The amount and price above are historical, not a current instruction to buy."} {r.note}</p>
                </article>;
              })}
            </section>
          )}
          {selected ? (
            <article className="panel">
              <button onClick={() => setSelected(null)}>
                ← Back to markets
              </button>
              <h2>{selected.question}</h2>
              <p className="muted">
                Long outcome:{" "}
                {
                  selected.raw.marketSides?.find((s: any) => s.long)
                    ?.description
                }{" "}
                · Short outcome:{" "}
                {
                  selected.raw.marketSides?.find((s: any) => !s.long)
                    ?.description
                }
              </p>
              <h3>Exact resolution rules</h3>
              <p className="rules">{selected.rules}</p>
              <h3>Observation</h3>
              <p>
                Received {date(selected.observed_at)} ·{" "}
                {selected.book?.state ?? "Book unavailable"}
              </p>
              <a
                href={"https://polymarket.us/"}
                target="_blank"
                rel="noreferrer"
              >
                Open Polymarket US ↗
              </a>
              <h3>Research</h3>
              {d.research
                .filter((r: any) => r.market_id === selected.id)
                .map((r: any) => (
                  <Research key={r.id} run={r} />
                ))}
              {!selected.research_id && (
                <p>
                  No completed research. No probability estimate has been
                  invented.
                </p>
              )}
            </article>
          ) : (
            <>
              {tab === "Overview" && (
                <>
                  <div className="metrics">
                    {[
                      [
                        "Portfolio equity",
                        latest?.stale_marks ? "Unavailable" : money(equity),
                        "Starting capital " + money(1000),
                      ],
                      [
                        "Cash available",
                        money(d.account.cash),
                        "Reserved for qualified opportunities",
                      ],
                      [
                        "Realized P&L",
                        money(realized),
                        `${closed.length} closed positions`,
                      ],
                      [
                        "Open positions",
                        open.length,
                        `${money(open.reduce((s: number, p: any) => s + Number(p.cost), 0))} committed`,
                      ],
                    ].map(([label, value, sub]) => (
                      <div className="metric" key={String(label)}>
                        <label>{label}</label>
                        <strong>{value}</strong>
                        <small>{sub}</small>
                      </div>
                    ))}
                  </div>
                  <div className="twocol">
                    <article className="panel">
                      <div className="sectionhead">
                        <h2>Portfolio trajectory</h2>
                        <span>OBSERVED EQUITY</span>
                      </div>
                      {chart()}
                    </article>
                    <article className="panel researchstate">
                      <div className="eyebrow">RESEARCH DISCIPLINE</div>
                      <h2>No trade is a decision.</h2>
                      <p>
                        Only evidence-backed estimates that clear your risk
                        limits can become paper positions.
                      </p>
                      <dl>
                        <dt>Minimum confidence</dt>
                        <dd>{pct(config.minConfidence)}</dd>
                        <dt>Minimum net edge</dt>
                        <dd>{pct(config.minEdge)}</dd>
                        <dt>Position limit</dt>
                        <dd>{pct(config.maxPosition)}</dd>
                        <dt>Execution</dt>
                        <dd>{d.tradingEnabled ? "Paper enabled" : "Paused"}</dd>
                      </dl>
                    </article>
                  </div>
                  <article className="panel">
                    <div className="sectionhead">
                      <h2>Market watch</h2>
                      <button onClick={() => setTab("Live markets")}>
                        View all ↗
                      </button>
                    </div>
                    {marketTable()}
                  </article>
                </>
              )}
              {tab === "Live markets" && (
                <article className="panel">
                  <div className="sectionhead">
                    <h2>{matches.length} observed markets</h2>
                    <input
                      aria-label="Search markets"
                      placeholder="Search markets…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {marketTable()}
                </article>
              )}
              {tab === "AI research" && (
                <article className="panel">
                  <h2>Evidence before conviction</h2>
                  {d.research.length ? (
                    d.research.map((r: any) => <Research key={r.id} run={r} />)
                  ) : (
                    <div className="empty">
                      <b>No completed analyses</b>
                      <p>
                        Configure the research provider to begin independent
                        prompts, source capture, and probability estimation.
                      </p>
                    </div>
                  )}
                </article>
              )}
              {tab === "Positions" && (
                <article className="panel">
                  <h2>Open paper positions</h2>
                  <p>Exploratory positions test a market-favorite strategy: up to $25 each and $100 open at once, with timed exits and profit/loss limits. They have no AI confidence estimate or established positive expected return.</p>
                  {open.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Market</th>
                          <th>Side</th>
                          <th>Shares</th>
                          <th>Cost</th>
                          <th>Opened</th>
                        </tr>
                      </thead>
                      <tbody>
                        {open.map((p: any) => (
                          <tr key={p.id}>
                            <td>{p.question}</td>
                            <td>{p.decision?.outcome ?? p.side}{p.decision?.mode === "exploratory" ? " · Exploratory" : ""}</td>
                            <td>{p.quantity}</td>
                            <td>{money(p.cost)}</td>
                            <td>{date(p.opened_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty">
                      <b>Capital is waiting for evidence.</b>
                      <p>
                        No open positions. The ledger remains at its actual
                        balance.
                      </p>
                    </div>
                  )}
                </article>
              )}
              {tab === "Trade history" && (
                <article className="panel">
                  <h2>Preserved execution records</h2>
                  {d.history.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Market</th>
                          <th>Side</th>
                          <th>Probability</th>
                          <th>Strategy</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.history.map((o: any) => (
                          <tr key={o.id}>
                            <td>{o.question}</td>
                            <td>{o.decision?.outcome ?? o.side}</td>
                            <td>{o.decision?.mode === "exploratory" ? "Exploratory · not estimated" : pct(o.probability)}</td>
                            <td>v{o.strategy_id}</td>
                            <td>{date(o.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty">
                      No simulated orders have been executed.
                    </div>
                  )}
                </article>
              )}
              {tab === "Performance" && (
                <>
                  <div className="metrics">
                    {[
                      ["Total return", pct(Number(equity) / 1000 - 1)],
                      [
                        "Win rate",
                        closed.length
                          ? pct(
                              closed.filter(
                                (p: any) => Number(p.realized_pnl) > 0,
                              ).length / closed.length,
                            )
                          : "—",
                      ],
                      ["Maximum drawdown", pct(drawdown)],
                      ["Resolved markets", d.calibration.length],
                    ].map(([k, v]) => (
                      <div className="metric" key={String(k)}>
                        <label>{k}</label>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <article className="panel">
                    <h2>Equity over time</h2>
                    {chart()}
                  </article>
                  <article className="panel">
                    <h2>Probability calibration</h2>
                    <p>
                      First prediction per resolved market. Void and split
                      settlements are excluded.
                    </p>
                    {d.calibration.length ? (
                      <div className="calibration">
                        {Array.from({ length: 10 }, (_, i) => {
                          const bucket = d.calibration.filter(
                              (r: any) =>
                                Math.min(
                                  9,
                                  Math.floor(Number(r.probability) * 10),
                                ) === i,
                            ),
                            actual = bucket.length
                              ? bucket.reduce(
                                  (s: number, r: any) => s + Number(r.payout),
                                  0,
                                ) / bucket.length
                              : null;
                          return (
                            <div key={i}>
                              <label>
                                {i * 10}–{(i + 1) * 10}%
                              </label>
                              <div
                                className="bar"
                                style={{
                                  width:
                                    actual === null ? 0 : `${actual * 70}%`,
                                }}
                              />
                              <span>
                                {pct(actual)} ({bucket.length})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty">
                        Calibration needs resolved predictions. There is no
                        performance claim yet.
                      </div>
                    )}
                  </article>
                </>
              )}
              {tab === "System activity" && (
                <article className="panel">
                  <h2>Worker activity</h2>
                  {d.activity.map((a: any) => (
                    <div className="activity" key={a.id}>
                      <span className="badge">{a.status}</span>
                      <div>
                        <b>{a.kind}</b>
                        <p>{JSON.stringify(a.detail)}</p>
                      </div>
                      <time>{date(a.created_at)}</time>
                    </div>
                  ))}
                  {!d.activity.length && (
                    <div className="empty">
                      No worker observations recorded.
                    </div>
                  )}
                </article>
              )}
              {tab === "Strategy" && (
                <article className="panel">
                  <h2>Strategy v{d.strategies[0]?.id}</h2>
                  <p>
                    Each saved change creates a new version. Historical
                    decisions keep their original settings. Fractions use 0–1
                    units.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setMessage("Saving…");
                      try {
                        const r = await fetch("/api/strategy", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(config),
                        });
                        const result = await r.json();
                        setMessage(
                          r.ok ? `Saved strategy v${result.id}` : result.error,
                        );
                        router.refresh();
                      } catch {
                        setMessage("Could not save configuration");
                      }
                    }}
                  >
                    <div className="settings">
                      {Object.entries(config).map(([k, v]) => (
                        <label key={k}>
                          {k.replace(/([A-Z])/g, " $1")}
                          <input
                            type="number"
                            step="any"
                            required
                            value={String(v)}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                [k]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button className="primary">
                      Save new strategy version
                    </button>
                    <p role="status">{message}</p>
                  </form>
                </article>
              )}
            </>
          )}
          <footer>
            POLYLAB / PAPER-ONLY EXPERIMENT{" "}
            <span>
              Live market observations · No promise of predictive edge
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
function Research({ run: r }: { run: any }) {
  return (
    <details className="research">
      <summary>
        <b>{r.question}</b>
        <span>
          {pct(r.probability)} long probability · {pct(r.confidence)} confidence
          · {date(r.created_at)}
        </span>
      </summary>
      <p>{r.analysis.note}</p>
      {r.analysis.analysts?.map((a: any) => (
        <section key={a.perspective}>
          <h3>
            {a.perspective} · {pct(a.analysis.probability)}
          </h3>
          <p>
            <b>Long case:</b> {a.analysis.yesCase}
          </p>
          <p>
            <b>Short case:</b> {a.analysis.noCase}
          </p>
          <p>
            <b>Base rate:</b> {a.analysis.baseRate}
          </p>
          <p>{a.analysis.reasoning}</p>
          <ul>
            {a.analysis.sources.map((s: any) => (
              <li key={s.url}>
                <a href={s.url} rel="noreferrer" target="_blank">
                  {s.title}
                </a>{" "}
                — {s.evidence}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}
