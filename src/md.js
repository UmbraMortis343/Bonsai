// A small, safe Markdown renderer: headings, lists, bold, italic, code, links, images.
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function inline(s) {
  s = esc(s);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img alt="$1" src="$2" loading="lazy">');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
export function md(src) {
  const out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of String(src || "").split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`); }
    else if ((m = line.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)$/))) {
      const kind = m[1] ? "ol" : "ul";
      if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; }
      if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(m[2])}</li>`);
    } else if (!line.trim()) flush();
    else { if (list) { out.push(`</${list}>`); list = null; } para.push(line); }
  }
  flush();
  return out.join("");
}
