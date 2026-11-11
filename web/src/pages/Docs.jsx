import { Link } from 'react-router-dom';
import { Ext, Mono, PageHead } from '../components/ui.jsx';
import { accessKeysLink, accountLink } from '../lib/links.js';
import { cfg } from '../lib/near.js';

const REPO = 'https://github.com/london160771/agentgate';
const file = (path) => `${REPO}/blob/main/${path}`;

// Rules of the public demo agent, read from config/seed.json (never hardcoded here).
const demo = cfg.agents.apiBuyer;
const allowed = demo.allowed.map((r) => cfg.recipients[r]);

/** Reason codes from PRD 6.3, in the contract's check order. */
const CODES = [
  ['OK_PAID', 'paid', 'Approved recipient, inside both caps, vault has the money.', 'Nothing. The NEAR is sent.'],
  ['HELD_RECIPIENT_NOT_APPROVED', 'held', 'The recipient is not on the agent’s approved list.', 'The owner approves or rejects it. Held requests use no budget.'],
  ['BLOCKED_HOLD_QUEUE_FULL', 'blocked', `The held queue already has ${cfg.holdQueueMax} requests.`, 'The owner clears the queue.'],
  ['BLOCKED_OVER_TX_CAP', 'blocked', 'One payment is bigger than the per-payment cap.', 'Splitting is not a workaround: the daily cap still applies. Ask the owner to raise the cap.'],
  ['BLOCKED_OVER_DAILY_CAP', 'blocked', 'This payment would take today’s total over the daily cap.', 'Try again after 00:00 UTC.'],
  ['BLOCKED_INSUFFICIENT_FUNDS', 'blocked', 'The vault can’t pay without dipping into its storage reserve.', 'The owner tops up the vault.'],
  ['BLOCKED_AGENT_INACTIVE', 'blocked', 'The agent was revoked.', 'None. The agent needs a new key.'],
  ['BLOCKED_ZERO_AMOUNT', 'blocked', 'The amount is zero.', 'Send an amount above zero.'],
];

const REFUSALS = [
  ['TRANSFER_NOT_ALLOWED', 'The agent key tried to send NEAR directly. Function Call Keys can’t attach NEAR.'],
  ['METHOD_NOT_ALLOWED', 'The agent key tried to call anything other than request_spend, e.g. update_rules.'],
  ['KEY_NOT_FOUND', 'The key was revoked, so it no longer exists on the vault account.'],
];

const METHODS = [
  ['request_spend(to, amount, reason)', 'Agent key only', 'Asks the vault to pay. Returns PAID, HELD or BLOCKED with a reason code. Never panics on a rule failure, so every attempt stays in the log.'],
  ['add_agent(public_key, name, per_tx_cap, daily_cap, allowed, allowance)', 'Owner', 'Saves the agent’s rules and mints its Function Call Key on the vault account.'],
  ['update_rules(public_key, per_tx_cap, daily_cap, allowed)', 'Owner', 'Changes an agent’s caps and approved recipients.'],
  ['revoke_agent(public_key)', 'Owner', 'Marks the agent inactive and deletes its key in the same transaction.'],
  ['approve_held(payment_id) / reject_held(payment_id)', 'Owner', 'Decides a held payment. Approval skips the caps on purpose (a human decided) but still checks the balance.'],
  ['get_stats, get_agents, get_agent, get_payments, get_held, get_owner', 'Anyone (view)', 'Read-only. This site reads everything it shows through these.'],
];

const SECTIONS = [
  ['what', 'What AgentGate is'],
  ['who', 'Who it’s for'],
  ['how', 'How it works'],
  ['decisions', 'Decisions and reason codes'],
  ['demo', 'The demo vault'],
  ['judges', 'Try to break it'],
  ['owners', 'For vault owners'],
  ['developers', 'For developers'],
  ['contract', 'Contract methods'],
  ['security', 'Security model and limits'],
  ['vision', 'Where it’s going'],
];

function Section({ id, children }) {
  const title = SECTIONS.find(([s]) => s === id)[1];
  return (
    <section id={id} className="ag-doc-section">
      <h2 className="ag-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }) {
  return (
    <div className="ag-panel ag-doc-table">
      <div className="table-responsive">
        <table className="ag-ledger">
          <thead>
            <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Stamp = ({ kind, children }) => <span className={`ag-stamp ag-stamp--${kind}`}>{children}</span>;

export default function Docs() {
  return (
    <>
      <PageHead title="Docs" aside={<Ext href={REPO} className="small">Source on GitHub</Ext>}>
        How AgentGate keeps an AI agent’s money safe, who it is for, and how to use it as a judge, an owner or a developer.
      </PageHead>

      <div className="ag-doc">
        <nav className="ag-doc-toc" aria-label="On this page">
          <div className="ag-label mb-2">On this page</div>
          <ol>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="ag-doc-body">
          <Section id="what">
            <p>
              AgentGate is a vault on NEAR for AI agents. The owner puts money in the vault, and the vault gives the agent a key that can only <em>ask</em> it to pay. The vault contract decides whether money moves. The NEAR protocol makes sure the key can’t do anything else.
            </p>
            <p>
              The idea: you can’t stop an agent from being tricked, and you can’t promise its key will never leak. <strong>But you can make sure a tricked agent, or a leaked key, can’t steal.</strong>
            </p>
            <p className="mb-0">
              It came from two real cases. Freysa, an AI agent guarding a prize pool, was talked into sending all of it. AIXBT was tricked through its dashboard into sending 55.5 ETH. In both, whoever controlled the agent’s words also controlled the money.
            </p>
          </Section>

          <Section id="who">
            <p>Anyone who wants an AI agent to spend money without handing it the wallet.</p>
            <ul className="ag-doc-list">
              <li><strong>Developers building paying agents.</strong> The agent buys API calls, data or compute. They give it a budget, not the wallet, so a tricked agent or a leaked key can only lose what the rules allow.</li>
              <li><strong>Teams behind public agents.</strong> Agents that talk to strangers and hold a prize pool or treasury will eventually be talked into something. The vault still refuses any payment that breaks the rules.</li>
              <li><strong>DAOs and small treasuries.</strong> Pay known suppliers automatically. Anything new waits for a human, and every decision is logged on chain.</li>
              <li><strong>Apps that run agents for their users.</strong> Each user’s agent gets its own limited key and caps, and it can be revoked in one transaction.</li>
              <li><strong>Security people and judges.</strong> The demo key is public, so anyone can check the claims by trying to break them.</li>
            </ul>
            <p className="small text-secondary mb-0">AgentGate runs on NEAR testnet today and handles NEAR only. These are the people it is built for, not existing customers.</p>
          </Section>

          <Section id="how">
            <ol className="ag-doc-steps">
              <li><strong>The owner funds the vault</strong> and sets each agent’s rules: a per-payment cap, a daily cap and a list of approved recipients.</li>
              <li><strong>The vault mints the agent’s key.</strong> It is a NEAR Function Call Key on the vault account that can only call <code>request_spend</code>, with a small gas allowance.</li>
              <li><strong>The agent asks to pay</strong>: <code>request_spend(to, amount, reason)</code>.</li>
              <li><strong>The vault decides</strong>: <Stamp kind="paid">PAID</Stamp> <Stamp kind="held">HELD</Stamp> or <Stamp kind="blocked">BLOCKED</Stamp>, and logs the decision on chain.</li>
              <li><strong>The owner stays in charge</strong>: approve or reject held payments, change the rules, or revoke the key in one transaction.</li>
            </ol>
            <div className="ag-panel ag-panel-pad">
              <div className="ag-label mb-1">The guarantee</div>
              <p className="mb-2">
                Money only leaves the vault to an approved recipient (or one the owner approved by hand), never more than the per-payment cap, and never more than the daily cap in a day, <strong>no matter who holds the agent key.</strong>
              </p>
              <p className="small text-secondary mb-0">
                Two parts of this are enforced by NEAR itself, not by our code: the key can’t send NEAR directly, and it can’t call any method except <code>request_spend</code>.
              </p>
            </div>
          </Section>

          <Section id="decisions">
            <p>
              Every request gets one decision and a reason code. The contract runs its checks in a fixed order: active agent, amount above zero, approved recipient, per-payment cap, daily cap (reset at 00:00 UTC), balance.
            </p>
            <Table
              head={['Code', 'Result', 'Why', 'What next']}
              rows={CODES.map(([code, kind, why, next]) => [<Mono key="c">{code}</Mono>, <Stamp key="s" kind={kind}>{kind.toUpperCase()}</Stamp>, why, next])}
            />
            <p className="mt-4">When NEAR refuses a call before it reaches the vault, this site and the scripts show it as <Stamp kind="refused">REFUSED_BY_NEAR</Stamp>:</p>
            <Table head={['Refusal', 'What happened']} rows={REFUSALS.map(([c, w]) => [<Mono key="c">{c}</Mono>, w])} />
          </Section>

          <Section id="demo">
            <p>The live demo runs on NEAR testnet. Its rules come from <Ext href={file('config/seed.json')}>config/seed.json</Ext>.</p>
            <div className="ag-panel ag-panel-pad">
              <dl className="ag-doc-facts">
                <dt>Vault</dt>
                <dd><Ext href={accountLink(cfg.vaultAccountId)}><Mono>{cfg.vaultAccountId}</Mono></Ext></dd>
                <dt>Demo agent</dt>
                <dd><Mono>{demo.name}</Mono></dd>
                <dt>Per-payment cap</dt>
                <dd>{demo.perTxCapNear} NEAR</dd>
                <dt>Daily cap</dt>
                <dd>{demo.dailyCapNear} NEAR</dd>
                <dt>Key gas allowance</dt>
                <dd>{demo.keyAllowanceNear} NEAR</dd>
                <dt>Approved recipients</dt>
                <dd>{allowed.map((a) => <div key={a}><Mono>{a}</Mono></div>)}</dd>
                <dt>Held queue limit</dt>
                <dd>{cfg.holdQueueMax} requests</dd>
                <dt>Vault lock</dt>
                <dd>The vault has no full-access key. <Ext href={accessKeysLink(cfg.vaultAccountId)}>Check its keys</Ext></dd>
              </dl>
            </div>
          </Section>

          <Section id="judges">
            <ol className="ag-doc-steps">
              <li>Open the <Link to="/judge">Attack lab</Link>. No wallet or signup needed.</li>
              <li>Press <strong>Run all</strong>. Each of the 7 attacks signs a real testnet transaction in your browser with the public agent key.</li>
              <li>Read each row: what should happen, what did happen, and the proof (an explorer link or NEAR’s own refusal).</li>
              <li>Watch the meter. Today’s total never goes past the daily cap, however often you run the salami attack.</li>
            </ol>
            <p className="mb-0">
              The key is also on the <Link to="/agents">Agents</Link> page. Use it any way you like. Every decision shows up on <Link to="/activity">Activity</Link>.
            </p>
          </Section>

          <Section id="owners">
            <ol className="ag-doc-steps">
              <li>Press <strong>Owner sign in</strong> in the navbar and sign in with MyNearWallet (testnet).</li>
              <li>If you are the vault’s owner, <Link to="/activity">Activity</Link> shows <strong>Approve</strong> and <strong>Reject</strong> next to each held payment, and <Link to="/agents">Agents</Link> shows <strong>Revoke</strong>.</li>
              <li>Each button opens your wallet to confirm the transaction. The site never gets a key of its own.</li>
            </ol>
            <p className="mb-0 small text-secondary">
              Anyone else who signs in sees no buttons, and the contract refuses non-owners anyway (<Mono>ERR_NOT_OWNER</Mono>).
            </p>
          </Section>

          <Section id="developers">
            <p>Everything the site does also runs from a terminal (Node 22.22 or newer).</p>
            <pre className="ag-doc-code">{`git clone ${REPO} && cd agentgate
cd scripts && npm install && cd ..

node scripts/attacks.js             # run all 7 attacks
node scripts/attacks.js --only=J5   # run one attack
node scripts/agent.js               # demo agent story (scripted)
node scripts/owner.js status        # owner: list held payments
node scripts/owner.js approve <id>  # owner: approve / reject / revoke`}</pre>
            <p>Add <code>--dry-run</code> to any script to print the plan without sending anything.</p>
            <ul className="ag-doc-list mb-0">
              <li><Ext href={file('contract/src/lib.rs')}>contract/src/lib.rs</Ext>: the vault contract (Rust, near-sdk).</li>
              <li><Ext href={file('scripts/lib/attacks.js')}>scripts/lib/attacks.js</Ext>: the 7 attacks, shared by the CLI and this site.</li>
              <li><Ext href={file('scripts/lib/classify.js')}>scripts/lib/classify.js</Ext>: turns NEAR errors into readable refusals.</li>
              <li><Ext href={file('README.md')}>README.md</Ext>: the story, test counts and on-chain proof.</li>
            </ul>
          </Section>

          <Section id="contract">
            <Table head={['Method', 'Who can call', 'What it does']} rows={METHODS.map(([m, who, what]) => [<Mono key="m">{m}</Mono>, who, what])} />
            <p className="small text-secondary mt-3 mb-0">
              <code>request_spend</code> and the owner methods take no deposit, because Function Call Keys can’t attach one. The agent is identified by the key that signed the call.
            </p>
          </Section>

          <Section id="security">
            <ul className="ag-doc-list mb-0">
              <li><strong>Testnet only, no audit yet.</strong> The vault is locked, so this contract can never be upgraded. A fix would need a new vault.</li>
              <li><strong>A leaked key can burn its gas allowance</strong> ({demo.keyAllowanceNear} NEAR). The agent then needs a new key.</li>
              <li><strong>A leaked key can use up the daily cap</strong>, but only by paying approved recipients. The money can’t reach the attacker.</li>
              <li><strong>The held queue can be filled with junk</strong> (max {cfg.holdQueueMax}). New unknown-recipient requests are blocked until the owner clears it.</li>
              <li><strong>AgentGate doesn’t stop prompt injection.</strong> It limits what an injected agent can do.</li>
            </ul>
          </Section>

          <Section id="vision">
            <p><strong>The goal: any AI agent can hold a budget safely, and anyone can check the rules it spends under.</strong></p>
            <ol className="ag-doc-steps">
              <li><strong>Today: Agent Firewall.</strong> One vault, contract-minted keys, caps, approved recipients, a human approval queue, a locked vault.</li>
              <li><strong>Next: mainnet and real budgets.</strong> A contract review, stablecoin budgets (USDC on NEAR), per-recipient caps and rate limits.</li>
              <li><strong>Swarm Guard.</strong> One shared budget for many agents, each with its own sub-limit.</li>
              <li><strong>Spend anywhere.</strong> NEAR Intents and Chain Signatures, so agents can pay on other chains under the same rules.</li>
              <li><strong>Agent Passport.</strong> Only agents running approved code in a TEE (NEAR Shade Agents) get a key, so a copied key gets nothing.</li>
            </ol>
            <p className="mb-0">Status of each item: <Ext href={file('ROADMAP.md')}>ROADMAP.md</Ext>.</p>
          </Section>
        </article>
      </div>
    </>
  );
}
