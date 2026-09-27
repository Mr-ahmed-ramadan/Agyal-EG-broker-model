# Open Questions

Questions that block or could change a decision. Each has an owner type and
the ADR it affects. Move answered questions into the relevant ADR.

## Regulatory / legal

| # | Question | Ask | Affects |
| --- | --- | --- | --- |
| L1 | Does the FRA need to approve or be notified of a broker outsourcing its client channel, OMS and books-and-records to a SaaS provider? What are the conditions (audit rights, exit plan, data location)? | FRA / counsel | 0001, 0010 |
| L2 | Is a usage-based technology fee (bps of nominal traded) from an unlicensed provider to a broker acceptable, and must it be disclosed to clients? | Counsel | 0009 |
| L3 | Which FRA decrees govern digital onboarding / e-KYC and e-signature for brokerage clients, and what evidence must be retained (liveness video, images, timestamps)? | Broker compliance / FRA | 0005 |
| L4 | Must the broker's markup be disclosed to the client, or only commission and fees? | Counsel / FRA | 0008 |
| L5 | Data residency: must personal data and books and records be hosted in Egypt, and which cloud providers are acceptable? | Counsel / FRA / brokers | 0010 |
| L6 | What tax is withheld on coupons and T-bill returns for each client type (individual/corporate, resident/non-resident), and who withholds it (issuer, bank, broker)? The platform applies a per-broker tax rate by paper type (default 20% of the interest: coupons, and a T-bill's discount at maturity from the client's average buy price) and shows it as an estimate. Confirm the rates, whether the broker or the issuer/bank withholds, and the treatment of accrued interest and bond price gains. | Tax adviser | 0007 |

## Market infrastructure

| # | Question | Ask | Affects |
| --- | --- | --- | --- |
| M1 | Where are T-bills held for retail clients of a broker: MCDR, CBE registry via a bank custodian, or bank-internal? Is a unified code enough, or is a bank custody account also required? | MCDR / partner banks | 0006, 0003 |
| M2 | Who submits unified-code requests (broker, custodian), through what channel (portal, API, paper), and what is the turnaround time? | MCDR / brokers | 0006 |
| M3 | How is an existing unified code (from another broker) verified and linked to a new custodian account? | MCDR | 0006 |
| M4 | Are target brokers custodians themselves, or do they use bank custodians? | Brokers | 0006, 0007 |
| M5 | Settlement conventions (T+0/T+1/T+2) for T-bonds, T-bills and corporate bonds/sukuk traded OTC with banks. | Banks | 0007 |
| M6 | How do banks handle primary T-bill auction subscriptions for a broker's clients (competitive/non-competitive, cut-off times, allotment reporting)? | Banks | 0003 |

## Banks

| # | Question | Ask | Affects |
| --- | --- | --- | --- |
| B1 | Which partner banks' fixed-income desks can support a FIX session (version, RFQ support, connectivity: internet TLS vs VPN/leased line)? | Banks | 0004 |
| B2 | Will banks accept one FIX session per broker or one platform session with the broker identified in `Parties`? | Banks | 0004 |
| B3 | Do banks provide indicative price feeds for browsing, or only firm quotes on RFQ? | Banks | 0008 |
| B4 | Can brokers' segregated client-money banks provide statements via API/SFTP, or virtual IBANs per client? | Banks / brokers | 0007 |

## Product / commercial

| # | Question | Ask | Affects |
| --- | --- | --- | --- |
| P1 | Preferred eKYC and AML screening vendors (brokers may have existing contracts). | Brokers | 0005 |
| P2 | Growth-tier fee level, monthly minimum and ramp-up length. | Agyal | 0009 |
| P3 | Do brokers need to see all bank quotes to the client, or only the best? | Brokers | 0008 |
| P4 | Which Egyptian SMS gateway (codes go by email in the hosted demo)? | Agyal / brokers | 0010 |
