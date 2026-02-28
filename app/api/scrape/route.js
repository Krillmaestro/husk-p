import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes('booli.se')) {
      return Response.json({ error: 'Ange en giltig Booli-länk' }, { status: 400 });
    }

    // Fetch the Booli page
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      return Response.json({ error: `Kunde inte hämta sidan (${res.status})` }, { status: 502 });
    }

    const html = await res.text();

    // Strip scripts/styles/SVGs to reduce token usage, keep text content
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
      .slice(0, 30000); // Cap to ~30k chars to limit tokens

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Extrahera lägenhetsinformation från denna Booli-sida. Svara ENBART med JSON, inga andra tecken.

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

HTML:
${cleaned}`,
        },
      ],
    });

    const text = message.content[0].text.trim();

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Kunde inte tolka svaret från AI' }, { status: 500 });
    }

    const data = JSON.parse(jsonMatch[0]);

    return Response.json({
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
    });
  } catch (err) {
    console.error('Scrape error:', err);
    return Response.json({ error: 'Något gick fel vid hämtning' }, { status: 500 });
  }
}
