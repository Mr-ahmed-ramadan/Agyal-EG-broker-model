import { useLoad, when } from '../useLoad';

interface Client {
  id: string;
  fullNameEn: string | null;
  status: string;
  riskRating: string | null;
  riskProfile: string | null;
  depositReference: string;
  createdAt: string;
  investorCode: { status: string; code: string | null } | null;
  custodyAccounts: { depository: string; accountNumber: string }[];
}

export function ClientsScreen() {
  const { data, error } = useLoad<Client[]>('/broker/clients');
  return (
    <section>
      <h2>Clients</h2>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr><th>Name</th><th>Status</th><th>AML</th><th>Profile</th><th>Unified code</th><th>Custody</th><th>Deposit ref</th><th>Joined</th></tr>
        </thead>
        <tbody>
          {data?.map((c) => (
            <tr key={c.id}>
              <td>{c.fullNameEn}</td>
              <td>{c.status}</td>
              <td>{c.riskRating ?? '-'}</td>
              <td>{c.riskProfile ?? '-'}</td>
              <td>{c.investorCode?.code ?? '-'} <span className="muted">{c.investorCode?.status}</span></td>
              <td>{c.custodyAccounts.map((a) => a.depository).join(', ') || '-'}</td>
              <td className="mono">{c.depositReference}</td>
              <td>{when(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
