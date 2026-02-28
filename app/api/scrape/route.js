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

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// Parse Booli's __NEXT_DATA__ Apollo cache directly — no AI needed
function parseBooliNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;

  try {
    const nextData = JSON.parse(match[1]);
    const apollo = nextData?.props?.pageProps?.__APOLLO_STATE__;
    if (!apollo) return null;

    // Find the residence object
    let residence = null;
    for (const val of Object.values(apollo)) {
      if (val?.__typename && (
        val.__typename === 'ResidenceForSale' ||
        val.__typename === 'ResidenceWithSoldProperty' ||
        val.__typename === 'Residence'
      )) {
        residence = val;
        break;
      }
    }
    if (!residence) return null;

    // Find the most specific area name (userDefined or municipality)
    let area = '';
    if (residence.primaryArea?.name) {
      area = residence.primaryArea.name;
    }
    for (const val of Object.values(apollo)) {
      if (val?.__typename === 'Area_V3' && val.type === 'userDefined' && val.name) {
        area = val.name;
        break;
      }
    }

    // Extract floor from infoSections markdown text if available
    let floor = '';
    if (residence.infoSections) {
      for (const section of residence.infoSections) {
        const points = section?.content?.infoPoints || [];
        for (const p of points) {
          const md = p?.displayText?.markdown || '';
          const floorMatch = md.match(/våning\s*\*\*(\d+)\s*(av\s*\d+)?\*\*/i) ||
                             md.match(/\*\*våning\s*(\d+)\s*(av\s*\d+)?\*\*/i) ||
                             md.match(/våning\s*(\d+)/i);
          if (floorMatch) {
            floor = floorMatch[2] ? `${floorMatch[1]} ${floorMatch[2]}` : floorMatch[1];
          }
        }
      }
    }

    // Check for elevator in infoSections
    let hiss = 0;
    if (residence.infoSections) {
      const allText = JSON.stringify(residence.infoSections).toLowerCase();
      if (allText.includes('hiss')) hiss = 1;
    }

    // Pick best price: listPrice for active listings, soldPrice for sold
    const price = residence.listPrice?.raw || residence.soldPrice?.raw || null;

    return {
      addr: residence.streetAddress || '',
      area,
      price,
      sqm: residence.livingArea?.raw || null,
      rooms: residence.rooms?.raw || null,
      floor,
      fee: residence.rent?.raw || null,
      hiss,
      note: '',
    };
  } catch (e) {
    console.error('Booli parse error:', e);
    return null;
  }
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
    if (!url || (!url.includes('booli.se') && !url.includes('hemnet.se'))) {
      return Response.json({ error: 'Ange en giltig Booli- eller Hemnet-länk' }, { status: 400 });
    }

    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });

    if (!res.ok) {
      return Response.json({
        error: `Kunde inte hämta sidan (${res.status})`,
        showPasteFallback: true,
      }, { status: 502 });
    }

    const html = await res.text();

    // Try direct parsing for Booli (fast, no AI cost)
    if (url.includes('booli.se')) {
      const booliData = parseBooliNextData(html);
      if (booliData) {
        return Response.json(formatResult(booliData, url));
      }
    }

    // Fallback: use AI to parse HTML (for Hemnet or if Booli parse fails)
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
  } catch (err) {
    console.error('Scrape error:', err);
    return Response.json({ error: 'Något gick fel vid hämtning' }, { status: 500 });
  }
}
