import { useState, useCallback } from "react";

const ADMIN_KEY = "cant-hold-it-seed";
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts?: RequestInit) {
  const sep = path.includes("?") ? "&" : "?";
  return fetch(`${API_BASE}${path}${sep}key=${ADMIN_KEY}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
}

interface AdminStop {
  id: number;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  overall_rating: number | null;
  total_ratings: number;
  created_at: string;
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [stops, setStops] = useState<AdminStop[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<Set<number>>(new Set());

  const loadStops = useCallback(async (s?: string, p?: number) => {
    setLoading(true);
    setMessage("");
    const q = s ?? search;
    const pg = p ?? page;
    try {
      const res = await api(`/api/admin/stops?search=${encodeURIComponent(q)}&page=${pg}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setStops(data.stops);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
    setLoading(false);
  }, [search, page]);

  const deleteStop = useCallback(async (id: number) => {
    if (!confirm(`Delete stop #${id}? This cannot be undone.`)) return;
    setDeleting((prev) => new Set(prev).add(id));
    try {
      const res = await api(`/api/admin/stops/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setStops((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
      setMessage(`Deleted stop #${id}`);
    } catch (e: any) {
      setMessage(`Error deleting #${id}: ${e.message}`);
    }
    setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const runCleanup = useCallback(async () => {
    if (!confirm("Run cleanup? This removes French-Canadian placeholders and fixes bad data.")) return;
    setLoading(true);
    try {
      const res = await api("/api/admin/cleanup-placeholders", { method: "POST" });
      const data = await res.json();
      setMessage(`Cleanup: removed ${data.deletedPlaceholders} placeholders. Total stops: ${data.totalStops}`);
      loadStops();
    } catch (e: any) {
      setMessage(`Cleanup error: ${e.message}`);
    }
    setLoading(false);
  }, [loadStops]);

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Admin Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (password === ADMIN_KEY) { setAuthed(true); } else { setMessage("Wrong password"); } }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
          />
          <button type="submit" style={{ width: "100%", padding: "10px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Login
          </button>
          {message && <p style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>{message}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 12px", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>🔧 Admin — Stops Manager</h1>
        <button onClick={runCleanup} disabled={loading} style={{ padding: "8px 16px", background: "#f59e0b", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          Run Cleanup
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") loadStops(search, 1); }}
          placeholder="Search by name or address..."
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
        />
        <button onClick={() => loadStops(search, 1)} disabled={loading} style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {message && (
        <div style={{ padding: "8px 12px", background: message.startsWith("Error") ? "#fef2f2" : "#f0fdf4", border: `1px solid ${message.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {message}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
        {total > 0 ? `${total} stops found · Page ${page}/${totalPages}` : stops.length === 0 && !loading ? 'Click "Search" to load stops' : ""}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: "8px 6px" }}>ID</th>
              <th style={{ padding: "8px 6px" }}>Name</th>
              <th style={{ padding: "8px 6px" }}>Type</th>
              <th style={{ padding: "8px 6px" }}>Address</th>
              <th style={{ padding: "8px 6px" }}>Lat/Lng</th>
              <th style={{ padding: "8px 6px" }}>Rating</th>
              <th style={{ padding: "8px 6px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "6px" }}>{s.id}</td>
                <td style={{ padding: "6px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</td>
                <td style={{ padding: "6px" }}><span style={{ padding: "2px 6px", background: s.type === "rest_area" ? "#dbeafe" : s.type === "truck_stop" ? "#fef3c7" : s.type === "gas_station" ? "#d1fae5" : "#f1f5f9", borderRadius: 4, fontSize: 11 }}>{s.type}</span></td>
                <td style={{ padding: "6px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "#64748b" }}>{s.address}</td>
                <td style={{ padding: "6px", fontSize: 11, color: "#94a3b8" }}>{Number(s.lat).toFixed(3)}, {Number(s.lng).toFixed(3)}</td>
                <td style={{ padding: "6px" }}>{s.overall_rating !== null ? `${Number(s.overall_rating).toFixed(1)} ⭐ (${s.total_ratings})` : "—"}</td>
                <td style={{ padding: "6px" }}>
                  <button
                    onClick={() => deleteStop(s.id)}
                    disabled={deleting.has(s.id)}
                    style={{ padding: "4px 10px", background: deleting.has(s.id) ? "#fca5a5" : "#ef4444", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 11 }}
                  >
                    {deleting.has(s.id) ? "..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button disabled={page <= 1} onClick={() => loadStops(search, page - 1)} style={{ padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 6, cursor: page <= 1 ? "default" : "pointer", background: "white" }}>
            ← Prev
          </button>
          <span style={{ padding: "6px 10px", fontSize: 13 }}>Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => loadStops(search, page + 1)} style={{ padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 6, cursor: page >= totalPages ? "default" : "pointer", background: "white" }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
