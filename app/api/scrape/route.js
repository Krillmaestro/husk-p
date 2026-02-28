import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const AI_PROMPT = `Extrahera lägenhetsinformation från texten nedan. Svara ENBART med JSON, inga andra tecken.

Fält att extrahera:
- addr: gatuadress (t.ex. "Storgatan 5, 3tr")
- area: stadsdel/område (t.ex. "Södermalm")
- price: pris i kronor som heltal (t.ex. 3500000), null om saknas
- sqm: boarea i m² som tal (t.ex. 75), null om saknas
- rooms: antal rum som tal (t.ex. 3), null om saknas
- floor: våning som text (t.ex. "2 av 5"), tom sträng om saknas
- fee: månadsavgift i kronor som heltal (t.ex. 4500), null om saknas
- hiss: 1 om hiss finns, 0 om inte eller okänt
- note: kort sammanfattning av annonstexten (max 200 tecken)

Text:
`;

const BOOLI_GQL_BY_LISTING = `query ($id: Int!) {
  propertyByListingId(listingId: $id) {
    streetAddress
    descriptiveAreaName
    objectType
    livingArea { raw }
    rooms { raw }
    rent { raw }
    ... on Residence {
      listPrice { raw }
      soldPrice { raw }
      floor { raw value }
    }
    ... on ResidenceWithSoldProperty {
      soldPrice { raw }
      listPrice { raw }
    }
  }
}`;

const BOOLI_GQL_BY_RESIDENCE = `query ($id: Int!) {
  propertyByResidenceId(residenceId: $id) {
    streetAddress
    descriptiveAreaName
    objectType
    livingArea { raw }
    rooms { raw }
    rent { raw }
    ... on Residence {
      listPrice { raw }
      soldPrice { raw }
      floor { raw value }
    }
    ... on ResidenceWithSoldProperty {
      soldPrice { raw }
      listPrice { raw }
    }
  }
}`;

// Extract Booli ID and type from URL
function parseBooliUrl(url) {
  const annonsMatch = url.match(/\/annons\/(\d+)/);
  if (annonsMatch) return { type: 'listing', id: parseInt(annonsMatch[1]) };

  const bostadMatch = url.match(/\/bostad\/(\d+)/);
  if (bostadMatch) return { type: 'residence', id: parseInt(bostadMatch[1]) };

  return null;
}

// Fetch apartment data from Booli's GraphQL API (bypasses bot detection)
async function fetchBooliGraphQL({ type, id }) {
  const query = type === 'listing' ? BOOLI_GQL_BY_LISTING : BOOLI_GQL_BY_RESIDENCE;
  const dataKey = type === 'listing' ? 'propertyByListingId' : 'propertyByResidenceId';

  const res = await fetch('https://www.booli.se/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://www.booli.se',
    },
    body: JSON.stringify({
      query,
      variables: { id },
    }),
  });

  const json = await res.json();
  const p = json?.data?.[dataKey];
  if (!p) return null;

  return {
    addr: p.streetAddress || '',
    area: p.descriptiveAreaName || '',
    price: p.listPrice?.raw || p.soldPrice?.raw || null,
    sqm: p.livingArea?.raw || null,
    rooms: p.rooms?.raw || null,
    floor: p.floor?.value || '',
    fee: p.rent?.raw || null,
    hiss: 0,
    note: '',
  };
}

function parseAiResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

function formatResult(data, url = '') {
  return {
    addr: data.addr || '',
    area: data.area || '',
    price: data.price || '',
    sqm: data.sqm || '',
    rooms: data.rooms || '',
    floor: data.floor || '',
    fee: data.fee || '',
    hiss: data.hiss ? 1 : 0,
    note: data.note || '',
    url: url,
  };
}

export async function POST(req) {
  try {
    const { url, pastedText } = await req.json();

    // Mode 2: User pasted listing text directly (fallback)
    if (pastedText) {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: AI_PROMPT + pastedText.slice(0, 15000) }],
      });

      const data = parseAiResponse(message.content[0].text.trim());
      if (!data) {
        return Response.json({ error: 'Kunde inte tolka texten — försök klistra in mer info' }, { status: 500 });
      }
      return Response.json(formatResult(data, url || ''));
    }

    // Mode 1: Fetch URL
    if (!url) {
      return Response.json({ error: 'Ange en giltig länk' }, { status: 400 });
    }

    // Booli: use GraphQL API directly (bypasses bot detection completely)
    if (url.includes('booli.se')) {
      const parsed = parseBooliUrl(url);
      if (!parsed) {
        return Response.json({ error: 'Ange en Booli-länk med /annons/ eller /bostad/' }, { status: 400 });
      }

      const data = await fetchBooliGraphQL(parsed);
      if (!data) {
        return Response.json({ error: 'Kunde inte hämta data från Booli', showPasteFallback: true }, { status: 502 });
      }

      return Response.json(formatResult(data, url));
    }

    // Hemnet & others: fetch HTML + AI parsing
    if (url.includes('hemnet.se') || url.includes('http')) {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      if (!res.ok) {
        return Response.json({
          error: `Kunde inte hämta sidan (${res.status})`,
          showPasteFallback: true,
        }, { status: 502 });
      }

      const html = await res.text();
      const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/\s{2,}/g, ' ')
        .slice(0, 30000);

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: AI_PROMPT + cleaned }],
      });

      const data = parseAiResponse(message.content[0].text.trim());
      if (!data) {
        return Response.json({ error: 'Kunde inte tolka svaret från AI' }, { status: 500 });
      }

      return Response.json(formatResult(data, url));
    }

    return Response.json({ error: 'Ange en giltig Booli- eller Hemnet-länk' }, { status: 400 });
  } catch (err) {
    console.error('Scrape error:', err);
    return Response.json({ error: 'Något gick fel vid hämtning' }, { status: 500 });
  }
}
