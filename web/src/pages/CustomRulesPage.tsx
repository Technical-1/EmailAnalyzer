import { useState } from 'react';
import { Filter, Plus, Trash2, Pencil, Play, X, Check, Power } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { useAppStore } from '../store';
import { useToastStore } from '../components/Toast';
import { customRulesEngine } from '../services/customRulesEngine';
import type { CustomRule, RuleCondition, RuleAction } from '../types';

type FieldOption = RuleCondition['field'];
type OperatorOption = RuleCondition['operator'];
type ActionType = RuleAction['type'];

const FIELDS: { value: FieldOption; label: string }[] = [
  { value: 'sender', label: 'Sender' },
  { value: 'subject', label: 'Subject' },
  { value: 'body', label: 'Body' },
  { value: 'recipient', label: 'Recipient' },
];

const OPERATORS: { value: OperatorOption; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'regex', label: 'matches regex' },
];

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'tag', label: 'Add tag' },
  { value: 'move', label: 'Move to folder' },
  { value: 'star', label: 'Star' },
  { value: 'markRead', label: 'Mark as read' },
];

interface DraftRule {
  id: string | null; // null => creating
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const emptyDraft = (): DraftRule => ({
  id: null,
  name: '',
  conditions: [{ field: 'sender', operator: 'contains', value: '', caseSensitive: false }],
  actions: [{ type: 'tag', value: '' }],
});

export function CustomRulesPage() {
  const folders = useAppStore((s) => s.folders);
  const applyRulesToAll = useAppStore((s) => s.applyRulesToAll);
  const showError = useToastStore((s) => s.showError);
  const showSuccess = useToastStore((s) => s.showSuccess);

  const [rules, setRules] = useState<CustomRule[]>(() => customRulesEngine.getRules());
  const reload = () => setRules(customRulesEngine.getRules());

  const [draft, setDraft] = useState<DraftRule | null>(null);
  const [applying, setApplying] = useState(false);

  const startCreate = () => setDraft(emptyDraft());
  const startEdit = (rule: CustomRule) =>
    setDraft({
      id: rule.id,
      name: rule.name,
      conditions: rule.conditions.map((c) => ({ ...c })),
      actions: rule.actions.map((a) => ({ ...a })),
    });

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const conditions = draft.conditions.filter((c) => c.value.trim() !== '');
    const actions = draft.actions.filter(
      (a) => a.type === 'star' || a.type === 'markRead' || (a.value && a.value.trim() !== ''),
    );

    if (!name) return showError('Give the rule a name.');
    if (conditions.length === 0) return showError('Add at least one condition with a value.');
    if (actions.length === 0) return showError('Add at least one action.');

    if (draft.id) {
      customRulesEngine.updateRule(draft.id, { name, conditions, actions });
    } else {
      customRulesEngine.createRule({ name, conditions, actions, isActive: true });
    }
    setDraft(null);
    reload();
  };

  const handleToggle = (id: string) => {
    customRulesEngine.toggleRule(id);
    reload();
  };

  const handleDelete = (id: string) => {
    customRulesEngine.deleteRule(id);
    if (draft?.id === id) setDraft(null);
    reload();
  };

  const handleApplyNow = async () => {
    setApplying(true);
    try {
      const count = await applyRulesToAll();
      if (count > 0) showSuccess(`Applied rules to ${count} email${count === 1 ? '' : 's'}.`);
      else showSuccess('No emails matched the active rules.');
    } finally {
      setApplying(false);
    }
  };

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rules</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Automatically tag, move, star, or mark emails as read when they match your conditions.
            Rules run on import and whenever you apply them.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleApplyNow}
            disabled={applying || activeCount === 0}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-200"
          >
            <Play className="w-4 h-4" />
            {applying ? 'Applying…' : 'Apply rules now'}
          </button>
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New rule
          </button>
        </div>
      </div>

      {/* Editor */}
      {draft && (
        <RuleEditor
          draft={draft}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          onChange={setDraft}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      {/* Rule list */}
      {rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white dark:bg-slate-800 rounded-xl p-4 border transition-colors ${
                rule.isActive
                  ? 'border-slate-200 dark:border-slate-700'
                  : 'border-dashed border-slate-300 dark:border-slate-600 opacity-70'
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleToggle(rule.id)}
                  aria-label={rule.isActive ? `Disable ${rule.name}` : `Enable ${rule.name}`}
                  aria-pressed={rule.isActive}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                    rule.isActive
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  <Power className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{rule.name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate">
                    {customRulesEngine.ruleToString(rule)}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(rule)}
                    aria-label={`Edit ${rule.name}`}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    aria-label={`Delete ${rule.name}`}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !draft && (
          <EmptyState
            icon={Filter}
            title="No rules yet"
            description="Create a rule to automatically organize matching emails."
            actionLabel="New rule"
            onClick={startCreate}
          />
        )
      )}
    </div>
  );
}

function RuleEditor({
  draft,
  folders,
  onChange,
  onSave,
  onCancel,
}: {
  draft: DraftRule;
  folders: { id: string; name: string }[];
  onChange: (d: DraftRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const setConditions = (conditions: RuleCondition[]) => onChange({ ...draft, conditions });
  const setActions = (actions: RuleAction[]) => onChange({ ...draft, actions });

  const selectClass =
    'px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-5">
      <input
        type="text"
        placeholder="Rule name (e.g. Tag bank statements)"
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
      />

      {/* Conditions */}
      <div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          When <span className="text-slate-400 font-normal">(all conditions must match)</span>
        </div>
        <div className="space-y-2">
          {draft.conditions.map((cond, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={cond.field}
                onChange={(e) =>
                  setConditions(draft.conditions.map((c, j) => (j === i ? { ...c, field: e.target.value as FieldOption } : c)))
                }
                className={selectClass}
                aria-label="Condition field"
              >
                {FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={(e) =>
                  setConditions(draft.conditions.map((c, j) => (j === i ? { ...c, operator: e.target.value as OperatorOption } : c)))
                }
                className={selectClass}
                aria-label="Condition operator"
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="value"
                value={cond.value}
                onChange={(e) =>
                  setConditions(draft.conditions.map((c, j) => (j === i ? { ...c, value: e.target.value } : c)))
                }
                className="flex-1 min-w-[140px] px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={cond.caseSensitive}
                  onChange={(e) =>
                    setConditions(draft.conditions.map((c, j) => (j === i ? { ...c, caseSensitive: e.target.checked } : c)))
                  }
                />
                Aa
              </label>
              <button
                onClick={() => setConditions(draft.conditions.filter((_, j) => j !== i))}
                disabled={draft.conditions.length === 1}
                aria-label="Remove condition"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 disabled:opacity-30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setConditions([...draft.conditions, { field: 'subject', operator: 'contains', value: '', caseSensitive: false }])}
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add condition
        </button>
      </div>

      {/* Actions */}
      <div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Then</div>
        <div className="space-y-2">
          {draft.actions.map((action, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={action.type}
                onChange={(e) => {
                  const type = e.target.value as ActionType;
                  setActions(draft.actions.map((a, j) => (j === i ? { type, value: type === 'star' || type === 'markRead' ? undefined : '' } : a)));
                }}
                className={selectClass}
                aria-label="Action type"
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>

              {action.type === 'tag' && (
                <input
                  type="text"
                  placeholder="tag name"
                  value={action.value ?? ''}
                  onChange={(e) => setActions(draft.actions.map((a, j) => (j === i ? { ...a, value: e.target.value } : a)))}
                  className="flex-1 min-w-[140px] px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              )}

              {action.type === 'move' && (
                <select
                  value={action.value ?? ''}
                  onChange={(e) => setActions(draft.actions.map((a, j) => (j === i ? { ...a, value: e.target.value } : a)))}
                  className={`${selectClass} flex-1 min-w-[140px]`}
                  aria-label="Target folder"
                >
                  <option value="">Select folder…</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setActions(draft.actions.filter((_, j) => j !== i))}
                disabled={draft.actions.length === 1}
                aria-label="Remove action"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 disabled:opacity-30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setActions([...draft.actions, { type: 'star' }])}
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add action
        </button>
      </div>

      {/* Save / Cancel */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Check className="w-4 h-4" />
          {draft.id ? 'Save changes' : 'Create rule'}
        </button>
      </div>
    </div>
  );
}
