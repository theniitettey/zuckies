"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertCircle, Check, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  status?: "sending" | "sent" | "failed";
  originalInput?: string;
}

interface ChatMessageProps {
  message: Message;
  onRetry?: (messageId: string) => void;
  isRetrying?: boolean;
}

export default function ChatMessage({
  message,
  onRetry,
  isRetrying,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] text-[15px] sm:text-base leading-relaxed",
          isUser ? "text-right" : "text-left"
        )}
      >
        {isUser ? (
          // User bubble - iMessage green/orange style
          <div className="inline-block bg-orange-500 text-white px-4 py-2.5 rounded-[20px] rounded-br-[4px] shadow-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-1 last:mb-0">{children}</p>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt || ""}
                    className="rounded-xl max-w-full h-auto max-h-48 my-1"
                  />
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                em: ({ children }) => <em>{children}</em>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="bg-white/20 px-1 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          // AI bubble - gray/glass style like received iMessage
          <div className="inline-block liquid-glass-pill px-4 py-2.5 rounded-[20px] rounded-bl-[4px]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 text-foreground/85">
                    {children}
                  </p>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt || ""}
                    className="rounded-xl max-w-full h-auto max-h-64 my-2"
                  />
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="text-orange-400/90">{children}</em>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 space-y-1 text-foreground/80">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 space-y-1 text-foreground/80">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="flex gap-2">
                    <span className="text-orange-400/60">•</span>
                    <span>{children}</span>
                  </li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
                  >
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="text-orange-400/90 text-sm font-mono bg-foreground/5 px-1 py-0.5 rounded">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-foreground/5 p-3 rounded-xl overflow-x-auto my-2 text-sm font-mono">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-orange-400/30 pl-3 my-2 text-foreground/70 italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div
        className={cn(
          "flex items-center gap-1.5 mt-1 text-xs",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {isSending && (
          <span className="flex items-center gap-1 text-foreground/40">
            <Loader2 className="w-3 h-3 animate-spin" />
            sending...
          </span>
        )}
        {isFailed && (
          <button
            onClick={() => onRetry?.(message.id)}
            disabled={isRetrying}
            className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer group"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                retrying...
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                <span>failed to send</span>
                <RefreshCw className="w-3 h-3 ml-1 group-hover:rotate-180 transition-transform duration-300" />
                <span className="underline">retry</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
