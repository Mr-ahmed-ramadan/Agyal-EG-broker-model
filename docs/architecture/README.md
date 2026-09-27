# Architecture Decision Records

Each ADR records one decision: the context, what was decided, and the
consequences. Read them before making structural changes; supersede an ADR
with a new one rather than rewriting history.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-product-scope-and-regulatory-posture.md) | Product scope & regulatory posture (Agyal = tech provider, broker = licensed) | Accepted |
| [0002](0002-multi-tenancy-and-white-label.md) | Multi-tenancy & white-label | Accepted |
| [0003](0003-fix-native-order-model.md) | FIX-native order model (RFQ, one order per client) | Accepted |
| [0004](0004-bank-connectivity.md) | Bank connectivity: QuickFIX/J gateway, portal & file adapters | Accepted |
| [0005](0005-client-onboarding-ekyc-aml.md) | Client onboarding: eKYC, AML, suitability, broker approval | Accepted |
| [0006](0006-mcdr-unified-code-and-custody.md) | MCDR unified code & custody linkage | Proposed |
| [0007](0007-broker-ledger-and-reconciliation.md) | Broker ledger, client money & reconciliation | Accepted |
| [0008](0008-pricing-and-fee-disclosure.md) | Pricing, broker markup & fee disclosure | Accepted |
| [0009](0009-commercial-model-and-billing.md) | Commercial model & billing | Proposed |
| [0010](0010-tech-stack-and-deployment.md) | Tech stack, security & deployment | Accepted |

Unresolved questions that affect these decisions are tracked in
[`open-questions.md`](open-questions.md).

Use [`template.md`](template.md) for new ADRs.
