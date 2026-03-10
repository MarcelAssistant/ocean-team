import { useState, useEffect } from "react";
import { api } from "../api";
import { Card, PageTitle, EmptyState } from "../components/ui";

export default function Videos() {
  const [files, setFiles] = useState<{ name: string; size: number; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getFiles()
      .then((r) => {
        const videos = (r.files || []).filter((f: any) =>
          f.name.toLowerCase().endsWith(".mp4") && (f.name.startsWith("generated-") || f.name.startsWith("test-"))
        );
        videos.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFiles(videos);
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const videos = files;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <PageTitle>Videos</PageTitle>
        <button onClick={load} className="text-xs" style={{ color: "var(--accent)" }}>Refresh</button>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Generated videos from Venice AI Wan 2.6. Test video from Settings → Video, or production videos from agent runs.
      </p>

      {loading && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading...</p>}
      {!loading && videos.length === 0 && (
        <Card>
          <EmptyState>
            No videos yet. Generate a test video in Settings → Connections → Video, or ask the Production Agent to create a video.
          </EmptyState>
        </Card>
      )}
      {!loading && videos.length > 0 && (
        <div className="space-y-4">
          {videos.map((f) => (
            <Card key={f.name}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {(f.size / 1024 / 1024).toFixed(2)} MB · {new Date(f.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)", background: "#000" }}>
                    <video
                      src={`/api/files/${f.name}`}
                      controls
                      className="w-full max-h-[50vh]"
                    />
                  </div>
                  <a href={`/api/files/${f.name}`} download className="text-[10px] mt-1 block" style={{ color: "var(--accent)" }}>
                    Download
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
