# How We'll Measure the Agent Economy

*Draft — dev.to / Quinn's Conveyance blog. Replaces the premature "State of Agent Payments" data report.*

---

The x402 ecosystem has a counting problem.

By Q3 2026 there were 138 million cumulative x402 transactions on Base, and 87% of them were under $0.10. Depending on who you ask, that's either the birth of the agent economy or the world's most efficient wash-trading machine. TRM Labs estimates only 0.6–7.5% of x402 value is genuinely agentic. The honest answer: nobody knows, because almost everyone is counting the wrong thing.

Transactions are easy to count. Commerce is not. A settlement on-chain tells you a wallet paid. It doesn't tell you whether an agent needed something, got a price, decided to pay, and received value — or whether a script is farming volume in a loop.

We run x402 implementations for API businesses. Here's the measurement stack we install on every deployment, and what each layer actually proves.

## 1. The funnel, not the total

Every paid endpoint serves far more 402 challenges than settlements. That ratio is the business:

- **Challenges served** — an agent (or a bot, or a curious human with curl) hit the price wall.
- **Settlements** — a wallet signed and paid.
- **Conversion rate** — settlements ÷ challenges. This is the single most honest number in agent commerce. A healthy paid endpoint converts a meaningful fraction of its challenges. A wash-traded one converts ~100% of challenges from a handful of wallets, instantly, around the clock.

If someone shows you settlement volume without the challenge count behind it, they're showing you the numerator and hiding the denominator.

## 2. Wallet persistence

Agents that do real work come back. We track payer wallets over time: first seen, calls per wallet, repeat rate. Real demand has a long tail of wallets with human-shaped usage patterns — bursts during work hours, topic drift, price sensitivity. Manufactured volume has a short head of wallets with metronome timing.

Wallet identity is also what makes agent commerce different from the API-key era: the payer is pseudonymous but persistent, so reputation can accumulate without an account ever being created.

## 3. Latency and failure shape

We record challenge-to-settlement time on every call. Real agent clients take measurable time to evaluate a price and sign (our own test client: ~1.2 seconds). Sub-100ms challenge-to-settlement at scale is a signature worth investigating, not celebrating.

Failures matter too: expired authorizations, insufficient funds, signature mismatches. A deployment with zero failures isn't well-run — it's not being used by anyone new.

## 4. Verification status on every settlement

A settlement is a claim. We verify each one independently — signature recovery, on-chain nonce consumption, transfer-log match against the authorization, block timing — and store a status next to every payment: **verified, failed, or unverified** (with the reason). Fail-open, but loud: if the verifier is down, the payment still lands, but it's marked unverified forever. Directories and facilitators that report volume without a verification column are reporting claims, not facts.

## What we'll publish, and when

When our deployments have enough real traffic, we'll publish the aggregate numbers: conversion rates, repeat-wallet share, median settlement latency, verification outcomes — per category, never per client, and never the underlying customer data. That data belongs to the businesses that earned it; we sell implementation and operations, not our customers' information.

Until the volume is real, we'd rather publish the ruler than a fake measurement.

— John O'Malley, Quinn's Conveyance
*We put APIs behind HTTP 402 and keep them running: quinnsconveyance.com*
