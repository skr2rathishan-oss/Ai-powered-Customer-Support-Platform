import { useEffect, useState } from "react";
import { fetchSystemDiagnostics, type SystemDiagnosticsData } from "../../../services/admin";

export function DiagnosticsTab() {
  const [data, setData] = useState<SystemDiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDiagnostics(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const diag = await fetchSystemDiagnostics();
      setData(diag);
    } catch (_err) {
      // Ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDiagnostics();
  }, []);

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m ${s}s`;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Card */}
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#1c1b23]">
              Infrastructure & System Telemetry
            </h3>
            <p className="text-xs text-[#787586] mt-0.5">
              Live socket connections, database latency benchmarks, and runtime heap metrics.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => loadDiagnostics(true)}
            className="px-4 py-2 rounded-xl bg-white border border-[#e2e4e9] hover:bg-[#f6f2ff] hover:text-[#6D5EF5] text-xs font-bold text-[#474555] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            <span className={`material-symbols-outlined text-sm ${refreshing ? "animate-spin" : ""}`}>
              refresh
            </span>
            {refreshing ? "Pinging Nodes…" : "Ping Systems"}
          </button>
        </div>

        {loading && !data ? (
          <div className="py-8 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            {/* Top Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#fbfbfe] border border-[#e2e4e9] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#787586] uppercase tracking-wider block">
                  System Status
                </span>
                <span className="text-base font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {data.status}
                </span>
              </div>

              <div className="bg-[#fbfbfe] border border-[#e2e4e9] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#787586] uppercase tracking-wider block">
                  Server Uptime
                </span>
                <span className="text-base font-bold text-[#1c1b23] mt-1 block">
                  {formatUptime(data.uptimeSeconds)}
                </span>
              </div>

              <div className="bg-[#fbfbfe] border border-[#e2e4e9] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#787586] uppercase tracking-wider block">
                  MySQL Latency
                </span>
                <span className="text-base font-bold text-[#6D5EF5] mt-1 block">
                  {data.databases.mysql.latencyMs} ms
                </span>
              </div>

              <div className="bg-[#fbfbfe] border border-[#e2e4e9] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#787586] uppercase tracking-wider block">
                  Memory RSS
                </span>
                <span className="text-base font-bold text-[#1c1b23] mt-1 block">
                  {data.memoryUsage.rssMb} MB
                </span>
              </div>
            </div>

            {/* Detailed Diagnostics Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* MySQL Cluster */}
              <div className="p-4 rounded-xl border border-[#e2e4e9] bg-[#fbfbfe] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1c1b23] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#6D5EF5]">
                      database
                    </span>
                    MySQL Database Pool
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    {data.databases.mysql.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-[#474555]">
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Connection Latency:</span>
                    <span className="font-mono font-semibold">{data.databases.mysql.latencyMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Active Connections:</span>
                    <span className="font-mono font-semibold">{data.databases.mysql.pool.active} / {data.databases.mysql.pool.total}</span>
                  </div>
                </div>
              </div>

              {/* MongoDB Atlas */}
              <div className="p-4 rounded-xl border border-[#e2e4e9] bg-[#fbfbfe] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1c1b23] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600">
                      dataset
                    </span>
                    MongoDB Atlas Cluster
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    {data.databases.mongodb.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-[#474555]">
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Cluster Database:</span>
                    <span className="font-mono font-semibold">{data.databases.mongodb.databaseName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Connection Driver:</span>
                    <span className="font-mono font-semibold">Mongoose / SRV</span>
                  </div>
                </div>
              </div>

              {/* Node Runtime */}
              <div className="p-4 rounded-xl border border-[#e2e4e9] bg-[#fbfbfe] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1c1b23] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-amber-600">
                      terminal
                    </span>
                    Node.js Runtime
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#1c1b23]">{data.nodeVersion}</span>
                </div>
                <div className="space-y-1.5 text-xs text-[#474555]">
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Operating System:</span>
                    <span className="font-semibold">{data.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Heap Memory Used:</span>
                    <span className="font-mono font-semibold">{data.memoryUsage.heapUsedMb} MB / {data.memoryUsage.heapTotalMb} MB</span>
                  </div>
                </div>
              </div>

              {/* Security & Cryptography */}
              <div className="p-4 rounded-xl border border-[#e2e4e9] bg-[#fbfbfe] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1c1b23] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#6D5EF5]">
                      key
                    </span>
                    Security Engine
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    Bcrypt + SHA-256
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-[#474555]">
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Hash Salt Rounds:</span>
                    <span className="font-mono font-semibold">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#787586]">Reset Token Strategy:</span>
                    <span className="font-mono font-semibold">Single-Use SHA256 Expiry</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

