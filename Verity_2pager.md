# Verity: a decision-audit layer for personal AI agents

## 1. What problem will the product solve, and why this one?

In 2040 an agent that knows you better than you know yourself decides what you buy, book and renew. I listed five consequences and ranked them by severity, likelihood, and whether a remedy already exists.

| Consequence | Severity | Likelihood | Existing remedy |
|---|---|---|---|
| Hidden influence on the agent's choices | High | High | None |
| Preference erosion (you stop forming your own) | Medium | High | None |
| Consent fatigue (approve everything, or nothing) | Medium | High | Partial |
| Unauthorized actions | High | Medium | Approval prompts |
| Data breach | High | Medium | Security rules and tooling |

**I chose hidden influence.** The agent's maker, the platforms it buys from, and advertisers all profit from what it picks. The user sees the outcome, never the alternatives dropped. This already happens through sponsored rankings, default options and inflated "discounts", but in 2040 the user has also delegated the checking, so it scales silently. It compounds: an agent that learns from accepted choices drifts toward what is easiest to sell to you. The other risks have remedies in progress. This one has none, and it decides whether people trust agents with money.

**Why Flipkart should care:** when agents do the shopping, trust in agent-made purchases decides which marketplaces win. A marketplace that can prove its agent orders were fair gains an advantage.

*Assumption to validate:* people cannot tell when an agent's pick is influenced (section 5).

## 2. Who is it for?

Digitally active urban users aged 20 to 35 who already delegate shopping, bookings and subscriptions to apps and assistants. They delegate the most and have money exposed. I chose one segment deliberately. Families and enterprise teams come later, once the core loop works. The marketplace is a second customer: it gets an audit trail and fewer disputes.

## 3. What is the product, and how does it solve the problem?

Verity is a gateway between the agent and the outside world. Before acting, the agent sends the proposed action and the alternatives it considered. Verity scores it against the user's own priorities and rules, then answers **allow, hold for approval, or block**, with reasons and a signed receipt.

| Consequence | Verity feature |
|---|---|
| Hidden influence | **Influence check:** compares the pick with the best fit for the user's priorities and flags sponsored picks, provider defaults, hidden options, margin gaps, fake discounts, pressure tactics, surge pricing, bundled add-ons, and sellers with high return or late-delivery rates |
| Opacity | **Receipt screen:** every alternative considered, who benefits, and how the risk number splits between priority mismatch and deceptive patterns |
| Preference erosion | **Your Call:** the user decides first, then sees what the agent would have chosen |
| Unauthorized actions | **Gateway rules:** per-category modes, daily caps, trusted-sellers-only, delivery and rating floors, duplicate-order guard, away mode, cooling-off, burst guard, pause per agent, expiring approvals |
| Consent fatigue | **Autopilot** for low-risk actions, bulk approval, rule suggestions from past approvals and rejections, one-tap "make it a rule" |

**How it plugs into a marketplace.** Verity is a gateway, not a new shopping app. Before an agent order is placed, the marketplace's checkout path or the agent itself calls one endpoint. A thin adapter maps the marketplace's own catalog fields into Verity's model, so ranking and catalog systems stay untouched. Calls are idempotent, rate-limited and scoped per key (categories and a maximum amount). A dry-run mode lets a cart be pre-checked without recording anything. Every live decision gets a receipt chained to the previous one, so any later edit is detectable, and held actions can notify a webhook with a signed payload.

**Cold start.** A new user can import past orders (CSV, JSON or Excel) and see how their rules would have treated them, plus unusual prices, duplicates and inflated list prices. Users also get price-history and review checks.

**What the prototype is, and is not.** It is a working demo with a real gateway, API, tests and documentation. All data is simulated, nothing connects to a real marketplace, and the review and price checks are heuristics, not trained models. A real deployment needs the marketplace's catalog fields, real authentication and a production database.

**What I cut:** voice control, social features and cross-user benchmarks. They add scope without testing the core idea.

## 4. How will I know it is working?

**North star: agreement rate**, meaning how often the agent's pick matches what the user would have chosen when deciding first. Target: 80% or more.

| Area | Metric | Target |
|---|---|---|
| Quality | Flag precision: share of flags users agree with | 75% or more |
| Outcome | Regretted purchases; money saved versus best-fit option | 5% or less |
| Trust | Users who raise an agent's autonomy after 30 days | Rising |
| Adoption | Agents connected per user; weekly reviews; imports that lead to a first rule | 2 or more agents |

**Guardrails:** median time to decide of 10 seconds or less, and a fatigue alarm if more than 90% of approvals take under 3 seconds, because that means people stopped reading. Success means users delegate **more** because they trust Verity, not because they click through.

## 5. Risks and first validation

- **Verity becomes another gatekeeper.** Scoring stays transparent and the rules belong to the user.
- **Agents must integrate.** A marketplace could require the gateway, and an open standard would follow.
- **False flags erode trust.** Flag precision is tracked from day one, with a "false alarm" button.
- **Privacy.** Verity needs purchase data. It stores only what a decision needs, lets users export or delete it, and receipts carry only item, price and verdict.
- **Sellers game the signals.** Signals combine independent evidence (price history, returns, reviews), and the rules stay private to each user.

**First tests:** (1) show 10 users the same agent pick with and without the receipt screen and compare whether they spot the sponsored option; (2) run Your Call with 20 users and measure the agreement rate; (3) ship with approvals only for flagged actions and watch the fatigue alarm.

*Prototype: [GitHub link] and demo video attached.*
