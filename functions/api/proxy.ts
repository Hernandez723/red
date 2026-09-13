/**
 * Cloudflare Pages Function: /api/proxy
 * 
 * Proxies HTTP requests to YouTube Music / InnerTube APIs to avoid CORS restrictions.
 * Compatible with the ProxyHttpResponse contract used by Zuno.
 */

interface ProxyRequestBody {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body_base64?: string;
  timeout_ms?: number;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, Accept",
  "Access-Control-Max-Age": "86400",
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  const { request } = context;

  try {
    const payload: ProxyRequestBody = await request.json();
    const { url, method = "GET", headers = {}, body_base64, timeout_ms = 30000 } = payload;

    if (!url) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Convert base64 body to binary buffer if present
    let body: Uint8Array | undefined;
    if (body_base64 && method !== "GET" && method !== "HEAD") {
      const binaryString = atob(body_base64);
      const len = binaryString.length;
      body = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        body[i] = binaryString.charCodeAt(i);
      }
    }

    // Prepare headers for upstream request
    const upstreamHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      // Skip headers that fetch/browser or Cloudflare manages or disallows
      if (lower === "host" || lower === "content-length") {
        continue;
      }
      upstreamHeaders.set(key, value);
    }

    // Setup abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(url, {
        method,
        headers: upstreamHeaders,
        body: body ? (body.buffer as ArrayBuffer) : undefined,
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    upstreamResponse.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    // Check for Set-Cookie header to rotate session if present
    const setCookie = upstreamResponse.headers.get("set-cookie") || undefined;

    // Convert response body to base64
    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const responseBodyBase64 = btoa(binary);

    const proxyResult = {
      status: upstreamResponse.status,
      headers: responseHeaders,
      body_base64: responseBodyBase64,
      cookie: setCookie,
    };

    return new Response(JSON.stringify(proxyResult), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        status: 502,
        headers: {},
        body_base64: btoa(JSON.stringify({ error: message })),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      },
    );
  }
}
