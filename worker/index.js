// Cloudflare Worker — Proxy for Booli GraphQL + general URL fetch
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    const body = await request.json();

    // Mode 1: GraphQL proxy (body has "query" field)
    if (body.query) {
      const res = await fetch('https://www.booli.se/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.booli.se',
          'Referer': 'https://www.booli.se/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        body: JSON.stringify(body),
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Mode 2: URL fetch proxy (body has "fetchUrl" field)
    if (body.fetchUrl) {
      const res = await fetch(body.fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response('Missing "query" or "fetchUrl"', { status: 400 });
  },
};
