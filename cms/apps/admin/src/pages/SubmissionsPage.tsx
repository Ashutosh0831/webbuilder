import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function SubmissionsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!siteId) return;
    api<{ submissions: any[] }>(`/api/admin/sites/${siteId}/submissions`).then(
      (r) => setItems(r.submissions)
    );
  }, [siteId]);

  return (
    <div>
      <h1>Form submissions</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.createdAt).toLocaleString()}</td>
              <td><span className="badge">{s.status}</span></td>
              <td>
                <pre style={{ margin: 0, fontSize: 12 }}>
                  {JSON.stringify(s.data, null, 2)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}