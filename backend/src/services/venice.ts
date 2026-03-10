/**
 * Venice AI video generation API.
 * @see https://docs.venice.ai/api-reference/endpoint/video/queue
 * @see https://docs.venice.ai/api-reference/endpoint/video/retrieve
 */

const VENICE_BASE = "https://api.venice.ai/api/v1";
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 120; // ~8 min

export type VeniceQueueParams = {
  model: string;
  prompt: string;
  duration: "5s" | "10s";
  image_url?: string;
  aspect_ratio?: string;
  resolution?: "480p" | "720p" | "1080p";
  negative_prompt?: string;
  audio?: boolean;
};

export type VeniceQueueResult = { model: string; queue_id: string };

export type VeniceRetrieveResult =
  | { status: "PROCESSING"; average_execution_time: number; execution_duration: number }
  | { status: "COMPLETED"; videoBuffer: Buffer };

export async function queueVideo(apiKey: string, params: VeniceQueueParams): Promise<VeniceQueueResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    duration: params.duration,
    resolution: params.resolution ?? "720p",
    aspect_ratio: params.aspect_ratio ?? "16:9",
    negative_prompt: params.negative_prompt ?? "low resolution, error, worst quality, low quality, defects",
    audio: params.audio ?? false,
  };
  if (params.image_url) body.image_url = params.image_url;

  const res = await fetch(`${VENICE_BASE}/video/queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `Venice queue failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as VeniceQueueResult;
  if (!data.queue_id || !data.model) throw new Error("Venice API did not return queue_id or model.");
  return data;
}

export async function retrieveVideo(
  apiKey: string,
  model: string,
  queueId: string
): Promise<VeniceRetrieveResult> {
  const res = await fetch(`${VENICE_BASE}/video/retrieve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, queue_id: queueId }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      return { status: "PROCESSING", average_execution_time: 0, execution_duration: 0 };
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `Venice retrieve failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("video/") || contentType.includes("application/octet-stream")) {
    const videoBuffer = Buffer.from(await res.arrayBuffer());
    return { status: "COMPLETED", videoBuffer };
  }

  const data = (await res.json()) as {
    status?: string;
    average_execution_time?: number;
    execution_duration?: number;
  };
  return {
    status: "PROCESSING",
    average_execution_time: data.average_execution_time ?? 0,
    execution_duration: data.execution_duration ?? 0,
  };
}

export async function generateVideoAndWait(
  apiKey: string,
  params: VeniceQueueParams,
  onProgress?: (msg: string) => void
): Promise<{ queue_id: string; model: string; videoBuffer: Buffer }> {
  const { model, queue_id } = await queueVideo(apiKey, params);
  onProgress?.(`Queued video (${model}). Polling for result...`);

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const result = await retrieveVideo(apiKey, model, queue_id);

    if (result.status === "COMPLETED") {
      return { queue_id, model, videoBuffer: result.videoBuffer };
    }

    onProgress?.(
      `Processing... (${Math.round((result.execution_duration || 0) / 1000)}s elapsed, ~${Math.round((result.average_execution_time || 0) / 1000)}s typical)`
    );
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Venice video generation timed out after ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s. queue_id: ${queue_id}`);
}
