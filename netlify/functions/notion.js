exports.handler = async (event) => {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = '2158ddad4a9d80c0bca8c8a0198ab53d';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const body = {
        page_size: 100,
        sorts: [{ property: 'Publish date', direction: 'descending' }],
      };
      if (startCursor) body.start_cursor = startCursor;

      const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return { statusCode: res.status, headers, body: JSON.stringify({ error: err }) };
      }

      const data = await res.json();

      const mapped = await Promise.all(data.results.map(async (page) => {
        const props = page.properties;

        const getText  = (p) => p?.title?.[0]?.plain_text || p?.rich_text?.[0]?.plain_text || '';
        const getSelect = (p) => p?.select?.name || p?.status?.name || '';
        const getMulti  = (p) => (p?.multi_select || []).map(o => o.name);
        const getDate   = (p) => p?.date?.start || '';
        const getUrl    = (p) => p?.url || '';
        const getCheck  = (p) => p?.checkbox || false;

        let imageUrl = '';
        try {
          const blockRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=20`, {
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
            },
          });
          if (blockRes.ok) {
            const blockData = await blockRes.json();
            for (const block of blockData.results) {
              if (block.type === 'image') {
                imageUrl = block.image?.file?.url || block.image?.external?.url || '';
                break;
              }
              if (block.type === 'column_list') {
                const colRes = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children`, {
                  headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
                });
                if (colRes.ok) {
                  const colData = await colRes.json();
                  for (const col of colData.results) {
                    const colBlockRes = await fetch(`https://api.notion.com/v1/blocks/${col.id}/children`, {
                      headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
                    });
                    if (colBlockRes.ok) {
                      const colBlocks = await colBlockRes.json();
                      for (const b of colBlocks.results) {
                        if (b.type === 'image') {
                          imageUrl = b.image?.file?.url || b.image?.external?.url || '';
                          break;
                        }
                      }
                    }
                    if (imageUrl) break;
                  }
                }
                if (imageUrl) break;
              }
            }
          }
        } catch(e) {}

        return {
          id: page.id,
          page_url: page.url,
          name: getText(props['Content name']),
          status: getSelect(props['Status']),
          platform: getMulti(props['Platform']),
          publish_date: getDate(props['Publish date']),
          pillar: getMulti(props['Content Pillar']),
          creator: getMulti(props['ผู้จัดทำ']),
          requester: getSelect(props['ผู้สั่งทำ']),
          type: getSelect(props['type']),
          category: getMulti(props['Category']),
          media_type: getSelect(props['Image/VDO']),
          post_url_fb: getUrl(props['Post URL (FB)']),
          create_date: getDate(props['Create date']),
          pinned: getCheck(props['ปักตะกร้า']),
          revision: getSelect(props['แก้งาน']),
          image_url: imageUrl,
        };
      }));

      allResults = allResults.concat(mapped);
      hasMore = data.has_more;
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
      body: JSON.stringify({ error: err.message }),
    };
  }
};
