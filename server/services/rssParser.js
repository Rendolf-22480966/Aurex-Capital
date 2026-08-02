/** Minimal RSS/Atom parser — no external dependencies. */

function decodeEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
}

function stripTags(str = '') {
  return decodeEntities(String(str).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function firstMatch(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function allMatches(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function parseRssItems(xml) {
  const blocks = allMatches(xml, 'item');
  return blocks.map((block) => ({
    title: stripTags(firstMatch(block, 'title')),
    url: firstMatch(block, 'link') || firstMatch(block, 'guid'),
    summary: stripTags(firstMatch(block, 'description')).slice(0, 280),
    image_url: extractImage(block),
    published_at: firstMatch(block, 'pubDate') || null,
    source: null,
  }));
}

function parseAtomEntries(xml) {
  const blocks = allMatches(xml, 'entry');
  return blocks.map((block) => {
    const link =
      (block.match(/<link[^>]+href="([^"]+)"/i) || [])[1] ||
      firstMatch(block, 'id');
    return {
      title: stripTags(firstMatch(block, 'title')),
      url: link,
      summary: stripTags(firstMatch(block, 'summary') || firstMatch(block, 'content')).slice(0, 280),
      image_url: extractImage(block),
      published_at: firstMatch(block, 'published') || firstMatch(block, 'updated') || null,
      source: null,
    };
  });
}

function extractImage(block) {
  const media = block.match(/url="(https?:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (media) return media[1];
  const enclosure = block.match(/<enclosure[^>]+url="(https?:[^"]+)"/i);
  if (enclosure) return enclosure[1];
  const img = block.match(/<img[^>]+src="(https?:[^"]+)"/i);
  return img ? img[1] : null;
}

function parseFeed(xml) {
  if (!xml || typeof xml !== 'string') return [];
  const lower = xml.slice(0, 200).toLowerCase();
  if (lower.includes('<feed')) return parseAtomEntries(xml);
  return parseRssItems(xml);
}

module.exports = { parseFeed, stripTags };
