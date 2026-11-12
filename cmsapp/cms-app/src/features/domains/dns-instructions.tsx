export function DnsInstructions({ domain, token }: { domain: string; token: string }) {
  const platformCname = process.env.NEXT_PUBLIC_PLATFORM_CNAME;
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">DNS Configuration</h3>
      <p className="text-sm text-muted-foreground">
        Add these records at your DNS provider. Verification may take a few minutes.
      </p>
      <table className="w-full text-sm">
        <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
        <tbody>
          <tr>
            <td>TXT</td>
            <td><code>_cms-verify.{domain}</code></td>
            <td><code>{token}</code></td>
          </tr>
          <tr>
            <td>CNAME</td>
            <td><code>{domain}</code></td>
            <td><code>{platformCname}</code></td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        For root domains (example.com), use an ALIAS/ANAME record instead of CNAME if your provider supports it.
      </p>
    </div>
  );
}