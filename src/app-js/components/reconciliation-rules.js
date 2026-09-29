import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** The rules matching follows, shown and editable.
 *
 *  Sits under the categorization rules because it is the same promise made
 *  twice: the software decides things about your money, and you get to see
 *  the decision and disagree with it. Matching used to be numbers buried in
 *  a module; this is those numbers, with a name and a switch.
 *
 *  Two things this screen deliberately is not. It is not an open-ended
 *  condition builder like the rules above it: matching runs on a fixed set
 *  of signals, and offering fields the engine cannot read would be a lie
 *  told in a nice font. And it is not a list stored in the database: what
 *  you see is what we ship with whatever you changed applied over it, so a
 *  rule you never touched keeps improving when we improve it.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliation as reconciliationApi, accounts as accountsApi, payees as payeesApi, } from '../lib/api.js';
import { extractApiError } from '../lib/api-errors.js';
import { toast } from 'sonner';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, } from './ui/dialog.js';
import { Plus, RotateCcw, Trash2, Zap, HelpCircle, ChevronUp, ChevronDown, Power, Download, Upload } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { ACCOUNT_TYPE_CONFIG } from '../lib/account-type-config.js';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog.js';
/** Names for the rules we ship. Kept here rather than sent by the API so
 *  they follow the reader's language, and so a rule someone edited does not
 *  freeze its label in whatever language it was edited in. */
const SHIPPED_NAME = {
    same_client_exact: 'reconciliation.rule.sameClientExact',
    same_client_net_of_withholding: 'reconciliation.rule.netOfWithholding',
    exact_amount_any_client: 'reconciliation.rule.exactAmountAnyClient',
    same_client_part_payment: 'reconciliation.rule.partPayment',
    same_client_several_invoices: 'reconciliation.rule.severalInvoices',
    similar_description: 'reconciliation.rule.similarDescription',
    same_account_exact: 'reconciliation.rule.sameAccountExact',
    destination_named_in_description: 'reconciliation.rule.destinationNamed',
    exact_amount_nearby: 'reconciliation.rule.exactAmountNearby',
    close_amount_wider_window: 'reconciliation.rule.closeAmountWiderWindow',
};
/** What the file says it is. A categorization export dropped into the
 *  matching importer would otherwise arrive as a file with no rules in
 *  it and look like it worked. */
const POLICY_FORMAT = 'securo-reconciliation-rules';
const NODE_TITLE = {
    'reconciliation.match_transfer': 'reconciliation.node.transfers',
    'reconciliation.match_invoice': 'reconciliation.node.invoices',
    'reconciliation.match_recurring': 'reconciliation.node.recurring',
};
const NODE_HINT = {
    'reconciliation.match_transfer': 'reconciliation.node.transfersHint',
    'reconciliation.match_invoice': 'reconciliation.node.invoicesHint',
    'reconciliation.match_recurring': 'reconciliation.node.recurringHint',
};
/** What each set is called when it is a card of its own, rather than a
 *  strip inside one. A strip could lean on the heading above it for the
 *  word *rules*; a card has to carry its own name, and it has to say
 *  what it decides rather than which machinery decides it. */
const CARD_TITLE = {
    'reconciliation.match_transfer': 'reconciliation.card.transfers',
    'reconciliation.match_invoice': 'reconciliation.card.invoices',
    'reconciliation.match_recurring': 'reconciliation.card.recurring',
};
const CARD_HINT = {
    'reconciliation.match_transfer': 'reconciliation.card.transfersHint',
    'reconciliation.match_invoice': 'reconciliation.card.invoicesHint',
    'reconciliation.match_recurring': 'reconciliation.card.recurringHint',
};
/** The whole order with two entries exchanged.
 *
 *  Returns every id, not the pair that moved, because that is what the
 *  API takes, and for a good reason: an order where some rules are
 *  placed and the rest fall back to wherever we shipped them reads fine
 *  today and quietly rearranges the day a new default is inserted. */
function swap(rules, from, to) {
    const ids = rules.map((rule) => rule.id);
    const moved = ids.splice(from, 1)[0];
    ids.splice(to, 0, moved);
    return ids;
}
function SectionCard({ children }) {
    return (_jsx("div", { className: "bg-card rounded-xl border border-border shadow-sm overflow-hidden", children: children }));
}
/** One rule in a sentence, built from the signals it actually consults.
 *
 *  Written out rather than shown as a form on the row because the question
 *  a reader arrives with is "why did this match", and a sentence answers it
 *  where a grid of numbers does not. */
/** Several words mean *any of them*, so they read as a list and are typed
 *  as one. Commas rather than a repeater: somebody adding a fourth
 *  acquirer types four more characters instead of finding a button. */
function joinWords(value) {
    if (!value)
        return '';
    return Array.isArray(value) ? value.join(', ') : value;
}
/** A text field whose value is a list.
 *
 *  It holds what is being typed, not the split result read back. Splitting
 *  on every keystroke and re-joining ate the separator: a word followed by
 *  a comma became one word, which rendered back without the comma, so the
 *  next letter landed against it and three names arrived as one.
 */
/** The currency list, held as text while it is being typed.

 *  Same problem `WordsInput` solves, and the same shape of answer. A code
 *  is only a code at three letters, so deriving the field's value from
 *  the rule meant the first two keystrokes filtered away to nothing and
 *  the input emptied itself: `BRL` could not be typed at all. What is
 *  shown is what was typed; what is stored is what parses.
 */
function CodesInput({ className, placeholder, value, onChange, }) {
    const settled = (value ?? []).join(', ');
    const [text, setText] = useState(settled);
    const [seed, setSeed] = useState(settled);
    const parse = (raw) => {
        const codes = raw
            .split(',')
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length === 3);
        return codes.length ? codes : undefined;
    };
    // Reseeded only when the rule changed underneath, never from our own
    // keystrokes.
    if (seed !== settled) {
        setSeed(settled);
        if ((parse(text) ?? []).join(', ') !== settled)
            setText(settled);
    }
    return (_jsx("input", { className: className, placeholder: placeholder, value: text, onChange: (event) => {
            setText(event.target.value);
            onChange(parse(event.target.value));
        } }));
}
function WordsInput({ className, placeholder, value, onChange, }) {
    const settled = joinWords(value);
    const [text, setText] = useState(settled);
    const [seed, setSeed] = useState(settled);
    // Reseeded only when the rule changed underneath, never from our own
    // keystrokes: what distinguishes the two is whether the text still
    // splits to what the rule holds.
    if (seed !== settled) {
        setSeed(settled);
        if (joinWords(splitWords(text)) !== settled)
            setText(settled);
    }
    return (_jsx("input", { className: className, placeholder: placeholder, value: text, onChange: (event) => {
            setText(event.target.value);
            onChange(splitWords(event.target.value));
        } }));
}
function splitWords(raw) {
    const words = raw
        .split(',')
        .map((word) => word.trim())
        .filter(Boolean);
    if (words.length === 0)
        return undefined;
    // One word stays a string, so a rule nobody meant to change does not
    // arrive at the server looking different from what we ship.
    return words.length === 1 ? words[0] : words;
}
function conditionSummary(when, t, names) {
    const parts = [];
    // The moment first, because it is the question the old summary could
    // not answer: does this fire when money lands, or when the document is
    // written? "Both" says nothing worth a word, so it says nothing.
    if (when.trigger === 'invoice_issued')
        parts.push(t('reconciliation.cond.onIssue'));
    else if (when.trigger === 'money_arrives')
        parts.push(t('reconciliation.cond.onArrival'));
    // Then the scope filters, which answer "does this even apply?" before
    // the question of how closely the pair has to fit.
    if (when.accounts?.in?.length) {
        parts.push(t('reconciliation.cond.accounts', {
            names: when.accounts.in
                .map((id) => names.accounts.find((a) => a.id === id)?.name ?? '?')
                .join(', '),
        }));
    }
    if (when.payees?.in?.length) {
        parts.push(t('reconciliation.cond.payees', {
            names: when.payees.in
                .map((id) => names.payees.find((p) => p.id === id)?.name ?? '?')
                .join(', '),
        }));
    }
    if (when.direction && when.direction !== 'any') {
        parts.push(t(when.direction === 'credit'
            ? 'reconciliation.cond.moneyIn'
            : 'reconciliation.cond.moneyOut'));
    }
    if (when.currency?.foreign)
        parts.push(t('reconciliation.cond.foreign'));
    if (when.currency?.in?.length)
        parts.push(t('reconciliation.cond.currencyIn', { codes: when.currency.in.join(', ') }));
    if (when.amount?.min)
        parts.push(t('reconciliation.cond.atLeast', { value: when.amount.min }));
    if (when.amount?.max)
        parts.push(t('reconciliation.cond.atMost', { value: when.amount.max }));
    if (when.text?.contains)
        parts.push(t('reconciliation.cond.textContains', { text: joinWords(when.text.contains) }));
    if (when.text?.not_contains)
        parts.push(t('reconciliation.cond.textExcludes', { text: joinWords(when.text.not_contains) }));
    if (when.counterparty === 'same_payee')
        parts.push(t('reconciliation.cond.samePayee'));
    if (when.same_account)
        parts.push(t('reconciliation.cond.sameAccount'));
    if (when.different_account)
        parts.push(t('reconciliation.cond.differentAccount'));
    if (when.account_types?.length)
        parts.push(t('reconciliation.cond.accountTypes', {
            kinds: when.account_types
                .map((kind) => t(ACCOUNT_TYPE_CONFIG[kind]?.label ?? kind))
                .join(', '),
        }));
    if (when.account_name_in_description)
        parts.push(t('reconciliation.cond.accountNamed'));
    if (when.amount?.match === 'exact')
        parts.push(t('reconciliation.cond.amountExact'));
    else if (when.amount?.match === 'tolerance')
        parts.push(t('reconciliation.cond.amountTolerance', { percent: when.amount.percent }));
    else if (when.amount?.match === 'ratio')
        parts.push(t('reconciliation.cond.amountRatio'));
    else if (when.amount?.match === 'partial')
        parts.push(t('reconciliation.cond.amountPartial'));
    else if (when.amount?.match === 'set')
        parts.push(t('reconciliation.cond.amountSet', { count: when.amount.max_invoices ?? 6 }));
    if (when.date)
        parts.push(t('reconciliation.cond.window', {
            before: when.date.before_days,
            after: when.date.after_days,
        }));
    if (when.description_similarity)
        parts.push(t('reconciliation.cond.similarity', { min: when.description_similarity.min }));
    // Last, because both answer the same question and it is the one asked
    // after everything else has already fitted: several candidates got
    // this far, now what?
    if (when.tie_break === 'closest_date')
        parts.push(t('reconciliation.cond.closestDate'));
    if (when.unique_candidate)
        parts.push(t('reconciliation.cond.uniqueCandidate'));
    return parts.join(' · ') || t('reconciliation.cond.none');
}
function OutcomeBadge({ outcome }) {
    const { t } = useTranslation();
    return (_jsxs("span", { className: cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', outcome === 'link'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'), children: [outcome === 'link' ? _jsx(Zap, { size: 10 }) : _jsx(HelpCircle, { size: 10 }), t(outcome === 'link' ? 'reconciliation.outcome.link' : 'reconciliation.outcome.suggest')] }));
}
/** One of the three questions a rule answers, with its heading.
 *
 *  The form used to be a flat list, and two of its fields were both called
 *  "Amount": one asking how close the payment must be to the invoice, the
 *  other asking which payments the rule looks at. Same word, different
 *  question, twenty pixels apart. Splitting them under headings is not
 *  decoration: it is the difference between a form you can read and one
 *  you have to already understand. */
function Step({ index, title, hint, children, }) {
    return (_jsxs("section", { className: "rounded-lg border border-border", children: [_jsxs("header", { className: "px-3 py-2 bg-muted/40 border-b border-border rounded-t-lg", children: [_jsxs("p", { className: "text-sm font-semibold text-foreground", children: [_jsxs("span", { className: "text-muted-foreground mr-1.5", children: [index, "."] }), title] }), hint && _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: hint })] }), _jsx("div", { className: "p-3 space-y-3", children: children })] }));
}
/** Pick none, one, or several: accounts or clients.
 *
 *  Checkboxes rather than a multi-select control because the list is short
 *  and the state that matters is "nothing chosen", which a native
 *  multi-select renders as an empty box that reads like a mistake. Here it
 *  reads as a sentence: *any account*. */
function MultiPicker({ options, selected, onChange, empty, }) {
    if (options.length === 0)
        return null;
    return (_jsxs("div", { className: "mt-0.5 max-h-32 overflow-y-auto rounded-md border border-input divide-y divide-border", children: [selected.length === 0 && (_jsx("p", { className: "px-3 py-1.5 text-xs text-muted-foreground italic", children: empty })), options.map((option) => (_jsxs("label", { className: "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted", children: [_jsx("input", { type: "checkbox", checked: selected.includes(option.id), onChange: (e) => onChange(e.target.checked
                            ? [...selected, option.id]
                            : selected.filter((id) => id !== option.id)) }), _jsx("span", { className: "truncate", children: option.label })] }, option.id)))] }));
}
const EMPTY = {
    counterparty: 'any',
    amount: { match: 'exact' },
    date: { before_days: 5, after_days: 30 },
};
const TRANSFER_NODE = 'reconciliation.match_transfer';
/** What a brand new rule starts as, which is not the same in every set.
 *
 *  A transfer is by definition money crossing between two accounts, so a
 *  rule written here without `different_account` is not a loose transfer
 *  rule: it is one that would pair a debit and a credit sitting on the
 *  *same* account, which is never a transfer and is sometimes a
 *  correction. The window starts at the two days the shipped rules use
 *  rather than the month an invoice is allowed, because a transfer that
 *  takes a month did not happen. */
function blankFor(node) {
    if (node !== TRANSFER_NODE)
        return EMPTY;
    return {
        different_account: true,
        amount: { match: 'exact' },
        date: { before_days: 2, after_days: 2 },
        tie_break: 'closest_date',
        unique_candidate: true,
    };
}
function RuleEditor({ open, node, rule, onClose }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const creating = rule === null;
    const { data: accountList = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: payeeList = [] } = useQuery({
        queryKey: ['payees'],
        queryFn: () => payeesApi.list(),
    });
    const [name, setName] = useState(rule?.name ?? '');
    const [outcome, setOutcome] = useState(rule?.outcome ?? 'suggest');
    // A transfer rule runs at any moment, because both its legs are money
    // moving. Seeding a new one with 'both' keeps the field it cannot show
    // from sending a value that would quietly narrow it.
    const [trigger, setTrigger] = useState(rule?.trigger ?? (node === TRANSFER_NODE ? 'both' : 'money_arrives'));
    const [when, setWhen] = useState(rule?.when ?? blankFor(node));
    // The dialog is mounted once and reused, so it has to be re-seeded
    // whenever it opens, and the seed has to be *forgotten* when it closes.
    // Without the second half, reopening the same rule after cancelling
    // shows the abandoned edits as though they had been saved, which is a
    // worse lie than losing them: the screen would claim a threshold the
    // engine is not running.
    const [seeded, setSeeded] = useState(null);
    const key = `${node}:${rule?.id ?? 'new'}`;
    if (!open && seeded !== null)
        setSeeded(null);
    if (open && seeded !== key) {
        setSeeded(key);
        setName(rule?.name ?? '');
        setOutcome(rule?.outcome ?? 'suggest');
        setTrigger(rule?.trigger ?? (node === TRANSFER_NODE ? 'both' : 'money_arrives'));
        setWhen(rule?.when ?? blankFor(node));
    }
    const save = useMutation({
        mutationFn: async () => {
            if (creating) {
                return reconciliationApi.createRule({ node, name, outcome, trigger, when });
            }
            return reconciliationApi.updateRule(node, rule.id, { outcome, trigger, when });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] });
            toast.success(t('reconciliation.saved'));
            onClose();
        },
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    const amountMatch = when.amount?.match ?? 'exact';
    /** One labelled control inside a step. Keeps the two amount questions
     *  visually distinct even though both are about money. */
    const field = (label, hint, control) => (_jsxs("div", { children: [_jsx(Label, { children: label }), hint && _jsx("p", { className: "text-xs text-muted-foreground mt-0.5 mb-1.5", children: hint }), _jsx("div", { className: hint ? '' : 'mt-1', children: control })] }));
    const inputClass = 'w-full px-3 py-2 text-sm border border-input rounded-md bg-background';
    return (_jsx(Dialog, { open: open, onOpenChange: (next) => { if (!next)
            onClose(); }, children: _jsxs(DialogContent, { className: "max-w-lg max-h-[85vh] flex flex-col", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: creating
                            ? t('reconciliation.newRule')
                            : rule?.name || t(SHIPPED_NAME[rule?.id ?? ''] ?? 'reconciliation.rule.unknown') }) }), _jsxs("div", { className: "space-y-4 flex-1 overflow-y-auto -mx-1 px-1", children: [_jsxs(Step, { index: 1, title: t('reconciliation.step.what'), children: [creating &&
                                    field(t('reconciliation.field.name'), null, _jsx("input", { className: inputClass, value: name, onChange: (e) => setName(e.target.value), placeholder: t('reconciliation.field.namePlaceholder') })), node !== TRANSFER_NODE &&
                                    field(t('reconciliation.field.trigger'), t('reconciliation.field.triggerHint'), _jsx("div", { className: "space-y-1.5", children: ['money_arrives', 'invoice_issued', 'both'].map((value) => (_jsxs("label", { className: cn('flex items-start gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors', trigger === value
                                                ? 'border-primary bg-primary/5'
                                                : 'border-input hover:bg-muted'), children: [_jsx("input", { type: "radio", className: "mt-1", checked: trigger === value, onChange: () => setTrigger(value) }), _jsxs("span", { children: [_jsx("span", { className: "text-sm font-medium block", children: t(`reconciliation.trigger.${value}`) }), _jsx("span", { className: "text-xs text-muted-foreground", children: t(`reconciliation.trigger.${value}Hint`) })] })] }, value))) })), field(t('reconciliation.field.outcome'), t('reconciliation.field.outcomeHint'), _jsx("div", { className: "flex gap-2", children: ['link', 'suggest'].map((value) => (_jsx("button", { type: "button", onClick: () => setOutcome(value), className: cn('flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors', outcome === value
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background border-input text-muted-foreground hover:text-foreground'), children: t(value === 'link'
                                            ? 'reconciliation.outcome.link'
                                            : 'reconciliation.outcome.suggest') }, value))) }))] }), _jsxs(Step, { index: 2, title: t('reconciliation.step.which'), hint: t('reconciliation.step.whichHint'), children: [field(t('reconciliation.field.accounts'), null, _jsx(MultiPicker, { options: accountList.map((a) => ({ id: a.id, label: a.name })), selected: when.accounts?.in ?? [], onChange: (ids) => setWhen({ ...when, accounts: ids.length ? { in: ids } : undefined }), empty: t('reconciliation.field.anyAccount') })), field(t('reconciliation.field.payees'), null, _jsx(MultiPicker, { options: payeeList.map((p) => ({ id: p.id, label: p.name })), selected: when.payees?.in ?? [], onChange: (ids) => setWhen({ ...when, payees: ids.length ? { in: ids } : undefined }), empty: t('reconciliation.field.anyPayee') })), field(t('reconciliation.field.direction'), null, _jsxs("select", { className: inputClass, value: when.direction ?? 'any', onChange: (e) => setWhen({
                                        ...when,
                                        direction: e.target.value,
                                    }), children: [_jsx("option", { value: "any", children: t('reconciliation.direction.any') }), _jsx("option", { value: "credit", children: t('reconciliation.direction.in') }), _jsx("option", { value: "debit", children: t('reconciliation.direction.out') })] })), field(t('reconciliation.field.currencyScope'), null, _jsxs(_Fragment, { children: [_jsx(CodesInput
                                        // Only what was typed is shouted. Uppercasing the
                                        // placeholder too turns a hint into an instruction.
                                        , { 
                                            // Only what was typed is shouted. Uppercasing the
                                            // placeholder too turns a hint into an instruction.
                                            className: `${inputClass} [&:not(:placeholder-shown)]:uppercase`, placeholder: t('reconciliation.field.currencyPlaceholder'), value: when.currency?.in, onChange: (codes) => setWhen({
                                                ...when,
                                                currency: {
                                                    ...(when.currency ?? { conversion: 'reject' }),
                                                    in: codes,
                                                },
                                            }) }), _jsxs("label", { className: "flex items-center gap-2 mt-1.5 text-xs text-muted-foreground cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: !!when.currency?.foreign, onChange: (e) => setWhen({
                                                        ...when,
                                                        currency: {
                                                            ...(when.currency ?? { conversion: 'reject' }),
                                                            foreign: e.target.checked || undefined,
                                                        },
                                                    }) }), t('reconciliation.field.foreignOnly')] })] })), field(t('reconciliation.field.amountBand'), t('reconciliation.field.amountBandHint'), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "number", min: 0, className: inputClass, placeholder: t('reconciliation.field.noMinimum'), value: when.amount?.min ?? '', onChange: (e) => setWhen({
                                                ...when,
                                                amount: {
                                                    ...(when.amount ?? { match: 'exact' }),
                                                    min: e.target.value || undefined,
                                                },
                                            }) }), _jsx("input", { type: "number", min: 0, className: inputClass, placeholder: t('reconciliation.field.noMaximum'), value: when.amount?.max ?? '', onChange: (e) => setWhen({
                                                ...when,
                                                amount: {
                                                    ...(when.amount ?? { match: 'exact' }),
                                                    max: e.target.value || undefined,
                                                },
                                            }) })] })), field(t('reconciliation.field.text'), null, _jsxs(_Fragment, { children: [_jsx(WordsInput, { className: inputClass, placeholder: t('reconciliation.field.textContains'), value: when.text?.contains, onChange: (next) => setWhen({ ...when, text: { ...when.text, contains: next } }) }), _jsx(WordsInput, { className: `${inputClass} mt-1.5`, placeholder: t('reconciliation.field.textExcludes'), value: when.text?.not_contains, onChange: (next) => setWhen({ ...when, text: { ...when.text, not_contains: next } }) }), _jsx("p", { className: "text-[11px] text-muted-foreground mt-1", children: t('reconciliation.field.textHint') })] }))] }), _jsxs(Step, { index: 3, title: t('reconciliation.step.match'), hint: t(node === TRANSFER_NODE ? 'reconciliation.step.matchHintTransfer' : 'reconciliation.step.matchHint'), children: [node === TRANSFER_NODE &&
                                    field(t('reconciliation.field.transferSignals'), t('reconciliation.field.transferSignalsHint'), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { className: "flex items-center gap-2 text-xs text-muted-foreground cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: !!when.account_name_in_description, onChange: (e) => setWhen({
                                                            ...when,
                                                            account_name_in_description: e.target.checked || undefined,
                                                        }) }), t('reconciliation.cond.accountNamed')] }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-muted-foreground cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: when.tie_break === 'closest_date', onChange: (e) => setWhen({
                                                            ...when,
                                                            tie_break: e.target.checked ? 'closest_date' : undefined,
                                                        }) }), t('reconciliation.cond.closestDate')] }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-muted-foreground cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: !!when.unique_candidate, onChange: (e) => setWhen({
                                                            ...when,
                                                            unique_candidate: e.target.checked || undefined,
                                                        }) }), t('reconciliation.cond.uniqueCandidate')] }), _jsxs("div", { className: "pt-1", children: [_jsx("p", { className: "text-xs text-muted-foreground mb-1", children: t('reconciliation.field.accountTypes') }), _jsx("div", { className: "flex flex-wrap gap-x-3 gap-y-1", children: Object.keys(ACCOUNT_TYPE_CONFIG).map((kind) => (_jsxs("label", { className: "flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: !!when.account_types?.includes(kind), onChange: (e) => {
                                                                        const current = when.account_types ?? [];
                                                                        const next = e.target.checked
                                                                            ? [...current, kind]
                                                                            : current.filter((item) => item !== kind);
                                                                        setWhen({
                                                                            ...when,
                                                                            account_types: next.length ? next : undefined,
                                                                        });
                                                                    } }), t(ACCOUNT_TYPE_CONFIG[kind].label)] }, kind))) })] })] })), node !== TRANSFER_NODE &&
                                    field(t('reconciliation.field.counterparty'), null, _jsxs("select", { className: inputClass, value: when.counterparty ?? 'any', onChange: (e) => setWhen({ ...when, counterparty: e.target.value }), children: [_jsx("option", { value: "any", children: t('reconciliation.counterparty.any') }), _jsx("option", { value: "same_payee", children: t('reconciliation.counterparty.samePayee') })] })), field(t('reconciliation.field.amountMatch'), t(node === TRANSFER_NODE ? 'reconciliation.field.amountMatchHintTransfer' : 'reconciliation.field.amountMatchHint'), _jsxs(_Fragment, { children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { className: inputClass, value: amountMatch, onChange: (e) => {
                                                        const match = e.target.value;
                                                        const kept = { min: when.amount?.min, max: when.amount?.max };
                                                        setWhen({
                                                            ...when,
                                                            amount: match === 'tolerance'
                                                                ? { match, percent: when.amount?.percent ?? '2', ...kept }
                                                                : match === 'partial'
                                                                    ? {
                                                                        match,
                                                                        min_ratio: when.amount?.min_ratio ?? '0.05',
                                                                        max_ratio: when.amount?.max_ratio ?? '0.95',
                                                                        ...kept,
                                                                    }
                                                                    : match === 'set'
                                                                        ? {
                                                                            match,
                                                                            max_invoices: when.amount?.max_invoices ?? 6,
                                                                            percent: when.amount?.percent ?? '0',
                                                                            ...kept,
                                                                        }
                                                                        : { match, ...kept },
                                                        });
                                                    }, children: [_jsx("option", { value: "exact", children: t('reconciliation.amount.exact') }), _jsx("option", { value: "partial", children: t('reconciliation.amount.partial') }), _jsx("option", { value: "set", children: t('reconciliation.amount.set') }), _jsx("option", { value: "tolerance", children: t('reconciliation.amount.tolerance') }), _jsx("option", { value: "ratio", children: t('reconciliation.amount.ratio') })] }), amountMatch === 'tolerance' && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("input", { type: "number", min: 0, max: 100, step: "0.5", className: "w-20 px-3 py-2 text-sm border border-input rounded-md bg-background", value: when.amount?.percent ?? '2', onChange: (e) => setWhen({
                                                                ...when,
                                                                amount: {
                                                                    ...(when.amount ?? { match: 'tolerance' }),
                                                                    match: 'tolerance',
                                                                    percent: e.target.value,
                                                                },
                                                            }) }), _jsx("span", { className: "text-sm text-muted-foreground", children: "%" })] }))] }), amountMatch === 'partial' && (_jsx("p", { className: "text-xs text-muted-foreground mt-1", children: t('reconciliation.amount.partialHint') })), amountMatch === 'set' && (_jsxs("div", { className: "mt-1.5 space-y-1.5", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: t('reconciliation.amount.setHint') }), _jsxs("div", { className: "flex gap-2 items-end", children: [_jsxs("label", { className: "flex-1", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('reconciliation.amount.setMax') }), _jsx("input", { type: "number", min: 2, max: 6, className: `${inputClass} mt-0.5`, value: when.amount?.max_invoices ?? 6, onChange: (e) => setWhen({
                                                                        ...when,
                                                                        amount: {
                                                                            ...(when.amount ?? { match: 'set' }),
                                                                            match: 'set',
                                                                            max_invoices: Number(e.target.value),
                                                                        },
                                                                    }) })] }), _jsxs("label", { className: "flex-1", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('reconciliation.amount.setFee') }), _jsxs("div", { className: "flex items-center gap-1 mt-0.5", children: [_jsx("input", { type: "number", min: 0, max: 20, step: "0.5", className: inputClass, value: when.amount?.percent ?? '0', onChange: (e) => setWhen({
                                                                                ...when,
                                                                                amount: {
                                                                                    ...(when.amount ?? { match: 'set' }),
                                                                                    match: 'set',
                                                                                    percent: e.target.value,
                                                                                },
                                                                            }) }), _jsx("span", { className: "text-sm text-muted-foreground", children: "%" })] })] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: t('reconciliation.amount.setFeeHint') })] })), amountMatch === 'ratio' && (_jsx("p", { className: "text-xs text-muted-foreground mt-1", children: t('reconciliation.amount.ratioHint') }))] })), field(t('reconciliation.field.window'), t(node === TRANSFER_NODE ? 'reconciliation.field.windowHintTransfer' : 'reconciliation.field.windowHint'), _jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('reconciliation.field.beforeDays') }), _jsx("input", { type: "number", min: 0, max: 365, className: `${inputClass} mt-0.5`, value: when.date?.before_days ?? 0, onChange: (e) => setWhen({
                                                        ...when,
                                                        date: {
                                                            before_days: Number(e.target.value),
                                                            after_days: when.date?.after_days ?? 0,
                                                        },
                                                    }) })] }), _jsxs("div", { className: "flex-1", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('reconciliation.field.afterDays') }), _jsx("input", { type: "number", min: 0, max: 365, className: `${inputClass} mt-0.5`, value: when.date?.after_days ?? 0, onChange: (e) => setWhen({
                                                        ...when,
                                                        date: {
                                                            before_days: when.date?.before_days ?? 0,
                                                            after_days: Number(e.target.value),
                                                        },
                                                    }) })] })] })), field(t('reconciliation.field.similarity'), t('reconciliation.field.similarityHint'), _jsx("input", { type: "number", min: 0, max: 1, step: "0.05", className: "w-28 px-3 py-2 text-sm border border-input rounded-md bg-background", value: when.description_similarity?.min ?? '', placeholder: t('reconciliation.field.similarityOff'), onChange: (e) => setWhen({
                                        ...when,
                                        description_similarity: e.target.value
                                            ? { min: e.target.value }
                                            : undefined,
                                    }) }))] })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 shrink-0 border-t border-border mt-2", children: [_jsx(Button, { variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { onClick: () => save.mutate(), disabled: save.isPending, children: t('common.save') })] })] }) }));
}
export function ReconciliationRules({ canWrite }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [pending, setPending] = useState(null);
    const fileInput = useRef(null);
    const importTarget = useRef(null);
    const { data: nodes } = useQuery({
        queryKey: ['reconciliation-rules'],
        queryFn: reconciliationApi.rules,
    });
    // Loaded once for the whole list rather than per row: a rule naming
    // three accounts should read as their names, not their ids.
    const { data: accountList = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: () => accountsApi.list(),
    });
    const { data: payeeList = [] } = useQuery({
        queryKey: ['payees'],
        queryFn: () => payeesApi.list(),
    });
    const names = { accounts: accountList, payees: payeeList };
    const toggle = useMutation({
        mutationFn: ({ node, rule }) => reconciliationApi.updateRule(node, rule.id, { enabled: !rule.enabled }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] }),
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    // Moving one rule sends the whole order, because that is what the API
    // takes: an order where some rules are placed and others fall back to
    // where we shipped them reads correctly today and rearranges itself the
    // day a default is inserted.
    const move = useMutation({
        mutationFn: ({ node, ids }) => reconciliationApi.reorderRules(node, ids),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] }),
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    const reset = useMutation({
        mutationFn: ({ node, id }) => reconciliationApi.resetRule(node, id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] });
            toast.success(t('reconciliation.reset'));
        },
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    const remove = useMutation({
        mutationFn: ({ node, id }) => reconciliationApi.deleteRule(node, id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] });
            setDeleting(null);
            toast.success(t('rules.deleted'));
        },
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    const exporting = useMutation({
        mutationFn: (node) => reconciliationApi.exportRules(node),
        onSuccess: () => toast.success(t('reconciliation.exported')),
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    const importing = useMutation({
        mutationFn: ({ file, node }) => reconciliationApi.importRules(file, true, node),
        onSuccess: (result) => {
            void queryClient.invalidateQueries({ queryKey: ['reconciliation-rules'] });
            setPending(null);
            toast.success(t('reconciliation.imported', result));
        },
        onError: (error) => toast.error(extractApiError(error, t('common.error'))),
    });
    async function readFile(file) {
        try {
            const parsed = JSON.parse(await file.text());
            if (parsed.format !== POLICY_FORMAT || !Array.isArray(parsed.nodes)) {
                // A categorization export dropped in here would otherwise arrive
                // as a file with no rules and look like it worked.
                toast.error(t('reconciliation.invalidImportFile'));
                return;
            }
            setPending({
                file: parsed,
                name: file.name,
                node: importTarget.current ?? '',
            });
        }
        catch {
            toast.error(t('reconciliation.invalidImportFile'));
        }
    }
    if (!nodes)
        return null;
    // Nothing here is live for this workspace.
    if (!nodes.some((group) => group.active))
        return null;
    return (_jsxs(_Fragment, { children: [nodes.map((group) => (_jsxs(SectionCard, { children: [_jsxs("div", { className: "px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-foreground flex items-center gap-2", children: [t(CARD_TITLE[group.node] ?? NODE_TITLE[group.node] ?? group.node), !group.active && (_jsx("span", { className: "text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full", children: t('reconciliation.node.inactive') }))] }), _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: t(CARD_HINT[group.node] ?? NODE_HINT[group.node] ?? '') })] }), _jsxs("div", { className: "flex items-center gap-1.5 shrink-0", children: [_jsxs(Button, { size: "sm", variant: "outline", className: "gap-1.5 h-8", onClick: () => exporting.mutate(group.node), disabled: exporting.isPending, children: [_jsx(Download, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.export') })] }), canWrite && (_jsxs(Button, { size: "sm", variant: "outline", className: "gap-1.5 h-8", onClick: () => {
                                            importTarget.current = group.node;
                                            fileInput.current?.click();
                                        }, disabled: importing.isPending, children: [_jsx(Upload, { size: 12 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.import') })] })), canWrite && (_jsxs(Button, { size: "sm", className: "gap-1.5 h-8", onClick: () => setEditing({ node: group.node, rule: null }), children: [_jsx(Plus, { size: 13 }), _jsx("span", { className: "hidden sm:inline", children: t('rules.add') })] }))] })] }), _jsxs("div", { className: "divide-y divide-border", children: [group.rules.map((rule, index) => (_jsx("div", { className: cn('px-4 sm:px-5 py-3 hover:bg-muted transition-colors', canWrite && 'cursor-pointer', !rule.enabled && 'opacity-55'), onClick: () => { if (canWrite)
                                    setEditing({ node: group.node, rule }); }, children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex flex-col items-center shrink-0 pt-0.5", children: [_jsx("span", { className: "text-xs font-semibold text-muted-foreground tabular-nums w-5 text-center", children: index + 1 }), canWrite && group.rules.length > 1 && (_jsxs("div", { className: "flex flex-col -space-y-1 mt-0.5", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: "text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:hover:text-muted-foreground", disabled: index === 0 || move.isPending, title: t('reconciliation.moveUp'), onClick: () => move.mutate({ node: group.node, ids: swap(group.rules, index, index - 1) }), children: _jsx(ChevronUp, { size: 13 }) }), _jsx("button", { className: "text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:hover:text-muted-foreground", disabled: index === group.rules.length - 1 || move.isPending, title: t('reconciliation.moveDown'), onClick: () => move.mutate({ node: group.node, ids: swap(group.rules, index, index + 1) }), children: _jsx(ChevronDown, { size: 13 }) })] }))] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1 flex-wrap", children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: rule.name || t(SHIPPED_NAME[rule.id] ?? 'reconciliation.rule.unknown') }), _jsx(OutcomeBadge, { outcome: rule.outcome }), rule.customised && (_jsx("span", { className: "text-[10px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 rounded-full", children: t(rule.origin === 'custom'
                                                                ? 'reconciliation.yours'
                                                                : 'reconciliation.changed') })), !rule.enabled && (_jsx("span", { className: "text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full", children: t('rules.inactive') }))] }), _jsx("p", { className: "text-xs text-muted-foreground font-mono truncate", children: conditionSummary({ ...rule.when, trigger: rule.trigger }, t, names) })] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { className: cn('p-1.5 rounded-md transition-colors hover:bg-background', rule.enabled
                                                        ? 'text-emerald-600 hover:text-emerald-700'
                                                        : 'text-muted-foreground hover:text-foreground'), title: t(rule.enabled ? 'rules.turnOff' : 'rules.turnOn'), onClick: () => toggle.mutate({ node: group.node, rule }), disabled: toggle.isPending, children: _jsx(Power, { size: 13 }) }), rule.customised && rule.origin === 'default' && (_jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors", title: t('reconciliation.restore'), onClick: () => reset.mutate({ node: group.node, id: rule.id }), disabled: reset.isPending, children: _jsx(RotateCcw, { size: 13 }) })), _jsx("button", { className: "p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors", title: t('common.delete'), onClick: () => setDeleting({ node: group.node, rule }), disabled: remove.isPending, children: _jsx(Trash2, { size: 13 }) })] }))] }) }, rule.id))), group.rules.length === 0 && (_jsx("p", { className: "px-4 sm:px-5 py-6 text-xs text-muted-foreground text-center", children: t('reconciliation.noneLeft') }))] }), group.discarded.length > 0 && (_jsxs("div", { className: "px-4 sm:px-5 py-2.5 bg-muted/30 border-t border-border flex flex-wrap items-center gap-x-2 gap-y-1", children: [_jsx("span", { className: "text-[11px] text-muted-foreground", children: t('reconciliation.discarded') }), group.discarded.map((gone) => (_jsx("button", { className: "text-[11px] font-medium text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2 disabled:opacity-50", disabled: !canWrite || reset.isPending, title: t('reconciliation.restore'), onClick: () => reset.mutate({ node: group.node, id: gone.id }), children: t(SHIPPED_NAME[gone.id] ?? 'reconciliation.rule.unknown') }, gone.id)))] }))] }, group.node))), _jsx("input", { ref: fileInput, type: "file", accept: "application/json,.json", className: "hidden", "data-testid": "reconciliation-import-input", onChange: (event) => {
                    const file = event.target.files?.[0];
                    if (file)
                        void readFile(file);
                    event.target.value = '';
                } }), _jsx(DeleteConfirmationDialog, { open: deleting !== null, title: t('reconciliation.confirmDeleteTitle'), description: t('reconciliation.confirmDeleteDescription', {
                    name: deleting?.rule.name ||
                        t(SHIPPED_NAME[deleting?.rule.id ?? ''] ?? 'reconciliation.rule.unknown'),
                }), isPending: remove.isPending, onClose: () => setDeleting(null), onConfirm: () => deleting && remove.mutate({ node: deleting.node, id: deleting.rule.id }) }), _jsx(Dialog, { open: pending !== null, onOpenChange: (open) => { if (!open)
                    setPending(null); }, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('reconciliation.importConfirmTitle') }) }), _jsxs("div", { className: "space-y-3 text-sm text-muted-foreground", children: [_jsx("p", { children: t('reconciliation.importConfirmDescription', {
                                        count: (pending?.file.nodes ?? []).reduce((sum, node) => sum + node.rules.length, 0),
                                        file: pending?.name ?? '',
                                    }) }), _jsx("p", { className: "font-medium text-amber-600 dark:text-amber-400", children: t('reconciliation.importOverwriteWarning') })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setPending(null), disabled: importing.isPending, children: t('common.cancel') }), _jsx(Button, { type: "button", variant: "destructive", onClick: () => {
                                        if (pending)
                                            importing.mutate({ file: pending.file, node: pending.node });
                                    }, disabled: !pending || importing.isPending, children: t('rules.confirmOverwriteImport') })] })] }) }), _jsx(RuleEditor, { open: editing !== null, node: editing?.node ?? '', rule: editing?.rule ?? null, onClose: () => setEditing(null) })] }));
}
