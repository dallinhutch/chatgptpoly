# Recommended for you

The private dashboard reads immutable RECOMMENDATION_CREATED audit events. Qualified research is checked against the same evidence, liquidity, sizing, correlation and drawdown gates as paper execution before a recommendation is recorded. This evaluation does not place an order or change cash. It can operate during an authorized research run with paper execution disabled.

Additional recommendation filters: win probability >=80%, analysis confidence >=80%, return if correct >=25%, expected return >=10%, after the existing conservative fee reserve. Only main moneyline/futures markets qualify; API presence does not establish availability in an individual user's app/account.

The original timestamp is retained; the page refreshes server data every 30 seconds and updates recommendation age locally. Recommendations expire after five minutes or when the authorized run is inactive. An expired card shows its historical suggested paper amount and cannot be treated as a fresh quote. Values are based on observed order-book depth and the simulated bankroll, not the user's real finances. Actual fees may differ.

Return if correct = (shares - total simulated entry cost) / total entry cost.
Expected return = (estimated win probability * shares - total entry cost) / total entry cost.
Maximum loss = total entry cost. Suggested allocation includes the fee reserve and obeys existing portfolio limits.

No prior weak candidates are seeded. This feature does not restart paid research or extend an expired trading window.
