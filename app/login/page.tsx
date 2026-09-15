export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="login">
      <div className="wordmark">
        ◈ PolyLab <span>RESEARCH TERMINAL</span>
      </div>
      <h1>Your market laboratory.</h1>
      <p>
        Private research. Live Polymarket US data.
        <br />A $1,000 paper-trading experiment.
      </p>
      <form action="/api/login" method="post">
        <label htmlFor="password">Dashboard password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <button>Open terminal ↗</button>
        {params.error && <p role="alert">The password was not accepted.</p>}
      </form>
      <small>Paper trading only · No real-money execution</small>
    </main>
  );
}
