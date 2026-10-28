import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

/** Renders an AI Coach assistant message as safe, styled Markdown.
 *
 * react-markdown parses Markdown into React elements directly — it never
 * produces an HTML string and never touches dangerouslySetInnerHTML, so
 * there is no code path here that can execute injected HTML or scripts.
 * remark-breaks is the only plugin added, purely so a single newline in
 * Claude's plain-text replies renders as a line break (CommonMark treats a
 * lone "\n" inside a paragraph as just a space otherwise) — matching what
 * the old `whitespace-pre-wrap` rendering preserved.
 *
 * The component overrides below only affect presentation (Tailwind classes
 * matching this app's existing navy design tokens) — the Markdown source
 * text itself (the actual AI-generated content) is passed through
 * unmodified. */

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mt-3 mb-1 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mt-3 mb-1 first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc list-outside pl-4 space-y-0.5 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal list-outside pl-4 space-y-0.5 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent/80">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-background/60 px-1 py-0.5 text-[0.85em] font-mono break-words">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 last:mb-0 overflow-x-auto rounded-lg bg-background/60 p-2.5 text-[0.85em]">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-2 border-border" />,
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
