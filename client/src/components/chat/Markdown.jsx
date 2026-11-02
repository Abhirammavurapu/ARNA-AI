import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';

function textOf(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  return node?.props?.children ? textOf(node.props.children) : '';
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = children?.props || {};
  const lang = /language-([\w-]+)/.exec(code.className || '')?.[1] || 'code';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(code.children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context) */
    }
  };

  return (
    <div className="codeblock">
      <div className="codeblock__bar">
        <span>{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/10" aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  a: ({ children, ...p }) => (
    <a {...p} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
};

const highlight = [[rehypeHighlight, { detect: false, ignoreMissing: true }]];

/** While a reply is streaming we skip syntax highlighting (re-highlighting every frame is slow on phones). */
function Markdown({ text, streaming = false }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={streaming ? [] : highlight} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
