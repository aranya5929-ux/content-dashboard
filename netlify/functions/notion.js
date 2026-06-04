exports.handler = async (event) => {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '2158ddad4a9d80a3a2e8000bff9a7a6e';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!NOTION_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN not set' }) };
  }

  try {
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const bodyObj = { page_size: 100 };
      if (startCursor) bodyObj.start_cursor = startCursor;

      const url = 'https://api.notion.com/v1/databases/' + DB_ID + '/query';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NOTION_TOKEN,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyObj),
      });

      const text = await res.text();

      if (!res.ok) {
        return { statusCode: res.status, headers, body: JSON.stringify({ error: text, url: url }) };
      }

      const data = JSON.parse(text);

      const mapped = data.results.map((page) => {
        const props = page.properties || {};
        const getText  = (p) => p?.title?.[0]?.plain_text || p?.rich_text?.[0]?.plain_text || '';
        const getSelect = (p) => p?.select?.name || p?.status?.name || '';
        const getMulti  = (p) => (p?.multi_select || []).map(o => o.name);
        const getDate   = (p) => p?.date?.start || '';
        const getUrl    = (p) => p?.url || '';

        return {
          id: page.id,
          page_url: page.url,
          name: getText(props['Content name']),
          status: getSelect(props['Status']),
          platform: getMulti(props['Platform']),
          publish_date: getDate(props['Publish date']),
          pillar: getMulti(props['Content Pillar']),
          creator: getMulti(props['ผู้จัดทำ']),
          type: getSelect(props['type']),
          category: getMulti(props['Category']),
          media_type: getSelect(props['Image/VDO']),
          image_url: '',
        };
      });

      allResults = allResults.concat(mapped);
      hasMore = data.has_more || false;
      startCursor = data.next_cursor;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results: allResults, total: allResults.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, stack: err.stack }),
    };
  }
};
