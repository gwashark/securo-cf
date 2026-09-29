import { jsx as _jsx } from "react/jsx-runtime";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils.js';
import { Component, memo } from 'react';
import { AgentChart } from './agent-chart.js';
/**
 * Tailwind-styled GFM markdown for chat messages.
 *
 * Deliberately conservative: no raw HTML, no images, links open in a new
 * tab with rel=noopener. Sized to feel right inside the chat bubble — not
 * a documentation page.
 *
 * Wrapped in React.memo at the bottom so static assistant messages
 * (including embedded `securo-chart` blocks) don't re-render on every
 * keystroke in the chat input — they were causing Recharts to fully
 * reanimate per character typed.
 */
function _Markdown({ children, className }) {
    return (_jsx("div", { className: cn('text-sm leading-relaxed [&>:first-child]:mt-0 [&>:last-child]:mb-0', className), children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: {
                p: ({ children }) => _jsx("p", { className: "my-2 whitespace-pre-wrap", children: children }),
                ul: ({ children }) => _jsx("ul", { className: "my-2 list-disc pl-5 space-y-0.5", children: children }),
                ol: ({ children }) => _jsx("ol", { className: "my-2 list-decimal pl-5 space-y-0.5", children: children }),
                li: ({ children }) => _jsx("li", { className: "marker:text-muted-foreground/70", children: children }),
                h1: ({ children }) => _jsx("h1", { className: "text-base font-bold mt-3 mb-1.5", children: children }),
                h2: ({ children }) => _jsx("h2", { className: "text-[15px] font-semibold mt-3 mb-1.5", children: children }),
                h3: ({ children }) => _jsx("h3", { className: "text-sm font-semibold mt-2.5 mb-1", children: children }),
                h4: ({ children }) => _jsx("h4", { className: "text-sm font-semibold mt-2 mb-1", children: children }),
                strong: ({ children }) => _jsx("strong", { className: "font-semibold", children: children }),
                em: ({ children }) => _jsx("em", { className: "italic", children: children }),
                del: ({ children }) => _jsx("del", { className: "opacity-70", children: children }),
                blockquote: ({ children }) => (_jsx("blockquote", { className: "border-l-2 border-border pl-3 italic text-muted-foreground my-2", children: children })),
                a: ({ href, children }) => (_jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", className: "text-primary underline underline-offset-2 hover:opacity-80", children: children })),
                hr: () => _jsx("hr", { className: "my-3 border-border" }),
                table: ({ children }) => (_jsx("div", { className: "my-2 overflow-x-auto", children: _jsx("table", { className: "border-collapse text-xs", children: children }) })),
                thead: ({ children }) => _jsx("thead", { className: "bg-muted/60", children: children }),
                th: ({ children }) => (_jsx("th", { className: "border border-border px-2 py-1 text-left font-semibold", children: children })),
                td: ({ children }) => _jsx("td", { className: "border border-border px-2 py-1 align-top", children: children }),
                code: ({ className, children, ...props }) => {
                    const isFenced = typeof className === 'string' && className.startsWith('language-');
                    // Special-case our agent chart code-fence: parse the JSON
                    // body and render an inline recharts figure instead of a
                    // code block. Falls back to a plain pre/code on parse error
                    // so the user can still see what the model emitted.
                    if (className === 'language-securo-chart') {
                        const raw = String(children ?? '').trim();
                        try {
                            const spec = JSON.parse(raw);
                            return (_jsx(ChartErrorBoundary, { raw: raw, children: _jsx(AgentChart, { spec: spec }) }));
                        }
                        catch {
                            // fall through to plain code rendering
                        }
                    }
                    if (isFenced) {
                        return (_jsx("code", { className: cn('font-mono text-xs', className), ...props, children: children }));
                    }
                    return (_jsx("code", { className: "rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[11.5px] font-mono", ...props, children: children }));
                },
                pre: ({ children }) => (_jsx("pre", { className: "my-2 overflow-x-auto rounded-md border bg-background/60 p-3 text-xs leading-snug", children: children })),
                input: ({ checked, type }) => {
                    // GFM task lists.
                    if (type === 'checkbox') {
                        return (_jsx("input", { type: "checkbox", checked: !!checked, readOnly: true, className: "mr-1.5 align-middle accent-primary" }));
                    }
                    return null;
                },
            }, children: children }) }));
}
/** Memoized export — keystrokes in the chat input force the parent to
 *  re-render, but assistant messages don't change, so we skip rendering
 *  them entirely when `children`/`className` are referentially the
 *  same. Critical for chats that contain a recharts figure (Recharts
 *  treats new prop refs as new data and re-runs its enter animations). */
export const Markdown = memo(_Markdown, (prev, next) => prev.children === next.children && prev.className === next.className);
/** Recharts can throw inside its layout effects (e.g. legend dispatcher
 *  hitting "Maximum update depth exceeded" in tight panel widths). A
 *  thrown error in a chart should NOT take the whole chat down — degrade
 *  to a code block so the user still sees the JSON the model produced. */
class ChartErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (!this.state.hasError)
            return this.props.children;
        return (_jsx("pre", { className: "my-3 rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-snug font-mono overflow-x-auto whitespace-pre-wrap", children: this.props.raw }));
    }
}
