from pathlib import Path
path = Path(r"c:\\Users\\windows\\Downloads\\meta-ads-app\\Web\\src\\App.jsx")
text = path.read_text()
old = '''function CustomMetricBuilder({ baseFields, onSave }) {
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("(results * 15) / spend");
  const [error, setError] = useState("");

  const tryEvaluate = () => {
    try {
      const evaluate = createMetricEvaluator(formula);
      if (!evaluate) {
        setError("Invalid formula. Use base fields and operators.");
        return;
      }
      const sampleRow = Object.fromEntries(baseFields.map((key) => [key, 1]));
      const val = evaluate(sampleRow);
      if (Number.isFinite(val)) {
        setError("");
        onSave?.({ name: name || "Custom Metric", formula });
      } else {
        setError("Formula did not evaluate to a number.");
      }
    } catch (e) {
      setError("Invalid formula. Use base fields and operators.");
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-800/60 backdrop-blur border border-slate-700 space-y-3">
      <div className="text-sm text-slate-300">Create Custom Metric</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Metric name (e.g. Blended ROAS)"
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="text-xs text-slate-400">
        Available fields:
        {baseFields.map((field) => (
          <code key={field} className="text-slate-200 mr-1">{field}</code>
        ))}
      </div>
      <input
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        placeholder="(results * 15) / spend"
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <div className="text-xs text-rose-300">{error}</div>}
      <div className="flex justify-end">
        <button onClick={tryEvaluate} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
          <Icon.Plus className="w-4 h-4" /> Save Metric
        </button>
      </div>
    </div>
  );
}
'''
new = '''function CustomMetricBuilder({ baseFields, initialMetric, onSubmit, onCancel }) {
  const defaultFormula = "(results * 15) / spend";
  const isEditing = Boolean(initialMetric);
  const [name, setName] = useState(initialMetric?.name || "");
  const [formula, setFormula] = useState(initialMetric?.formula || defaultFormula);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(initialMetric?.name || "");
    setFormula(initialMetric?.formula || defaultFormula);
    setError("");
  }, [initialMetric]);

  const insertField = (field) => {
    setFormula((prev) => {
      const base = prev || "";
      const needsSpace = base && !base.endsWith(" ");
      return `${base}${needsSpace ? " " : ""}${field}`;
    });
  };

  const handleSubmit = () => {
    try {
      const evaluator = createMetricEvaluator(formula, baseFields);
      if (!evaluator) {
        setError("Invalid formula. Use available fields and operators.");
        return;
      }
      const sampleRow = Object.fromEntries(baseFields.map((key) => [key, 1]));
      const result = evaluator(sampleRow);
      if (!Number.isFinite(result)) {
        setError("Formula did not evaluate to a number.");
        return;
      }
      const payload = { name: (name || "").trim() || "Custom Metric", formula: formula.trim() || defaultFormula };
      const outcome = onSubmit?.(payload);
      if (outcome !== false && !isEditing) {
        setName("");
        setFormula(defaultFormula);
      }
      setError("");
    } catch (e) {
      setError("Invalid formula. Use available fields and operators.");
    }
  };

  const handleCancel = () => {
    onCancel?.();
    setName("");
    setFormula(defaultFormula);
    setError("");
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-100">{isEditing ? "Edit Custom Metric" : "Create Custom Metric"}</div>
          <div className="text-xs text-slate-400">Click a field to insert it into your formula.</div>
        </div>
        {isEditing && (
          <button type="button" onClick={handleCancel} className="text-xs text-indigo-300 hover:text-indigo-200">
            New metric
          </button>
        )}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Metric name (e.g. Blended ROAS)"
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Available fields</div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
          {baseFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => insertField(field)}
              className="px-2 py-1 text-xs rounded-full bg-slate-800/80 text-slate-200 hover:bg-indigo-500/20 hover:text-indigo-200"
            >
              {field}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        placeholder={defaultFormula}
        rows={3}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <div className="text-xs text-rose-300">{error}</div>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
        >
          {isEditing ? "Update Metric" : "Save Metric"}
        </button>
      </div>
    </div>
  );
}
'''
if old not in text:
    raise SystemExit('CustomMetricBuilder block not found')
text = text.replace(old, new)
path.write_text(text)
