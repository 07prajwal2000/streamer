import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Binary, Code2, AlignLeft } from 'lucide-react';

interface JsonNodeProps {
  name?: string;
  value: any;
  isLast?: boolean;
}

const JsonNode: React.FC<JsonNodeProps> = ({ name, value, isLast = true }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (value === null) {
    return (
      <div className="font-mono text-xs leading-5">
        {name !== undefined && <span className="text-purple-400 dark:text-purple-400 json-key font-semibold">"{name}": </span>}
        <span className="text-gray-500 json-null italic">null</span>
        {!isLast && <span className="text-gray-400">,</span>}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="font-mono text-xs leading-5">
        {name !== undefined && <span className="text-purple-400 dark:text-purple-400 json-key font-semibold">"{name}": </span>}
        <span className="text-amber-400 dark:text-amber-400 json-boolean font-semibold">{value ? 'true' : 'false'}</span>
        {!isLast && <span className="text-gray-400">,</span>}
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="font-mono text-xs leading-5">
        {name !== undefined && <span className="text-purple-400 dark:text-purple-400 json-key font-semibold">"{name}": </span>}
        <span className="text-cyan-400 dark:text-cyan-400 json-number font-semibold">{value}</span>
        {!isLast && <span className="text-gray-400">,</span>}
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <div className="font-mono text-xs leading-5 break-all">
        {name !== undefined && <span className="text-purple-400 dark:text-purple-400 json-key font-semibold">"{name}": </span>}
        <span className="text-emerald-300 dark:text-emerald-300 json-string">"{value}"</span>
        {!isLast && <span className="text-gray-400">,</span>}
      </div>
    );
  }

  if (Array.isArray(value)) {
    const isEmpty = value.length === 0;
    return (
      <div className="font-mono text-xs leading-5">
        <div className="flex items-center gap-1 cursor-pointer group" onClick={() => setCollapsed(!collapsed)}>
          {!isEmpty && (
            <span className="text-gray-500 group-hover:text-gray-300">
              {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
            </span>
          )}
          {name !== undefined && <span className="text-purple-400">"{name}": </span>}
          <span className="text-gray-300">[</span>
          {collapsed && (
            <span className="text-gray-500 text-[10px] bg-[#1a212d] px-1 rounded">
              {value.length} items
            </span>
          )}
          {isEmpty && <span className="text-gray-300">]</span>}
          {collapsed && <span className="text-gray-300">]</span>}
          {!isLast && (isEmpty || collapsed) && <span className="text-gray-400">,</span>}
        </div>

        {!collapsed && !isEmpty && (
          <div className="pl-4 border-l border-[#242c3b] ml-1.5 my-0.5 space-y-0.5">
            {value.map((item, index) => (
              <JsonNode key={index} value={item} isLast={index === value.length - 1} />
            ))}
          </div>
        )}

        {!collapsed && !isEmpty && (
          <div className="text-gray-300">
            ]{!isLast && <span className="text-gray-400">,</span>}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    return (
      <div className="font-mono text-xs leading-5">
        <div className="flex items-center gap-1 cursor-pointer group" onClick={() => setCollapsed(!collapsed)}>
          {!isEmpty && (
            <span className="text-gray-500 group-hover:text-gray-300">
              {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
            </span>
          )}
          {name !== undefined && <span className="text-purple-400">"{name}": </span>}
          <span className="text-gray-300">{'{'}</span>
          {collapsed && (
            <span className="text-gray-500 text-[10px] bg-[#1a212d] px-1 rounded">
              {keys.length} keys
            </span>
          )}
          {isEmpty && <span className="text-gray-300">{'}'}</span>}
          {collapsed && <span className="text-gray-300">{'}'}</span>}
          {!isLast && (isEmpty || collapsed) && <span className="text-gray-400">,</span>}
        </div>

        {!collapsed && !isEmpty && (
          <div className="pl-4 border-l border-[#242c3b] ml-1.5 my-0.5 space-y-0.5">
            {keys.map((key, index) => (
              <JsonNode
                key={key}
                name={key}
                value={value[key]}
                isLast={index === keys.length - 1}
              />
            ))}
          </div>
        )}

        {!collapsed && !isEmpty && (
          <div className="text-gray-300">
            {'}'}{!isLast && <span className="text-gray-400">,</span>}
          </div>
        )}
      </div>
    );
  }

  return <div className="font-mono text-xs">{String(value)}</div>;
};

// Formats binary string to clean standard hex dump view
function formatHexDump(str: string): string {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }

  const lines = [];
  const bytesPerLine = 16;

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const chunk = bytes.slice(i, i + bytesPerLine);
    const offset = i.toString(16).padStart(8, '0');
    
    const hex = chunk
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(bytesPerLine * 3, ' ');

    const ascii = chunk
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');

    lines.push(`${offset}  ${hex} |${ascii}|`);
  }

  return lines.join('\n');
}

interface DataPayloadViewerProps {
  data: string;
  isBinary?: boolean;
}

export const DataPayloadViewer: React.FC<DataPayloadViewerProps> = ({ data, isBinary }) => {
  const [copied, setCopied] = useState(false);

  // Detect format
  let parsedJson: any = null;
  let isJson = false;

  if (!isBinary && data) {
    const trimmed = data.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        parsedJson = JSON.parse(data);
        isJson = true;
      } catch {
        isJson = false;
      }
    }
  }

  const defaultMode = isBinary ? 'hex' : isJson ? 'json' : 'text';
  const [mode, setMode] = useState<'json' | 'text' | 'hex'>(defaultMode);

  // Sync mode if payload drastically changes
  React.useEffect(() => {
    setMode(isBinary ? 'hex' : isJson ? 'json' : 'text');
  }, [data, isBinary, isJson]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] rounded-lg border border-[#1e2530] overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-9 px-3 bg-[#0d1219] border-b border-[#1e2530] flex items-center justify-between">
        <div className="flex items-center gap-1">
          {isJson && (
            <button
              onClick={() => setMode('json')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                mode === 'json'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>JSON Tree</span>
            </button>
          )}

          <button
            onClick={() => setMode('text')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === 'text'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlignLeft className="w-3 h-3" />
            <span>Raw Text</span>
          </button>

          <button
            onClick={() => setMode('hex')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === 'hex'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Binary className="w-3 h-3" />
            <span>Hex Dump</span>
          </button>
        </div>

        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1c2330] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3 overflow-auto select-text font-mono">
        {!data ? (
          <div className="text-gray-600 text-xs italic">Payload is empty (0 bytes)</div>
        ) : mode === 'json' && isJson ? (
          <div className="p-1">
            <JsonNode value={parsedJson} />
          </div>
        ) : mode === 'hex' ? (
          <pre className="text-[11px] leading-4 text-emerald-400/90 whitespace-pre">
            {formatHexDump(data)}
          </pre>
        ) : (
          <pre className="text-xs text-gray-200 whitespace-pre-wrap break-all leading-5">
            {data}
          </pre>
        )}
      </div>
    </div>
  );
};
