import { useState } from "react";
import { getApiKey, setApiKey } from "../../api/auth.js";

export function ApiKeyButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getApiKey() ?? "");

  const save = () => {
    setApiKey(value.trim());
    setOpen(false);
  };

  const clear = () => {
    setApiKey("");
    setValue("");
    setOpen(false);
  };

  const hasKey = !!getApiKey();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded-md text-xs text-gray-400 bg-panel2 border border-edge hover:border-accent transition-colors"
        title="API Key settings"
        aria-label="API Key settings"
        aria-expanded={open}
      >
        {hasKey ? "🔑" : "🔑·"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-edge bg-panel p-3 shadow-xl">
          <div className="text-xs text-gray-400 mb-2">API Key</div>
          <p className="text-[10px] text-gray-600 mb-2">
            Required only when the server sets <code className="text-gray-500">OPENMOTION_API_KEY</code>.
          </p>
          <input
            type="password"
            placeholder="paste key…"
            className="w-full px-2 py-1 rounded bg-bg border border-edge text-xs text-gray-200 focus:outline-none focus:border-accent"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setOpen(false);
            }}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={save}
              className="flex-1 px-2 py-1 rounded text-xs bg-accent hover:bg-accent2 text-white transition-colors"
            >
              Save
            </button>
            {hasKey && (
              <button
                onClick={clear}
                className="px-2 py-1 rounded text-xs bg-panel2 border border-edge hover:border-red-500 text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
