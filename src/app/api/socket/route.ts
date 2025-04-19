import { NextRequest } from 'next/server';

// This API route is likely not needed if you run a standalone Socket.IO server.
// You can remove this file or keep a minimal handler.

export async function GET(req: NextRequest) {
    // Indicate that the main WebSocket server runs separately.
    return new Response('Socket.IO server runs as a separate process.', { status: 200 });
}

// Keep these if deploying to Vercel edge or similar, otherwise remove.
// export const dynamic = 'force-dynamic';
// export const runtime = 'nodejs';