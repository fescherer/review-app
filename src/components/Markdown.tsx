import ReactMarkdown from "react-markdown";
import { openUrl } from "../lib/openUrl";

export function Markdown({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-sm italic text-zinc-500">No text.</p>;
  return (
    <div className="markdown text-[15px]">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href) openUrl(href);
              }}
            >
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
