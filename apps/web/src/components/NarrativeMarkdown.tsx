import DOMPurify from "dompurify";
import { Marked } from "marked";

const markdown = new Marked({
  breaks: true,
  gfm: true,
});

const NARRATIVE_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

/**
 * Narrative entries stay editable Markdown strings. Only this sanitized representation
 * reaches innerHTML. Images are deliberately absent until campaign assets have a safe URL
 * policy; raw HTML outside the Markdown vocabulary is discarded.
 */
export function renderNarrativeMarkdown(source: string): string {
  const parsed = markdown.parse(source.replace(/^[\u200B-\u200F\uFEFF]/, ""));
  if (typeof parsed !== "string") return "";
  if (!DOMPurify.isSupported) return escapeHtml(source).replace(/\r?\n/g, "<br>");

  return DOMPurify.sanitize(parsed, {
    ALLOWED_ATTR: ["href", "title"],
    ALLOWED_TAGS: NARRATIVE_TAGS,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    SANITIZE_NAMED_PROPS: true,
  });
}

function escapeHtml(source: string): string {
  return source.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

export function NarrativeMarkdown(props: { text: string; streaming?: boolean }) {
  return (
    <div
      class="narrative-markdown"
      classList={{ "narrative-markdown-streaming": props.streaming }}
      // renderNarrativeMarkdown is the single, sanitized innerHTML boundary.
      innerHTML={renderNarrativeMarkdown(props.text)}
    />
  );
}
