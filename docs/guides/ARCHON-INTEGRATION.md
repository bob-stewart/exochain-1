# ExoForge Integration Guide

## Overview

[ExoForge](https://github.com/bob-stewart/exoforge) (based on [Archon](https://github.com/bob-stewart/remote-coding-agent)) is the autonomous implementation engine for ExoChain. It establishes a perpetual self-improvement cycle governed by the AI-IRB council of five panels across five disciplines.

ExoForge is not just a code generator — it is a governance-conditioned execution pipeline. Every artifact it produces passes through constitutional validation (8 invariants, 10 TNC controls) before it can be merged.

## The Self-Improvement Cycle

```
Widget AI Help Feedback
    |
    v
[1] exochain-investigate-feedback  (Triage)
    |
    v
[2] exochain-council-review  (AI-IRB 5-Panel Review)
    |
    ├── Approved ──> [3] exochain-generate-syntaxis  (Workflow Design)
    |                     |
    |                     v
    |                [4] exochain-implement-feature  (Full-Stack Implementation)
    |                     |
    |                     v
    |                [5] exochain-validate-constitution  (Governance Gate)
    |                     |
    |                     ├── PASS ──> [6] archon-finalize-pr  (Deploy)
    |                     └── FAIL ──> [7] Remediation ──> Re-validate
    |
    ├── Rejected ──> Feedback to UI with rationale
    ├── Deferred ──> Backlog (re-evaluate next cycle)
    └── Amend ──> Re-investigate with council conditions
```

## Setup

### Prerequisites

- Bun 1.1+ (runtime for ExoForge)
- Claude API key or Claude Code global auth
- Git with SSH/HTTPS access to exochain/exochain

### Installation

```bash
# Clone ExoForge
git clone https://github.com/bob-stewart/exoforge.git
cd exoforge

# Install dependencies
bun install

# Configure (uses Claude Code global auth by default)
archon setup

# Verify ExoChain commands are loaded
archon workflow list
```

You should see the ExoChain workflows:
```
exochain-self-improvement-cycle   DAG   Perpetual self-improvement pipeline
exochain-client-onboarding        DAG   Client requirements to deployed config
exochain-fix-issue-dag            DAG   GitHub issue to governed PR
exochain-continuous-governance    Loop  Constitutional drift monitoring
```

### Configuration

ExoForge reads configuration from `.archon/config.yaml`:

```yaml
assistant: claude
commands:
  folder: .archon/commands
  autoLoad: true
defaults:
  loadDefaultCommands: true    # Include 36 default Archon commands
  loadDefaultWorkflows: true   # Include 15 default Archon workflows
```

ExoChain-specific commands are in `.archon/commands/exochain/` and workflows in `.archon/workflows/exochain/`.

## Commands (7)

| Command | Purpose |
|---------|---------|
| `exochain-investigate-feedback` | Classify and triage feedback from UI widget AI help menus |
| `exochain-council-review` | AI-IRB five-panel review (Governance, Legal, Architecture, Security, Operations) |
| `exochain-generate-syntaxis` | Generate Syntaxis workflows from 23 node types |
| `exochain-generate-prd` | Client onboarding — translate business requirements to ExoChain PRD |
| `exochain-implement-feature` | Full-stack implementation (Rust/WASM/Node.js/React/SQL) |
| `exochain-fix-bug` | Root cause analysis and fix across the stack |
| `exochain-validate-constitution` | Governance gate — 8 invariants, 10 TNC controls |

## Workflows (4)

### Self-Improvement Cycle (DAG)

The primary workflow. Triggered by feedback from the Configurator UI.

```bash
archon workflow run exochain-self-improvement-cycle \
  '{"feedback": "BCTS transitions should animate in real-time", "widget": "bcts-machine", "page": "dashboard"}'
```

DAG nodes: `ingest-feedback → council-review → generate-syntaxis → implement → validate-constitution → create-pr`

### Client Onboarding (DAG)

End-to-end client configuration from requirements to deployment.

```bash
archon workflow run exochain-client-onboarding \
  '{"client": "ACME Corp", "requirements": "Board governance with GDPR consent and fiduciary audit"}'
```

### Fix Issue (DAG)

GitHub issue to constitutionally-validated PR.

```bash
archon workflow run exochain-fix-issue-dag '#42'
```

### Continuous Governance (Loop)

Perpetual loop scanning for constitutional drift. Runs up to 25 iterations.

```bash
archon workflow run exochain-continuous-governance
```

## Five-by-Five Discipline Matrix

Each artifact is reviewed across 5 panels and 5 properties (from the Decision Object axioms):

|  | Storable | Diffable | Transferable | Auditable | Contestable |
|--|----------|----------|--------------|-----------|-------------|
| **Governance** | Resolution serialized | Version-tracked | Authority chain | HLC timestamps | Challenge mechanism |
| **Legal** | Court-admissible | Evidence diff | Jurisdiction transfer | Provenance chain | Contestation period |
| **Architecture** | CBOR canonical | Merkle root | DID-based | Receipt chain | State rollback |
| **Security** | Encrypted at rest | Tamper-evident | Delegation-scoped | Invariant log | Escalation path |
| **Operations** | Backup-ready | Rollback-safe | Multi-tenant | Health metrics | Incident response |

## Integration with ExoChain Configurator UI

Every widget in the React UI has an embedded AI help menu (`?` trigger). When users interact with these menus — asking questions, suggesting improvements, or reporting issues — the feedback is captured and dispatched to the gateway-api:

```
POST /api/feedback
{
  "widget": "bcts-machine",
  "page": "dashboard",
  "type": "suggestion",
  "message": "Add real-time state transition animation",
  "context": { "current_state": "Deliberated", "user_action": "clicked_state" }
}
```

The gateway-api:
1. Assigns a feedback ID and Blake3 hash (provenance)
2. Stores the item in the backlog (`GET /api/backlog`)
3. Marks it for ExoForge dispatch (`exochain-self-improvement-cycle`)

The council backlog widget in the UI shows all items with their review status, votes, and disposition.

## Governance Gate

Every ExoForge-generated PR must pass `exochain-validate-constitution`:

### 8 Constitutional Invariants
1. DemocraticLegitimacy
2. DelegationGovernance
3. DualControl
4. HumanOversight
5. TransparencyAccountability
6. ConflictAdjudication
7. TechnologicalHumility
8. ExistentialSafeguard

### 10 Trust-Critical Non-Negotiable Controls
TNC-01 through TNC-10: authority chain, human gate, consent, identity, delegation expiry, constitutional binding, quorum, terminal immutability, AI ceiling, evidence bundle.

### Architectural Compliance
- No floating-point arithmetic
- CBOR canonical serialization
- Approved crypto primitives only (Blake3, Ed25519)
- WASM compatibility maintained

If validation fails, the workflow routes to remediation and re-validates. Only constitutionally-compliant code reaches the PR stage.

## Deploying for Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for full production deployment instructions including Docker, Nginx, SSL, and systemd configuration.

For ExoForge, run it as a background service:

```bash
# Start ExoForge server (handles webhook triggers)
cd /path/to/exoforge
bun run dev:server

# Or via systemd
sudo systemctl start exoforge
```

Configure the ExoChain gateway-api to dispatch to ExoForge by setting:

```
EXOFORGE_URL=http://localhost:4000
```
