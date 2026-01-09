"use client";

import { useEffect, useState, useRef } from "react";
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
  isStreaming?: boolean;
  shouldAnimate?: boolean; // Whether to animate this message
}

interface ChatMessageProps {
  message: Message;
  onRetry?: (messageId: string) => void;
  isRetrying?: boolean;
  onTypingComplete?: () => void;
}

// Natural typing animation hook embedded in component
function useNaturalTyping(
  fullText: string,
  shouldAnimate: boolean,
  onComplete?: () => void
) {
  const [displayedText, setDisplayedText] = useState(
    shouldAnimate ? "" : fullText
  );
  const [isTyping, setIsTyping] = useState(shouldAnimate);
  const indexRef = useRef(0);
  const fullTextRef = useRef(fullText);
  const hasStartedRef = useRef(false);

  // Update fullTextRef when fullText changes (for streaming)
  useEffect(() => {
    const prevLength = fullTextRef.current.length;
    fullTextRef.current = fullText;

    // If we weren't animating but should be (initial message)
    if (shouldAnimate && !hasStartedRef.current && fullText) {
      hasStartedRef.current = true;
      setIsTyping(true);
    }

    // If text grew and we stopped typing, resume
    if (
      !isTyping &&
      indexRef.current > 0 &&
      indexRef.current < fullText.length &&
      indexRef.current === prevLength
    ) {
      setIsTyping(true);
    }
  }, [fullText, shouldAnimate, isTyping]);

  // Main typing loop
  useEffect(() => {
    if (!isTyping || !shouldAnimate) {
      if (!shouldAnimate) {
        setDisplayedText(fullText);
      }
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const typeNext = () => {
      const currentFullText = fullTextRef.current;

      if (indexRef.current >= currentFullText.length) {
        // Check if streaming is done
        if (currentFullText === fullTextRef.current) {
          setIsTyping(false);
          onComplete?.();
        }
        return;
      }

      // Check if we're at the start of an image markdown ![...](...)
      // If so, skip the entire image tag immediately
      const remainingText = currentFullText.slice(indexRef.current);
      const imageMatch = remainingText.match(/^!\[[^\]]*\]\([^)]+\)/);

      if (imageMatch) {
        // Skip entire image markdown - render it immediately
        indexRef.current += imageMatch[0].length;
        setDisplayedText(currentFullText.slice(0, indexRef.current));
        // Small pause after image loads
        timeoutId = setTimeout(typeNext, 100);
        return;
      }

      const char = currentFullText[indexRef.current];

      indexRef.current += 1;
      setDisplayedText(currentFullText.slice(0, indexRef.current));

      // Calculate natural delay
      let delay = 15 + Math.random() * 25; // Base: 15-40ms

      // Punctuation pauses
      if ([".", "!", "?"].includes(char)) {
        delay += 80 + Math.random() * 80;
      } else if ([",", ";", ":"].includes(char)) {
        delay += 40 + Math.random() * 40;
      }

      // Newline pause
      if (char === "\n") {
        delay += 100 + Math.random() * 100;
      }

      // Spaces are quick
      if (char === " ") {
        delay *= 0.4;
      }

      // Emoji/special chars - slightly slower
      if (char.charCodeAt(0) > 127) {
        delay += 10;
      }

      timeoutId = setTimeout(typeNext, Math.max(delay, 8));
    };

    typeNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isTyping, shouldAnimate, onComplete, fullText]);

  return { displayedText, isTyping };
}

export default function ChatMessage({
  message,
  onRetry,
  isRetrying,
  onTypingComplete,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  // Determine if we should animate this message
  const shouldAnimate =
    !isUser && (message.shouldAnimate || message.isStreaming);

  // Use natural typing for assistant messages
  const { displayedText: typedContent, isTyping } = useNaturalTyping(
    message.content,
    shouldAnimate ?? false,
    onTypingComplete
  );

  const displayContent = isUser ? message.content : typedContent;

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
              {displayContent}
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
              {displayContent}
            </ReactMarkdown>
            {isTyping && (
              <span className="inline-block w-0.5 h-[1em] ml-0.5 bg-foreground/60 animate-pulse" />
            )}
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
        {isSending && !isTyping && (
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
