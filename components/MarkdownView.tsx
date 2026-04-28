"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { remarkRewriteLinks } from "@/lib/markdown";
import "highlight.js/styles/github.css";
import { cn } from "@/lib/utils";

export function MarkdownView({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkRewriteLinks]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
