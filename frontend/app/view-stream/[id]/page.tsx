/**
 * Public stream preview page — Server Component with ISR.
 *
 * Issue #459 — Edge-Caching for Static Assets
 *
 * revalidate = 60  →  Next.js regenerates this page at most once per minute.
 * Between regenerations the cached HTML is served instantly from the CDN edge,
 * giving users in high-latency regions (Africa, SE Asia) sub-100ms TTFB.
 *
 * Interactive parts (live counter, animations) live in ViewStreamClient which
 * is hydrated on the client after the static shell is delivered.
 */

import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import {
  ViewStreamClient,
  type StreamData,
} from "@/components/view-stream-client";

// ─── ISR revalidation interval ────────────────────────────────────────────────
// The page HTML is cached at the CDN edge and regenerated in the background
// at most once every 60 seconds (stale-while-revalidate pattern).
export const revalidate = 60;

// ─── Static params ────────────────────────────────────────────────────────────
// Pre-render the most-visited stream IDs at build time so the very first
// request for those pages is served from the CDN with zero cold-start latency.
// Add real IDs here or fetch them from the API at build time.
export async function generateStaticParams() {
  // In production, replace with: const ids = await fetchTopStreamIds();
  const ids: string[] = [];
  return ids.map((id) => ({ id }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const stream = await fetchStreamData(id);

  if (!stream) {
    return { title: "Stream Not Found — StellarStream" };
  }

  return {
    title: `${stream.name} — StellarStream`,
    description: `Live payment stream: ${stream.totalAmount.toLocaleString()} ${stream.token} streamed on-chain.`,
    openGraph: {
      title: stream.name,
      description: `${stream.ratePerSecond.toFixed(5)} ${stream.token}/sec · ${stream.status}`,
      siteName: "StellarStream",
    },
  };
}

// ─── Data fetching ────────────────────────────────────────────────────────────
// Runs on the server at build time (generateStaticParams) and during ISR
// background regeneration. Replace the mock with a real API/RPC call.

async function fetchStreamData(id: string): Promise<StreamData | null> {
  // Production: const res = await fetch(`${process.env.API_URL}/streams/${id}`, { next: { revalidate: 60 } });
  // if (!res.ok) return null;
  // return res.json();

  // ── Mock ──────────────────────────────────────────────────────────────────
  if (!id) return null;

  return {
    id,
    name: "DAO Treasury → Dev Fund",
    token: "USDC",
    status: "active",
    totalAmount: 120_000,
    streamed: 37_500,
    ratePerSecond: 0.03858,
    sender: "GDAO1...3A2F",
    receiver: "GDEV9...7BC1",
    startTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 48).toISOString(),
    apy: 0.08,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ViewStreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stream = await fetchStreamData(id);

  if (!stream) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-16 w-16 text-red-500/50" />
        <h1 className="font-heading text-2xl font-bold text-white">
          Stream Not Found
        </h1>
        <p className="font-body text-sm text-white/40">
          The stream you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <a
          href="/"
          className="mt-4 rounded-xl border border-[#00f5ff]/30 bg-[#00f5ff]/10 px-6 py-3 font-body text-sm text-[#00f5ff] transition-colors hover:bg-[#00f5ff]/20"
        >
          Go to Homepage
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center p-6 pt-12">
      {/* Static shell rendered on the server — hydrated by ViewStreamClient */}
      <ViewStreamClient stream={stream} />
    </div>
  );
}
