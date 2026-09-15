import { Fragment, type ReactNode } from "react";
import type { RichText, RichTextNode } from "@tpb/contracts";

function renderText(node: RichTextNode, key: string): ReactNode {
  let element: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") element = <strong>{element}</strong>;
    else if (mark.type === "italic") element = <em>{element}</em>;
    else if (mark.type === "underline") element = <u>{element}</u>;
    else if (mark.type === "strike") element = <s>{element}</s>;
    else if (mark.type === "code") element = <code>{element}</code>;
    else if (mark.type === "link") {
      const href = (mark.attrs as Record<string, unknown> | undefined)?.href;
      if (typeof href === "string") {
        element = (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {element}
          </a>
        );
      }
    }
  }
  return <Fragment key={key}>{element}</Fragment>;
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  const children = node.content?.map((child, index) => renderNode(child, `${key}-${index}`));
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      const level = Number((node.attrs as Record<string, unknown> | undefined)?.level ?? 2);
      if (level <= 2) return <h2 key={key}>{children}</h2>;
      if (level === 3) return <h3 key={key}>{children}</h3>;
      return <h4 key={key}>{children}</h4>;
    }
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "text":
      return renderText(node, key);
    default:
      return null;
  }
}

export function RichTextView({ doc, className = "" }: { doc: RichText; className?: string }) {
  return <div className={`rich-text ${className}`.trim()}>{doc.content?.map((node, index) => renderNode(node, String(index)))}</div>;
}
