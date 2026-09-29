import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayLocale, useDateLocale } from '../hooks/use-display-locale.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRegisterPageChatContext } from '../lib/page-chat-context.js';
import { assets, assetGroups, currencies as currenciesApi } from '../lib/api.js';
import { localDateString } from '../lib/date-utils.js';
import { toast } from 'sonner';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '../components/ui/dialog.js';
import { Badge } from '../components/ui/badge.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { DatePickerInput } from '../components/ui/date-picker-input.js';
import { Home, Car, Gem, TrendingUp, Package, Plus, Pencil, Trash2, ChevronDown, ChevronUp, ChevronRight, RefreshCw, Wallet, FolderInput, LineChart, Layers, Bitcoin, PieChart, AlertTriangle, Upload, } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/page-header.js';
import { usePrivacyMode } from '../hooks/use-privacy-mode.js';
import { useAuth } from '../contexts/auth-context.js';
import { useWorkspace } from '../contexts/workspace-context.js';
import { useCollectionFilter } from '../contexts/collection-filter-context.js';
import { getAssetProfit } from '../lib/asset-profit.js';
import { getPortfolioShare, getPortfolioTotalPrimary } from '../lib/asset-portfolio-share.js';
import { formatCurrency } from '../lib/format.js';
// Renders a logo image when one is available, falling back to the asset's
// type-based Lucide icon on missing URL or broken image. Uses the type's
// bg color as a tinted placeholder; switches to a white card + border when
// showing a real logo so brand colors don't clash with our palette.
function AssetIcon({ logoUrl, Icon, colorClass, bgClass, size = 20, tile = 'w-10 h-10', }) {
    const [errored, setErrored] = useState(false);
    const showImage = !!logoUrl && !errored;
    return (_jsx("div", { className: `${tile} rounded-lg flex items-center justify-center overflow-hidden shrink-0 ${showImage ? 'bg-white border border-border' : bgClass}`, children: showImage ? (_jsx("img", { src: logoUrl, alt: "", className: "w-full h-full object-contain", onError: () => setErrored(true) })) : (_jsx(Icon, { size: size, className: colorClass })) }));
}
// Compact relative-time formatter ("2h ago" / "há 2h"). Used for the price
// preview "last updated" hint. Intl.RelativeTimeFormat handles the locale
// grammar so we don't hand-roll plurals. Falls back to absolute date only
// when the input is missing — otherwise always returns a relative string.
function formatRelativeTime(dateInput, locale) {
    if (!dateInput)
        return null;
    const then = new Date(dateInput).getTime();
    if (Number.isNaN(then))
        return null;
    const diffSec = (then - Date.now()) / 1000;
    const absSec = Math.abs(diffSec);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (absSec < 60)
        return rtf.format(Math.round(diffSec), 'second');
    if (absSec < 3600)
        return rtf.format(Math.round(diffSec / 60), 'minute');
    if (absSec < 86400)
        return rtf.format(Math.round(diffSec / 3600), 'hour');
    return rtf.format(Math.round(diffSec / 86400), 'day');
}
const ASSET_TYPE_CONFIG = {
    real_estate: { icon: Home, color: 'text-blue-600', bg: 'bg-blue-100' },
    vehicle: { icon: Car, color: 'text-violet-600', bg: 'bg-violet-100' },
    valuable: { icon: Gem, color: 'text-amber-600', bg: 'bg-amber-100' },
    investment: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    stock: { icon: LineChart, color: 'text-sky-600', bg: 'bg-sky-100' },
    etf: { icon: Layers, color: 'text-teal-600', bg: 'bg-teal-100' },
    crypto: { icon: Bitcoin, color: 'text-orange-600', bg: 'bg-orange-100' },
    fund: { icon: PieChart, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    other: { icon: Package, color: 'text-slate-600', bg: 'bg-slate-100' },
};
function getTypeConfig(type) {
    return ASSET_TYPE_CONFIG[type] ?? ASSET_TYPE_CONFIG['other'];
}
const ASSET_TYPES = [
    'stock',
    'etf',
    'crypto',
    'fund',
    'real_estate',
    'vehicle',
    'valuable',
    'investment',
    'other',
];
// Map a yfinance `quoteType` to Securo's asset type. Lives here (not the
// backend) so if we ever swap the market-price provider the service stays
// clean — all provider-specific vocabulary is translated at the edge.
function assetTypeFromQuoteType(quoteType) {
    switch ((quoteType || '').toUpperCase()) {
        case 'EQUITY':
            return 'stock';
        case 'ETF':
            return 'etf';
        case 'CRYPTOCURRENCY':
            return 'crypto';
        case 'MUTUALFUND':
        case 'INDEX':
            return 'fund';
        default:
            return 'investment';
    }
}
const VALUATION_METHODS = ['manual', 'growth_rule', 'market_price'];
const GROWTH_TYPES = ['percentage', 'absolute'];
const GROWTH_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
// Column template shared by the holdings table header + rows so they align:
// Ativo · Quant. · Preço Médio · Preço Atual · Rentab. · Saldo · % · actions.
const HOLDINGS_GRID = 'minmax(0,2.4fr) 0.7fr 1.1fr 1fr 0.9fr 1.3fr 0.6fr 4.5rem';
// Surface the backend's actual error message (FastAPI puts it in
// response.data.detail) instead of a generic toast. Makes failures
// diagnosable — e.g. the oversell guard message, or a "Not Found" when a
// transaction endpoint is missing because the backend is older than the
// frontend (issue #315) — rather than a cryptic "Error".
function assetErrorMessage(e, fallback) {
    const resp = e?.response;
    const detail = resp?.data?.detail;
    if (typeof detail === 'string' && detail.trim())
        return detail;
    return resp?.status ? `${fallback} (${resp.status})` : fallback;
}
export default function AssetsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const locale = useDisplayLocale();
    const dateLocale = useDateLocale();
    const { mask } = usePrivacyMode();
    const { user } = useAuth();
    const { canWrite } = useWorkspace();
    const userCurrency = user?.preferences?.currency_display ?? 'USD';
    const queryClient = useQueryClient();
    const { data: supportedCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.list,
        staleTime: Infinity,
    });
    const [activeTab, setActiveTab] = useState('holdings');
    // Holding id for the lightweight "add transaction to this holding" dialog,
    // opened from the holdings table ("+ add buys") and the inline ledger.
    const [addTxAssetId, setAddTxAssetId] = useState(null);
    const openAddTransaction = (id) => setAddTxAssetId(id);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [pendingGrowthSave, setPendingGrowthSave] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    // Wallet (AssetGroup) dialog state
    const [walletDialogOpen, setWalletDialogOpen] = useState(false);
    const [editingWallet, setEditingWallet] = useState(null);
    const [walletFormName, setWalletFormName] = useState('');
    const [walletFormColor, setWalletFormColor] = useState('#0EA5E9');
    const [deletingWalletId, setDeletingWalletId] = useState(null);
    // Collapsed wallet IDs — default is expanded (empty set), user can collapse manually
    const [collapsedWallets, setCollapsedWallets] = useState(new Set());
    // Asset being moved to a wallet (null = no picker open)
    const [movingAsset, setMovingAsset] = useState(null);
    // Form state
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState('other');
    const [formCurrency, setFormCurrency] = useState(userCurrency);
    const [formGroupId, setFormGroupId] = useState('');
    const [formMethod, setFormMethod] = useState('manual');
    // Tracks "+ New wallet" clicked from inside the asset dialog so the
    // newly-created wallet auto-fills the picker on success.
    const pendingAssignWalletToFormRef = useRef(false);
    const [formPurchaseDate, setFormPurchaseDate] = useState('');
    const [formPurchasePrice, setFormPurchasePrice] = useState('');
    const [formSellDate, setFormSellDate] = useState('');
    const [formSellPrice, setFormSellPrice] = useState('');
    const [formCurrentValue, setFormCurrentValue] = useState('');
    const [formGrowthType, setFormGrowthType] = useState('percentage');
    const [formGrowthRate, setFormGrowthRate] = useState('');
    const [formGrowthFrequency, setFormGrowthFrequency] = useState('monthly');
    const [formGrowthStartDate, setFormGrowthStartDate] = useState('');
    // Market-price form state
    const [formTickerQuery, setFormTickerQuery] = useState('');
    const [tickerMatches, setTickerMatches] = useState([]);
    const [tickerSearchLoading, setTickerSearchLoading] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState(null);
    const [formUnits, setFormUnits] = useState('');
    // Per-unit purchase price for the opening buy of a market-priced holding.
    // Defaults to the live quote (buying at market now) and is the SAME input
    // model as the buy/sell ledger — no total-purchase-price for tickers, so
    // "Add asset" and "Add transaction" stay consistent.
    const [formUnitPrice, setFormUnitPrice] = useState('');
    const [quoteLoading, setQuoteLoading] = useState(false);
    const { data: rawAssetsList, isLoading } = useQuery({
        queryKey: ['assets'],
        queryFn: () => assets.list(false),
    });
    // Active Collection filter (issue #105): when a collection is active, scope
    // the Assets page to the assets in its wallets (asset_groups). A collection
    // with no wallets → no assets shown. "All accounts" (null) → show everything.
    const { activeWalletIds } = useCollectionFilter();
    const assetsList = useMemo(() => {
        if (!activeWalletIds)
            return rawAssetsList;
        const allowed = new Set(activeWalletIds);
        return (rawAssetsList ?? []).filter((a) => a.group_id && allowed.has(a.group_id));
    }, [rawAssetsList, activeWalletIds]);
    const { data: rawPortfolioData } = useQuery({
        queryKey: ['portfolio-trend'],
        queryFn: () => assets.portfolioTrend(),
    });
    // Scope the portfolio chart + total to the active collection's wallets too.
    // Trend rows are keyed by asset id, so we keep only the in-collection asset
    // columns and recompute each row's `_total`.
    const portfolioData = useMemo(() => {
        if (!activeWalletIds || !rawPortfolioData)
            return rawPortfolioData;
        const allowed = new Set(activeWalletIds);
        const keptAssets = rawPortfolioData.assets.filter((a) => a.group_id && allowed.has(a.group_id));
        const keptIds = new Set(keptAssets.map((a) => a.id));
        const trend = rawPortfolioData.trend.map((row) => {
            const next = { date: row.date };
            let total = 0;
            for (const [k, v] of Object.entries(row)) {
                if (k === 'date' || k === '_total')
                    continue;
                if (keptIds.has(k)) {
                    next[k] = v;
                    total += Number(v) || 0;
                }
            }
            next._total = total;
            return next;
        });
        const lastTotal = trend.length ? Number(trend[trend.length - 1]._total) || 0 : 0;
        return { ...rawPortfolioData, assets: keptAssets, trend, total: lastTotal };
    }, [rawPortfolioData, activeWalletIds]);
    // Publish a snapshot of what's on the Assets page so the global chat
    // (⌘J) can answer "what does this chart mean / what are these
    // wallets?" without needing the user to spell it out.
    const totalValue = (assetsList ?? []).reduce((acc, a) => acc + Number(a.current_value || 0), 0);
    const byType = {};
    for (const a of (assetsList ?? [])) {
        if (!a.type)
            continue;
        byType[a.type] = (byType[a.type] || 0) + Number(a.current_value || 0);
    }
    const portfolioTotal = portfolioData?.total;
    const assetsCtxKey = `${assetsList?.length ?? 0}:${totalValue.toFixed(2)}:${portfolioTotal ?? ''}`;
    useRegisterPageChatContext({
        path: '/assets',
        label: 'Assets',
        summary: `Portfolio overview page. ${assetsList?.length ?? 0} assets totaling ` +
            `~${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ` +
            `(by current_value). The portfolio chart shows value over time grouped by wallet or asset.`,
        totals_by_type: byType,
        asset_count: assetsList?.length ?? 0,
        total_value: Number(totalValue.toFixed(2)),
        hint: 'For exact per-asset numbers, use the get_net_worth or list_assets tools.',
    }, assetsCtxKey);
    // `refetchQueries` (vs. `invalidateQueries`) forces an immediate refetch
    // regardless of stale-state heuristics. Our global staleTime of 5 min
    // combined with the dialog-close re-render was sometimes leaving the
    // asset list showing pre-edit data until the user manually reloaded.
    function refetchAssetViews() {
        queryClient.refetchQueries({ queryKey: ['assets'] });
        queryClient.refetchQueries({ queryKey: ['portfolio-trend'] });
        queryClient.refetchQueries({ queryKey: ['dashboard'] });
    }
    const createMutation = useMutation({
        mutationFn: (data) => assets.create(data),
        onSuccess: () => {
            refetchAssetViews();
            setDialogOpen(false);
            toast.success(t('assets.created'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, _regenerateGrowth, ...data }) => assets.update(id, data, { regenerateGrowth: _regenerateGrowth }),
        onSuccess: () => {
            refetchAssetViews();
            setDialogOpen(false);
            setEditingAsset(null);
            toast.success(t('assets.updated'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => assets.delete(id),
        onSuccess: () => {
            refetchAssetViews();
            setDeletingId(null);
            if (expandedId === deletingId)
                setExpandedId(null);
            toast.success(t('assets.deleted'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const refreshPriceMutation = useMutation({
        mutationFn: (id) => assets.refreshPrice(id),
        onSuccess: (updated) => {
            // Sync the dialog's preview to the fresh quote so the user sees the
            // new price without closing the dialog. The list + chart refetch
            // via our standard helper.
            setSelectedQuote({
                symbol: updated.ticker || '',
                name: updated.name,
                exchange: updated.ticker_exchange,
                currency: updated.currency,
                price: updated.last_price ?? 0,
                quote_type: null,
            });
            setEditingAsset(updated);
            refetchAssetViews();
            toast.success(t('assets.priceRefreshed'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const { data: rawWalletsList } = useQuery({
        queryKey: ['asset-groups'],
        queryFn: () => assetGroups.list(),
    });
    const walletsList = useMemo(() => {
        if (!activeWalletIds)
            return rawWalletsList;
        const allowed = new Set(activeWalletIds);
        return (rawWalletsList ?? []).filter((w) => allowed.has(w.id));
    }, [rawWalletsList, activeWalletIds]);
    const createWalletMutation = useMutation({
        mutationFn: (data) => assetGroups.create({ name: data.name, color: data.color, icon: 'wallet' }),
        onSuccess: (created) => {
            queryClient.refetchQueries({ queryKey: ['asset-groups'] });
            setWalletDialogOpen(false);
            setEditingWallet(null);
            if (pendingAssignWalletToFormRef.current) {
                setFormGroupId(created.id);
                pendingAssignWalletToFormRef.current = false;
            }
            toast.success(t('assets.walletCreated'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const updateWalletMutation = useMutation({
        mutationFn: ({ id, ...data }) => assetGroups.update(id, { name: data.name, color: data.color }),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['asset-groups'] });
            setWalletDialogOpen(false);
            setEditingWallet(null);
            toast.success(t('assets.walletUpdated'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const deleteWalletMutation = useMutation({
        mutationFn: (id) => assetGroups.delete(id),
        onSuccess: () => {
            // Deleting a wallet un-groups its assets (backend sets group_id=null).
            queryClient.refetchQueries({ queryKey: ['asset-groups'] });
            queryClient.refetchQueries({ queryKey: ['assets'] });
            setDeletingWalletId(null);
            toast.success(t('assets.walletDeleted'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const moveAssetMutation = useMutation({
        mutationFn: ({ id, groupId }) => assets.update(id, { group_id: groupId }),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['assets'] });
            queryClient.refetchQueries({ queryKey: ['asset-groups'] });
            setMovingAsset(null);
            toast.success(t('assets.moved'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    // Compute projected current value for growth_rule preview in the form
    const projectedGrowthValue = useMemo(() => {
        if (formMethod !== 'growth_rule')
            return null;
        const baseAmount = parseFloat(formPurchasePrice);
        const rate = parseFloat(formGrowthRate);
        if (!baseAmount || !rate || !formGrowthFrequency)
            return null;
        const startDate = formGrowthStartDate || formPurchaseDate;
        if (!startDate)
            return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let current = baseAmount;
        let d = new Date(startDate + 'T00:00:00');
        let iterations = 0;
        while (iterations < 10000) {
            const next = new Date(d);
            if (formGrowthFrequency === 'daily')
                next.setDate(next.getDate() + 1);
            else if (formGrowthFrequency === 'weekly')
                next.setDate(next.getDate() + 7);
            else if (formGrowthFrequency === 'monthly')
                next.setMonth(next.getMonth() + 1);
            else if (formGrowthFrequency === 'yearly')
                next.setFullYear(next.getFullYear() + 1);
            else
                break;
            if (next > today)
                break;
            if (formGrowthType === 'percentage') {
                current = current * (1 + rate / 100);
            }
            else {
                current = current + rate;
            }
            d = next;
            iterations++;
        }
        return Math.round(current * 100) / 100;
    }, [formMethod, formPurchasePrice, formGrowthRate, formGrowthType, formGrowthFrequency, formGrowthStartDate, formPurchaseDate]);
    const activeAssets = useMemo(() => assetsList?.filter(a => !a.sell_date && !a.is_archived) ?? [], [assetsList]);
    const soldAssets = assetsList?.filter(a => a.sell_date) ?? [];
    // Denominator for the "% of portfolio" column: current holdings only, in the
    // user's primary currency, so the active rows add up to 100%.
    const portfolioTotalPrimary = getPortfolioTotalPrimary(activeAssets);
    // Debounced ticker search. Runs only when the market-price method is
    // selected and the query is non-trivial — keeps the autocomplete snappy
    // without flooding the yfinance-backed endpoint.
    useEffect(() => {
        if (formMethod !== 'market_price')
            return;
        const q = formTickerQuery.trim();
        // Don't search if the field matches the already-selected quote — the
        // user just picked it and we'd spam the endpoint for no reason.
        if (selectedQuote && q === selectedQuote.symbol)
            return;
        if (q.length < 1) {
            setTickerMatches([]);
            return;
        }
        setTickerSearchLoading(true);
        const handle = window.setTimeout(async () => {
            try {
                const results = await assets.marketSearch(q, 10);
                setTickerMatches(results);
            }
            catch {
                setTickerMatches([]);
            }
            finally {
                setTickerSearchLoading(false);
            }
        }, 300);
        return () => window.clearTimeout(handle);
    }, [formMethod, formTickerQuery, selectedQuote]);
    async function pickTickerMatch(match) {
        setTickerMatches([]);
        setFormTickerQuery(match.symbol);
        setQuoteLoading(true);
        try {
            const quote = await assets.marketQuote(match.symbol);
            setSelectedQuote(quote);
            // Prefill the unit price with the live quote — "buying at market now"
            // is the common case; the user overrides it with their real cost.
            // Trim float noise to the DB's 6-decimal scale (39.41999… → 39.42).
            setFormUnitPrice(String(Number(quote.price.toFixed(6))));
            // Auto-fill name/currency from the authoritative quote so the user
            // doesn't have to think about it — they can still edit name after.
            if (!formName || formName === (selectedQuote?.name ?? selectedQuote?.symbol ?? '')) {
                setFormName(quote.name || quote.symbol);
            }
            setFormCurrency(quote.currency);
            // Classify the asset from the quote type (EQUITY → stock, etc.) so
            // the Tipo dropdown lands on something meaningful by default. We
            // skip this when the user already picked a non-default type, so
            // manual overrides stick.
            const suggestedType = assetTypeFromQuoteType(quote.quote_type);
            if (formType === 'other' || formType === 'investment') {
                setFormType(suggestedType);
            }
        }
        catch {
            toast.error(t('common.error'));
            setSelectedQuote(null);
        }
        finally {
            setQuoteLoading(false);
        }
    }
    function resetMarketPriceForm() {
        setFormTickerQuery('');
        setTickerMatches([]);
        setSelectedQuote(null);
        setFormUnits('');
        setFormUnitPrice('');
        setQuoteLoading(false);
        setTickerSearchLoading(false);
    }
    function openCreate() {
        setEditingAsset(null);
        setFormName('');
        setFormType('other');
        setFormCurrency(userCurrency);
        setFormGroupId('');
        setFormMethod('manual');
        setFormPurchaseDate('');
        setFormPurchasePrice('');
        setFormSellDate('');
        setFormSellPrice('');
        setFormCurrentValue('');
        setFormGrowthType('percentage');
        setFormGrowthRate('');
        setFormGrowthFrequency('monthly');
        setFormGrowthStartDate('');
        resetMarketPriceForm();
        setDialogOpen(true);
    }
    function openEdit(asset) {
        setEditingAsset(asset);
        setFormName(asset.name);
        setFormType(asset.type);
        setFormCurrency(asset.currency);
        setFormGroupId(asset.group_id ?? '');
        setFormMethod(asset.valuation_method);
        setFormPurchaseDate(asset.purchase_date ?? '');
        setFormPurchasePrice(asset.purchase_price?.toString() ?? '');
        setFormSellDate(asset.sell_date ?? '');
        setFormSellPrice(asset.sell_price?.toString() ?? '');
        setFormCurrentValue('');
        setFormGrowthType(asset.growth_type ?? 'percentage');
        setFormGrowthRate(asset.growth_rate?.toString() ?? '');
        setFormGrowthFrequency(asset.growth_frequency ?? 'monthly');
        setFormGrowthStartDate(asset.growth_start_date ?? '');
        resetMarketPriceForm();
        if (asset.valuation_method === 'market_price' && asset.ticker) {
            setFormTickerQuery(asset.ticker);
            setFormUnits(asset.units?.toString() ?? '');
            // Synthesize a quote from the cached fields so the preview shows
            // immediately — we skip a round-trip to yfinance on edit open.
            if (asset.last_price != null) {
                setSelectedQuote({
                    symbol: asset.ticker,
                    name: asset.name,
                    exchange: asset.ticker_exchange,
                    currency: asset.currency,
                    price: asset.last_price,
                    quote_type: null,
                });
            }
        }
        setDialogOpen(true);
    }
    // Holdings driven by the transactions ledger: quantity, buy date and cost
    // basis come from the transactions, not from this form.
    const editingIsLedgerBacked = !!editingAsset
        && editingAsset.valuation_method === 'market_price'
        && (editingAsset.average_price != null || (editingAsset.transaction_count ?? 0) > 0);
    function buildPayload() {
        const isMarket = formMethod === 'market_price';
        const ledgerBacked = editingIsLedgerBacked;
        const payload = {
            name: formName,
            type: formType,
            currency: formCurrency,
            group_id: formGroupId || null,
            valuation_method: formMethod,
        };
        // A ledger-backed holding derives its buy date, quantity and cost basis
        // from its transactions, so an edit must not overwrite them.
        if (!ledgerBacked) {
            payload.purchase_date = formPurchaseDate || null;
        }
        // Tickers have no total purchase price: the cost basis is derived from
        // the unit-price buy (and then the ledger). Only manual/growth assets
        // carry a total purchase price and sale info. On edit a ticker leaves
        // these fields untouched instead of clearing them.
        if (!isMarket) {
            payload.purchase_price = formPurchasePrice ? parseFloat(formPurchasePrice) : null;
            payload.sell_date = formSellDate || null;
            payload.sell_price = formSellPrice ? parseFloat(formSellPrice) : null;
        }
        else if (!editingAsset) {
            payload.purchase_price = null;
            payload.sell_date = null;
            payload.sell_price = null;
        }
        if (formMethod === 'growth_rule') {
            payload.growth_type = formGrowthType;
            payload.growth_rate = formGrowthRate ? parseFloat(formGrowthRate) : null;
            payload.growth_frequency = formGrowthFrequency;
            payload.growth_start_date = formGrowthStartDate || null;
        }
        if (isMarket) {
            payload.ticker = (selectedQuote?.symbol || formTickerQuery || '').toUpperCase();
            payload.ticker_exchange = selectedQuote?.exchange ?? null;
            if (!ledgerBacked) {
                payload.units = formUnits ? parseFloat(formUnits) : null;
            }
            // Opening buy price per unit (defaults to the live quote on the server
            // when omitted). Only meaningful on create.
            if (!editingAsset) {
                payload.unit_price = formUnitPrice ? parseFloat(formUnitPrice) : null;
            }
        }
        if (!editingAsset && formCurrentValue) {
            payload.current_value = parseFloat(formCurrentValue);
        }
        return payload;
    }
    function hasGrowthParamsChanged() {
        if (!editingAsset || editingAsset.valuation_method !== 'growth_rule')
            return false;
        return (formGrowthType !== (editingAsset.growth_type ?? 'percentage') ||
            formGrowthRate !== (editingAsset.growth_rate?.toString() ?? '') ||
            formGrowthFrequency !== (editingAsset.growth_frequency ?? 'monthly') ||
            formGrowthStartDate !== (editingAsset.growth_start_date ?? '') ||
            formPurchasePrice !== (editingAsset.purchase_price?.toString() ?? '') ||
            formPurchaseDate !== (editingAsset.purchase_date ?? ''));
    }
    function handleSave() {
        const payload = buildPayload();
        if (editingAsset) {
            // If growth params changed, ask confirmation before regenerating
            if (hasGrowthParamsChanged() && editingAsset.value_count > 0) {
                setPendingGrowthSave(payload);
                return;
            }
            updateMutation.mutate({ id: editingAsset.id, ...payload });
        }
        else {
            createMutation.mutate(payload);
        }
    }
    function confirmRegenerateGrowth() {
        if (!editingAsset || !pendingGrowthSave)
            return;
        updateMutation.mutate({ id: editingAsset.id, ...pendingGrowthSave, _regenerateGrowth: true });
        setPendingGrowthSave(null);
    }
    // Consolidated holdings table (issue #235). One row per holding (ticker),
    // Investidor10/Status Invest style: Ativo · Quant. · Preço Médio ·
    // Preço Atual · Rentabilidade · Saldo · % da carteira. Market-priced rows
    // are fully populated; holdings with no recorded cost show "—" for the
    // cost-based columns and offer a one-tap way to add their buys.
    function renderHoldingRow(asset) {
        const config = getTypeConfig(asset.type);
        const Icon = config.icon;
        const isExpanded = expandedId === asset.id;
        const isSynced = asset.source !== 'manual';
        const isMarketPriced = asset.valuation_method === 'market_price';
        const isProviderOwned = isSynced && !isMarketPriced;
        const hasCost = asset.average_price != null && asset.total_invested != null;
        const profit = getAssetProfit(asset);
        const pctOfPortfolio = asset.sell_date ? null : getPortfolioShare(asset, portfolioTotalPrimary);
        const needsBuys = isMarketPriced && !hasCost && !asset.sell_date;
        return (_jsxs("div", { className: "border-b border-border last:border-b-0", children: [_jsxs("div", { className: "grid items-center gap-2 px-3 py-3 cursor-pointer hover:bg-muted/20 transition-colors text-sm", style: { gridTemplateColumns: HOLDINGS_GRID }, onClick: () => setExpandedId(isExpanded ? null : asset.id), children: [_jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [_jsx(AssetIcon, { logoUrl: asset.logo_url, Icon: Icon, colorClass: config.color, bgClass: config.bg, size: 16, tile: "w-8 h-8" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "font-semibold text-foreground truncate", children: asset.ticker && !asset.ticker.startsWith('TD:') ? asset.ticker : asset.name }), needsBuys && (_jsxs(Badge, { variant: "outline", className: "text-[9px] px-1 py-0 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 gap-0.5 shrink-0", title: t('assets.noPriceWarning'), children: [_jsx(AlertTriangle, { size: 9 }), t('assets.noPriceBadge')] })), asset.sell_date && (_jsx(Badge, { variant: "outline", className: "text-[9px] px-1 py-0 text-rose-600 border-rose-200", children: t('assets.sold') })), isSynced && !isMarketPriced && (_jsx(Badge, { variant: "outline", className: "text-[9px] px-1 py-0 text-sky-600 border-sky-200", children: t('assets.synced') }))] }), _jsx("span", { className: "text-[11px] text-muted-foreground truncate block", children: asset.ticker && !asset.ticker.startsWith('TD:') ? asset.name : (asset.ticker?.startsWith('TD:') ? 'Tesouro Direto' : t(`assets.type${asset.type.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase())}`)) })] })] }), _jsx("div", { className: "text-right tabular-nums text-muted-foreground", children: asset.units != null ? mask(`${asset.units}`) : '—' }), _jsx("div", { className: "text-right tabular-nums", children: asset.average_price != null ? mask(formatCurrency(asset.average_price, asset.currency, locale)) : (needsBuys && canWrite ? (_jsxs("button", { onClick: (e) => { e.stopPropagation(); openAddTransaction(asset.id); }, className: "text-[11px] font-medium text-primary hover:underline", children: ["+ ", t('assets.addBuys')] })) : _jsx("span", { className: "text-muted-foreground", children: "\u2014" })) }), _jsx("div", { className: "text-right tabular-nums text-muted-foreground", children: asset.last_price != null ? mask(formatCurrency(asset.last_price, asset.currency, locale)) : '—' }), _jsx("div", { className: "text-right tabular-nums", children: profit ? (_jsxs("span", { className: profit.amount >= 0 ? 'text-emerald-600' : 'text-rose-500', children: [_jsxs("span", { className: "block", children: [profit.amount >= 0 ? '+' : '', mask(formatCurrency(profit.amount, asset.currency, locale))] }), profit.percentage != null && (_jsxs("span", { className: "block text-[10px]", children: [profit.percentage >= 0 ? '+' : '', profit.percentage.toFixed(1), "%"] }))] })) : _jsx("span", { className: "text-muted-foreground", children: "\u2014" }) }), _jsx("div", { className: "text-right tabular-nums", children: asset.current_value != null ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "font-semibold text-foreground", children: mask(formatCurrency(asset.current_value, asset.currency, locale)) }), asset.current_value_primary != null && asset.currency !== userCurrency && (_jsx("span", { className: "block text-[10px] text-muted-foreground", children: mask(formatCurrency(asset.current_value_primary, userCurrency, locale)) }))] })) : _jsx("span", { className: "text-muted-foreground", children: "\u2014" }) }), _jsx("div", { className: "text-right tabular-nums text-muted-foreground", children: pctOfPortfolio != null ? `${pctOfPortfolio.toFixed(1)}%` : '—' }), _jsxs("div", { className: "flex items-center justify-end gap-0.5", children: [canWrite && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); setMovingAsset(asset); }, title: t('assets.moveToWallet'), className: "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors", children: _jsx(FolderInput, { size: 13 }) }), _jsx("button", { onClick: (e) => { e.stopPropagation(); if (!isProviderOwned)
                                                openEdit(asset); }, disabled: isProviderOwned, title: isProviderOwned ? t('assets.syncedReadOnly') : t('common.edit'), className: "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(Pencil, { size: 13 }) }), _jsx("button", { onClick: (e) => { e.stopPropagation(); if (!isProviderOwned)
                                                setDeletingId(asset.id); }, disabled: isProviderOwned, title: isProviderOwned ? t('assets.syncedReadOnly') : t('common.delete'), className: "p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(Trash2, { size: 13 }) })] })), isExpanded ? _jsx(ChevronUp, { size: 15, className: "text-muted-foreground" }) : _jsx(ChevronDown, { size: 15, className: "text-muted-foreground" })] })] }), isExpanded && (isMarketPriced ? (_jsxs(_Fragment, { children: [_jsx(AssetDetail, { assetId: asset.id, currency: asset.currency, locale: locale, dateLocale: dateLocale, purchasePrice: asset.purchase_price, purchaseDate: asset.purchase_date, valuationMethod: asset.valuation_method, canWrite: canWrite, chartOnly: true }), _jsx(HoldingLedger, { asset: asset, locale: locale, dateLocale: dateLocale, mask: mask, canWrite: canWrite, onAdd: () => openAddTransaction(asset.id), onChanged: refetchAssetViews })] })) : (_jsx(AssetDetail, { assetId: asset.id, currency: asset.currency, locale: locale, dateLocale: dateLocale, purchasePrice: asset.purchase_price, purchaseDate: asset.purchase_date, valuationMethod: asset.valuation_method, canWrite: canWrite })))] }, asset.id));
    }
    // Column header for a holdings section — same grid template as the rows.
    function renderHoldingsHeader() {
        return (_jsxs("div", { className: "grid items-center gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border", style: { gridTemplateColumns: HOLDINGS_GRID }, children: [_jsx("div", { children: t('assets.colAsset') }), _jsx("div", { className: "text-right", children: t('assets.colQuantity') }), _jsx("div", { className: "text-right", children: t('assets.colAvgPrice') }), _jsx("div", { className: "text-right", children: t('assets.colCurrentPrice') }), _jsx("div", { className: "text-right", children: t('assets.colReturn') }), _jsx("div", { className: "text-right", children: t('assets.colBalance') }), _jsx("div", { className: "text-right", children: t('assets.colPortfolioPct') }), _jsx("div", {})] }));
    }
    // Wrap a set of holding rows in a horizontally-scrollable table shell so the
    // columns stay aligned (and usable on narrow screens).
    function renderHoldingsTable(rows) {
        return (_jsx("div", { className: "rounded-xl border border-border bg-card shadow-sm overflow-x-auto", children: _jsxs("div", { className: "min-w-[720px]", children: [renderHoldingsHeader(), rows.map(renderHoldingRow)] }) }));
    }
    // Bucket active assets by group_id so each wallet renders with its
    // total and collapse toggle. Un-grouped actives go under a synthetic
    // bucket rendered at the end.
    const assetsByGroup = useMemo(() => {
        const map = new Map();
        for (const a of activeAssets) {
            const key = a.group_id ?? null;
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(a);
        }
        return map;
    }, [activeAssets]);
    const sortedWallets = useMemo(() => {
        return (walletsList ?? []).slice().sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }, [walletsList]);
    const ungroupedAssets = assetsByGroup.get(null) ?? [];
    function toggleWalletCollapse(id) {
        setCollapsedWallets(prev => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function openCreateWallet() {
        setEditingWallet(null);
        setWalletFormName('');
        setWalletFormColor('#0EA5E9');
        setWalletDialogOpen(true);
    }
    function openEditWallet(wallet) {
        setEditingWallet(wallet);
        setWalletFormName(wallet.name);
        setWalletFormColor(wallet.color);
        setWalletDialogOpen(true);
    }
    function handleSaveWallet() {
        const name = walletFormName.trim();
        if (!name)
            return;
        if (editingWallet) {
            updateWalletMutation.mutate({ id: editingWallet.id, name, color: walletFormColor });
        }
        else {
            createWalletMutation.mutate({ name, color: walletFormColor });
        }
    }
    function renderWalletSection(wallet, walletAssets) {
        const isCollapsed = collapsedWallets.has(wallet.id);
        const isSynced = wallet.source !== 'manual';
        // Sum in wallet's reported current_value (already computed by backend).
        // Fall back to per-asset sum if the rollup is stale after a move.
        const total = walletAssets.reduce((s, a) => s + (a.current_value_primary ?? a.current_value ?? 0), 0) || wallet.current_value_primary || wallet.current_value;
        // Only show the institution as a subtitle when it's actually
        // additional information — if the user hasn't renamed the wallet,
        // name and institution are identical and the subtitle would be
        // redundant noise.
        const showInstitutionSubtitle = !!wallet.institution_name && wallet.institution_name !== wallet.name;
        return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-3 px-1", children: [_jsxs("button", { onClick: () => toggleWalletCollapse(wallet.id), className: "flex items-center gap-2 flex-1 min-w-0 group", children: [isCollapsed ? (_jsx(ChevronRight, { size: 14, className: "text-muted-foreground" })) : (_jsx(ChevronDown, { size: 14, className: "text-muted-foreground" })), _jsx("div", { className: "w-6 h-6 rounded-md flex items-center justify-center shrink-0", style: { backgroundColor: `${wallet.color}20` }, children: _jsx(Wallet, { size: 13, style: { color: wallet.color } }) }), _jsxs("div", { className: "flex flex-col items-start min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0 w-full", children: [_jsx("span", { className: "text-sm font-semibold text-foreground truncate", children: wallet.name }), _jsxs("span", { className: "text-xs text-muted-foreground shrink-0", children: ["\u00B7 ", walletAssets.length, " ", t('assets.itemsCount')] })] }), showInstitutionSubtitle && (_jsxs("span", { className: "text-[11px] text-muted-foreground truncate flex items-center gap-1", children: [_jsx(RefreshCw, { size: 9 }), t('assets.syncedFrom', { source: wallet.institution_name })] }))] })] }), _jsx("span", { className: "text-sm font-bold tabular-nums text-foreground shrink-0", children: mask(formatCurrency(total, userCurrency, locale)) }), canWrite && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => openEditWallet(wallet), className: "p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors", title: t('assets.editWallet'), children: _jsx(Pencil, { size: 12 }) }), !isSynced && (_jsx("button", { onClick: () => setDeletingWalletId(wallet.id), className: "p-1 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors", title: t('assets.deleteWallet'), children: _jsx(Trash2, { size: 12 }) }))] }))] }), !isCollapsed && walletAssets.length > 0 && (_jsx("div", { className: "pl-4", children: renderHoldingsTable(walletAssets) })), !isCollapsed && walletAssets.length === 0 && (_jsx("div", { className: "pl-4 py-3 text-xs text-muted-foreground italic", children: t('assets.emptyWallet') }))] }, wallet.id));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { section: t('assets.title'), title: t('assets.title'), action: canWrite ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { onClick: () => navigate('/import?tab=investments'), variant: "outline", className: "gap-1.5", children: [_jsx(Upload, { size: 16 }), t('assetImport.action')] }), _jsxs(Button, { onClick: openCreateWallet, variant: "outline", className: "gap-1.5", children: [_jsx(Wallet, { size: 16 }), t('assets.newWallet')] }), _jsxs(Button, { onClick: openCreate, className: "gap-1.5", children: [_jsx(Plus, { size: 16 }), t('assets.addAsset')] })] })) : undefined }), _jsxs("div", { className: "inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/40", children: [_jsx("button", { onClick: () => setActiveTab('holdings'), className: `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'holdings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t('assets.tabHoldings') }), _jsx("button", { onClick: () => setActiveTab('transactions'), className: `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'transactions' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t('assets.tabTransactions') })] }), activeTab === 'transactions' ? (_jsx(AssetTransactionsTab, { holdings: assetsList ?? [], wallets: sortedWallets, locale: locale, dateLocale: dateLocale, mask: mask, canWrite: canWrite, onChanged: refetchAssetViews })) : (_jsxs(_Fragment, { children: [portfolioData && portfolioData.trend.length > 0 && (_jsx(PortfolioChart, { data: portfolioData, wallets: sortedWallets, currency: userCurrency, locale: locale, dateLocale: dateLocale, mask: mask })), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => _jsx(Skeleton, { className: "h-16 rounded-xl" }, i)) })) : (_jsxs("div", { className: "space-y-6", children: [(sortedWallets.length > 0 || ungroupedAssets.length > 0) && (_jsxs("div", { className: "space-y-4", children: [sortedWallets.map(w => renderWalletSection(w, assetsByGroup.get(w.id) ?? [])), ungroupedAssets.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1", children: sortedWallets.length > 0 ? t('assets.ungrouped') : t('assets.activeAssets') }), renderHoldingsTable(ungroupedAssets)] }))] })), soldAssets.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1", children: t('assets.soldAssets') }), renderHoldingsTable(soldAssets)] })), activeAssets.length === 0 && soldAssets.length === 0 && (_jsxs("div", { className: "text-center py-16", children: [_jsx(Package, { className: "mx-auto h-12 w-12 text-muted-foreground/40 mb-3" }), _jsx("p", { className: "text-muted-foreground", children: t('assets.noAssets') })] }))] }))] })), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { className: "max-w-lg max-h-[90vh] overflow-y-auto", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingAsset ? t('assets.editAsset') : t('assets.addAsset') }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.name') }), _jsx(Input, { value: formName, onChange: e => setFormName(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { children: t('assets.wallet') }), _jsxs("button", { type: "button", className: "text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline", disabled: createWalletMutation.isPending, onClick: () => {
                                                        pendingAssignWalletToFormRef.current = true;
                                                        openCreateWallet();
                                                    }, children: ["+ ", t('assets.newWallet')] })] }), _jsxs("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full", value: formGroupId, onChange: e => setFormGroupId(e.target.value), children: [_jsx("option", { value: "", children: t('assets.noWallet') }), sortedWallets.map(w => (_jsx("option", { value: w.id, children: w.name }, w.id)))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.type') }), _jsx("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full", value: formType, onChange: e => setFormType(e.target.value), children: ASSET_TYPES.map(at => (_jsx("option", { value: at, children: t(`assets.type${at.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase())}`) }, at))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.currency') }), _jsx("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full disabled:opacity-60 disabled:cursor-not-allowed", value: formCurrency, disabled: formMethod === 'market_price', onChange: e => setFormCurrency(e.target.value), children: (supportedCurrencies ?? [{ code: userCurrency, symbol: userCurrency, name: userCurrency, flag: '' }]).map((c) => (_jsxs("option", { value: c.code, children: [c.flag, " ", c.name] }, c.code))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.valuationMethod') }), _jsx("div", { className: "grid gap-2 grid-cols-3", children: VALUATION_METHODS.map(m => (_jsx("button", { type: "button", disabled: !!editingAsset, className: `px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${formMethod === m
                                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                                    : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/50'} ${editingAsset ? 'opacity-50 cursor-not-allowed' : ''}`, onClick: () => !editingAsset && setFormMethod(m), children: m === 'market_price'
                                                    ? t('assets.marketPrice')
                                                    : m === 'growth_rule'
                                                        ? t('assets.growthRule')
                                                        : t('assets.manual') }, m))) })] }), formMethod === 'market_price' && (_jsxs("div", { className: "space-y-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.ticker') }), _jsxs("div", { className: "relative", children: [_jsx(Input, { placeholder: t('assets.tickerPlaceholder'), value: formTickerQuery, disabled: !!editingAsset, onChange: e => {
                                                                setFormTickerQuery(e.target.value);
                                                                // Clear the quote so we don't keep the old preview
                                                                // while the user is editing the symbol — prevents
                                                                // a stale price from being saved accidentally.
                                                                if (selectedQuote && e.target.value.toUpperCase() !== selectedQuote.symbol) {
                                                                    setSelectedQuote(null);
                                                                }
                                                            } }), tickerMatches.length > 0 && !editingAsset && (_jsx("div", { className: "absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg", children: tickerMatches.map(match => {
                                                                // Tesouro bonds carry an internal TD:* symbol — show
                                                                // the readable name instead of the hash for those.
                                                                const isBond = match.symbol.startsWith('TD:');
                                                                return (_jsxs("button", { type: "button", onClick: () => pickTickerMatch(match), className: "flex flex-col w-full text-left px-3 py-2 hover:bg-muted transition-colors", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "font-semibold text-sm truncate", children: isBond ? (match.name ?? match.symbol) : match.symbol }), match.exchange && (_jsx("span", { className: "text-xs text-muted-foreground shrink-0", children: match.exchange }))] }), match.name && !isBond && (_jsx("span", { className: "text-xs text-muted-foreground truncate", children: match.name }))] }, `${match.symbol}-${match.exchange ?? ''}`));
                                                            }) })), tickerSearchLoading && (_jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none", children: t('common.loading') }))] })] }), selectedQuote && (_jsx("div", { className: "rounded-lg border border-border bg-card p-3 text-sm", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex flex-col min-w-0", children: [_jsx("span", { className: "font-semibold truncate", children: selectedQuote.symbol.startsWith('TD:') ? (selectedQuote.name ?? selectedQuote.symbol) : selectedQuote.symbol }), selectedQuote.name && !selectedQuote.symbol.startsWith('TD:') && (_jsx("span", { className: "text-xs text-muted-foreground truncate", children: selectedQuote.name })), editingAsset?.last_price_at && (_jsx("span", { className: "text-[10px] text-muted-foreground mt-0.5", children: t('assets.lastUpdated', { when: formatRelativeTime(editingAsset.last_price_at, dateLocale) }) }))] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-base font-bold tabular-nums", children: formatCurrency(selectedQuote.price, selectedQuote.currency, locale) }), selectedQuote.exchange && (_jsx("div", { className: "text-[10px] text-muted-foreground uppercase tracking-wide", children: selectedQuote.exchange }))] }), editingAsset && (_jsx("button", { type: "button", onClick: () => refreshPriceMutation.mutate(editingAsset.id), disabled: refreshPriceMutation.isPending, title: t('assets.refreshPrice'), className: "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed", children: _jsx(RefreshCw, { size: 14, className: refreshPriceMutation.isPending ? 'animate-spin' : '' }) }))] })] }) })), !editingAsset ? (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.quantity') }), _jsx(Input, { type: "number", step: "any", min: "0", value: formUnits, onChange: e => setFormUnits(e.target.value), placeholder: "10" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.unitPrice') }), _jsx(Input, { type: "number", step: "any", min: "0", value: formUnitPrice, onChange: e => setFormUnitPrice(e.target.value), placeholder: selectedQuote ? String(selectedQuote.price) : '0.00' })] })] })) : (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.quantity') }), _jsx(Input, { type: "number", step: "any", min: "0", value: formUnits, onChange: e => setFormUnits(e.target.value), placeholder: "10", disabled: editingIsLedgerBacked })] })), !editingAsset && formUnits && parseFloat(formUnits) > 0 && (selectedQuote || formUnitPrice) && (_jsxs("div", { className: "flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/10", children: [_jsx("span", { className: "text-xs font-medium text-primary/80", children: t('assets.txTotal') }), _jsx("span", { className: "text-lg font-bold tabular-nums text-primary", children: formatCurrency((parseFloat(formUnitPrice) || selectedQuote?.price || 0) * parseFloat(formUnits), selectedQuote?.currency || formCurrency, locale) })] })), quoteLoading && (_jsx("div", { className: "text-xs text-muted-foreground", children: t('common.loading') }))] })), formMethod === 'growth_rule' && (_jsxs("div", { className: "space-y-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.growthType') }), _jsx("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full", value: formGrowthType, onChange: e => setFormGrowthType(e.target.value), children: GROWTH_TYPES.map(gt => (_jsx("option", { value: gt, children: t(`assets.${gt}`) }, gt))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.growthRate') }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "number", step: "any", value: formGrowthRate, onChange: e => setFormGrowthRate(e.target.value), className: formGrowthType === 'percentage' ? 'pr-8' : '' }), formGrowthType === 'percentage' && (_jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none", children: "%" }))] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.growthFrequency') }), _jsx("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full", value: formGrowthFrequency, onChange: e => setFormGrowthFrequency(e.target.value), children: GROWTH_FREQUENCIES.map(gf => (_jsx("option", { value: gf, children: t(`assets.${gf}`) }, gf))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.growthStartDate') }), _jsx(DatePickerInput, { value: formGrowthStartDate, onChange: setFormGrowthStartDate })] })] })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.purchaseDate') }), _jsx(DatePickerInput, { value: formPurchaseDate, onChange: setFormPurchaseDate, disabled: editingIsLedgerBacked })] }), formMethod !== 'market_price' && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.purchasePrice') }), _jsx(Input, { type: "number", step: "0.01", value: formPurchasePrice, onChange: e => setFormPurchasePrice(e.target.value) })] }))] }), formMethod !== 'market_price' && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.sellDate') }), _jsx(DatePickerInput, { value: formSellDate, onChange: setFormSellDate })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.sellPrice') }), _jsx(Input, { type: "number", step: "0.01", value: formSellPrice, onChange: e => setFormSellPrice(e.target.value) })] })] })), !editingAsset && formMethod === 'manual' && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.currentValue') }), _jsx(Input, { type: "number", step: "any", value: formCurrentValue, onChange: e => setFormCurrentValue(e.target.value) })] })), formMethod === 'growth_rule' && projectedGrowthValue != null && (() => {
                                    const base = parseFloat(formPurchasePrice) || 0;
                                    const isLoss = projectedGrowthValue < base;
                                    const diff = projectedGrowthValue - base;
                                    return (_jsxs("div", { className: `flex items-center justify-between p-3.5 rounded-xl border ${isLoss ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'}`, children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-medium text-muted-foreground", children: t('assets.currentValue') }), base > 0 && (_jsxs("p", { className: `text-[11px] tabular-nums font-medium mt-0.5 ${isLoss ? 'text-rose-500' : 'text-emerald-600'}`, children: [diff >= 0 ? '+' : '', formatCurrency(diff, formCurrency, locale)] }))] }), _jsx("span", { className: `text-xl font-bold tabular-nums ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`, children: formatCurrency(projectedGrowthValue, formCurrency, locale) })] }));
                                })()] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: handleSave, disabled: !formName
                                        || createMutation.isPending
                                        || updateMutation.isPending
                                        // Market-price guard: must have a resolved ticker + quantity.
                                        || (formMethod === 'market_price'
                                            && !editingAsset
                                            && (!selectedQuote || !formUnits || parseFloat(formUnits) <= 0)), children: t('common.save') })] })] }) }), _jsx(Dialog, { open: !!pendingGrowthSave, onOpenChange: () => setPendingGrowthSave(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('assets.confirmRegenerateTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('assets.confirmRegenerate') }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setPendingGrowthSave(null), children: t('common.cancel') }), _jsx(Button, { onClick: confirmRegenerateGrowth, disabled: updateMutation.isPending, children: t('assets.regenerate') })] })] }) }), _jsx(Dialog, { open: !!deletingId, onOpenChange: () => setDeletingId(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('assets.confirmDeleteTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('assets.confirmDelete') }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeletingId(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => deletingId && deleteMutation.mutate(deletingId), disabled: deleteMutation.isPending, children: t('common.delete') })] })] }) }), _jsx(Dialog, { open: walletDialogOpen, onOpenChange: setWalletDialogOpen, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingWallet ? t('assets.editWallet') : t('assets.newWallet') }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.walletName') }), _jsx(Input, { value: walletFormName, onChange: e => setWalletFormName(e.target.value), placeholder: t('assets.walletNamePlaceholder'), autoFocus: true }), editingWallet?.institution_name && editingWallet.source !== 'manual' && (_jsxs("p", { className: "text-[11px] text-muted-foreground flex items-center gap-1", children: [_jsx(RefreshCw, { size: 10 }), t('assets.syncedFromHint', { source: editingWallet.institution_name })] }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.walletColor') }), _jsx(Input, { type: "color", value: walletFormColor, onChange: e => setWalletFormColor(e.target.value), className: "h-9 w-20 px-1 py-1" })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setWalletDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: handleSaveWallet, disabled: !walletFormName.trim() || createWalletMutation.isPending || updateWalletMutation.isPending, children: t('common.save') })] })] }) }), _jsx(Dialog, { open: !!deletingWalletId, onOpenChange: () => setDeletingWalletId(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('assets.confirmDeleteWalletTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('assets.confirmDeleteWallet') }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeletingWalletId(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => deletingWalletId && deleteWalletMutation.mutate(deletingWalletId), disabled: deleteWalletMutation.isPending, children: t('common.delete') })] })] }) }), _jsx(Dialog, { open: !!movingAsset, onOpenChange: () => setMovingAsset(null), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('assets.moveToWallet') }) }), _jsxs("div", { className: "space-y-1 max-h-80 overflow-y-auto", children: [_jsxs("button", { onClick: () => movingAsset && moveAssetMutation.mutate({ id: movingAsset.id, groupId: null }), disabled: !movingAsset?.group_id || moveAssetMutation.isPending, className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left", children: [_jsx("div", { className: "w-6 h-6 rounded-md flex items-center justify-center bg-muted", children: _jsx(Package, { size: 13, className: "text-muted-foreground" }) }), _jsx("span", { className: "text-sm text-foreground", children: t('assets.noWallet') })] }), sortedWallets.map(w => (_jsxs("button", { onClick: () => movingAsset && moveAssetMutation.mutate({ id: movingAsset.id, groupId: w.id }), disabled: movingAsset?.group_id === w.id || moveAssetMutation.isPending, className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left", children: [_jsx("div", { className: "w-6 h-6 rounded-md flex items-center justify-center", style: { backgroundColor: `${w.color}20` }, children: _jsx(Wallet, { size: 13, style: { color: w.color } }) }), _jsx("span", { className: "text-sm text-foreground flex-1 truncate", children: w.name }), _jsx("span", { className: "text-xs text-muted-foreground", children: w.asset_count })] }, w.id))), sortedWallets.length === 0 && (_jsx("p", { className: "text-xs text-muted-foreground italic px-3 py-2", children: t('assets.noWalletsHint') }))] })] }) }), _jsx(AddHoldingTransactionDialog, { assetId: addTxAssetId, holding: (assetsList ?? []).find((a) => a.id === addTxAssetId) ?? null, locale: locale, onClose: () => setAddTxAssetId(null), onChanged: refetchAssetViews })] }));
}
const PORTFOLIO_COLORS = ['#6366F1', '#F43F5E', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
function PortfolioChart({ data, wallets, currency, locale: loc, dateLocale: dateLoc, mask }) {
    const { t } = useTranslation();
    // Default to wallet mode: with many synced CDBs the asset view turns
    // into a cluttered rainbow legend that's hard to parse. Keep stacked as
    // the default drawing style, while letting users switch to true lines when
    // they need to compare each wallet/asset's own value instead of the running
    // cumulative total.
    const [mode, setMode] = useState('wallet');
    const [drawMode, setDrawMode] = useState('stacked');
    const isStacked = drawMode === 'stacked';
    const formatCompact = (v) => {
        const abs = Math.abs(v);
        if (abs >= 1_000_000)
            return `${(v / 1_000_000).toFixed(1)}M`;
        if (abs >= 1_000)
            return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
        return v.toLocaleString(loc, { maximumFractionDigits: 0 });
    };
    // Compute the series list and rewrite trend rows based on the selected
    // mode. Wallet mode rolls all assets sharing a group_id into a single
    // series (using the wallet's own color); ungrouped assets keep their
    // individual lines so nothing disappears from the chart.
    const { series, displayTrend } = useMemo(() => {
        if (mode === 'asset') {
            const s = data.assets.map((a, i) => ({
                key: a.id,
                name: a.name,
                color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length],
                sourceAssetIds: [a.id],
            }));
            return { series: s, displayTrend: data.trend };
        }
        const walletById = new Map();
        for (const w of wallets)
            walletById.set(w.id, w);
        const groupBuckets = new Map();
        const ungroupedAssetIds = [];
        for (const a of data.assets) {
            if (a.group_id) {
                if (!groupBuckets.has(a.group_id))
                    groupBuckets.set(a.group_id, []);
                groupBuckets.get(a.group_id).push(a.id);
            }
            else {
                ungroupedAssetIds.push(a.id);
            }
        }
        // Preserve wallet display order. Falls back to insertion order for
        // wallets that show up in the data but aren't in the wallets list
        // (e.g. race conditions between queries).
        const orderedGroupIds = [
            ...wallets.map(w => w.id).filter(id => groupBuckets.has(id)),
            ...Array.from(groupBuckets.keys()).filter(id => !walletById.has(id)),
        ];
        const s = [];
        let fallbackColorIdx = 0;
        for (const gid of orderedGroupIds) {
            const wallet = walletById.get(gid);
            const assetIds = groupBuckets.get(gid);
            s.push({
                key: `w_${gid}`,
                name: wallet?.name ?? t('assets.ungrouped'),
                color: wallet?.color ?? PORTFOLIO_COLORS[fallbackColorIdx++ % PORTFOLIO_COLORS.length],
                sourceAssetIds: assetIds,
            });
        }
        for (const aid of ungroupedAssetIds) {
            const asset = data.assets.find(a => a.id === aid);
            s.push({
                key: aid,
                name: asset?.name ?? aid,
                color: PORTFOLIO_COLORS[fallbackColorIdx++ % PORTFOLIO_COLORS.length],
                sourceAssetIds: [aid],
            });
        }
        const newTrend = data.trend.map(row => {
            const newRow = { date: row.date, _total: row._total };
            for (const entry of s) {
                let sum = 0;
                for (const aid of entry.sourceAssetIds) {
                    sum += row[aid] ?? 0;
                }
                newRow[entry.key] = sum;
            }
            return newRow;
        });
        return { series: s, displayTrend: newTrend };
    }, [mode, data, wallets, t]);
    const sortedSeries = useMemo(() => {
        const lastRow = displayTrend[displayTrend.length - 1];
        if (!lastRow)
            return series;
        return [...series].sort((a, b) => {
            const av = Math.abs(lastRow[a.key] ?? 0);
            const bv = Math.abs(lastRow[b.key] ?? 0);
            return bv - av || a.name.localeCompare(b.name);
        });
    }, [series, displayTrend]);
    return (_jsxs("div", { className: "border border-border rounded-xl bg-card shadow-sm p-5", children: [_jsxs("div", { className: "flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: t('assets.portfolioValue') }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("div", { role: "group", "aria-label": t('assets.chartGroupMode'), className: "inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/40", children: [_jsx("button", { type: "button", "aria-pressed": mode === 'wallet', onClick: () => setMode('wallet'), className: `px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === 'wallet' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t('assets.chartByWallet') }), _jsx("button", { type: "button", "aria-pressed": mode === 'asset', onClick: () => setMode('asset'), className: `px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === 'asset' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t('assets.chartByAsset') })] }), _jsxs("div", { role: "group", "aria-label": t('assets.chartDrawMode'), className: "inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/40", children: [_jsx("button", { type: "button", "aria-pressed": drawMode === 'stacked', onClick: () => setDrawMode('stacked'), className: `px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${drawMode === 'stacked' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t('assets.chartStacked') }), _jsx("button", { type: "button", "aria-pressed": drawMode === 'lines', onClick: () => setDrawMode('lines'), className: `px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${drawMode === 'lines' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`, children: t('assets.chartLines') })] })] })] }), _jsxs("div", { className: "text-left sm:text-right", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: t('assets.total') }), _jsx("p", { className: "text-lg font-bold tabular-nums text-foreground", children: mask(formatCurrency(data.total, currency, loc)) })] })] }), _jsx("div", { className: "h-56", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: displayTrend, margin: { top: 4, right: 12, left: 0, bottom: 0 }, children: [_jsx("defs", { children: isStacked && sortedSeries.map(s => (_jsxs("linearGradient", { id: `portfolio-grad-${s.key}`, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: s.color, stopOpacity: 0.5 }), _jsx("stop", { offset: "100%", stopColor: s.color, stopOpacity: 0.1 })] }, s.key))) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "var(--border)", strokeOpacity: 0.5 }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, tickFormatter: (v) => new Date(v + 'T00:00:00').toLocaleDateString(dateLoc, { month: 'short', year: '2-digit' }) }), _jsx(YAxis, { tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, width: 56, tickFormatter: (v) => mask(formatCompact(v)) }), _jsx(RechartsTooltip, { content: ({ active, payload, label }) => {
                                    if (!active || !payload?.length)
                                        return null;
                                    const row = displayTrend.find(r => r.date === label);
                                    const dateTotal = row ? (row._total ?? 0) : 0;
                                    const items = sortedSeries
                                        .map(s => {
                                        const val = row ? (row[s.key] ?? 0) : 0;
                                        return { key: s.key, name: s.name, value: val, color: s.color };
                                    })
                                        .filter(item => item.value !== 0);
                                    if (items.length === 0)
                                        return null;
                                    return (_jsxs("div", { style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '10px 12px' }, children: [_jsx("p", { style: { fontWeight: 600, marginBottom: 6 }, children: new Date(label + 'T00:00:00').toLocaleDateString(dateLoc, { day: 'numeric', month: 'long', year: 'numeric' }) }), items.map(item => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' } }), item.name] }), _jsx("span", { style: { fontWeight: 500, fontVariantNumeric: 'tabular-nums' }, children: mask(formatCurrency(item.value, currency, loc)) })] }, item.key))), _jsxs("div", { style: { borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }, children: [_jsx("span", { children: t('assets.total') }), _jsx("span", { style: { fontVariantNumeric: 'tabular-nums' }, children: mask(formatCurrency(dateTotal, currency, loc)) })] })] }));
                                } }), sortedSeries.map(s => (_jsx(Area, { type: "monotone", dataKey: s.key, stackId: isStacked ? 'portfolio' : undefined, stroke: s.color, strokeWidth: isStacked ? 1 : 2, fill: isStacked ? `url(#portfolio-grad-${s.key})` : 'none', dot: false, activeDot: { r: 3, strokeWidth: 1.5, fill: 'var(--card)' } }, s.key))), _jsx(Area, { dataKey: "_total", stroke: "none", fill: "none", dot: false, activeDot: false, hide: !isStacked })] }) }) }), _jsx("div", { className: "flex flex-wrap gap-x-4 gap-y-1 mt-3 px-1", children: sortedSeries.map(s => (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("div", { className: "w-2.5 h-2.5 rounded-full", style: { backgroundColor: s.color } }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: s.name })] }, s.key))) })] }));
}
// Marker drawn on the value chart where a buy (green) or sell (red) happened.
// Recharts calls this per data point; non-trade points render an empty group.
function renderAssetTradeDot(props) {
    const { cx, cy, index, payload } = props;
    const trades = payload?.trades;
    if (cx == null || cy == null || !trades || trades.length === 0) {
        return _jsx("g", {}, `td-${index}`);
    }
    const hasBuy = trades.some(t => t.kind === 'buy');
    const hasSell = trades.some(t => t.kind === 'sell');
    const color = hasSell && !hasBuy ? '#F43F5E' : hasBuy && !hasSell ? '#10B981' : '#6366F1';
    return (_jsx("circle", { cx: cx, cy: cy, r: 4, fill: color, stroke: "var(--card)", strokeWidth: 1.5 }, `td-${index}`));
}
function AssetDetail({ assetId, currency, locale: loc, dateLocale: dateLoc, purchasePrice, purchaseDate, valuationMethod, canWrite, chartOnly = false }) {
    const { t } = useTranslation();
    const { mask } = usePrivacyMode();
    const queryClient = useQueryClient();
    const [valueAmount, setValueAmount] = useState('');
    const [valueDate, setValueDate] = useState(localDateString);
    const { data: values, isLoading: valuesLoading } = useQuery({
        queryKey: ['asset-values', assetId],
        queryFn: () => assets.values(assetId),
    });
    const { data: trend } = useQuery({
        queryKey: ['asset-trend', assetId],
        queryFn: () => assets.valueTrend(assetId),
    });
    // Build full trend: purchase point + stored values
    const trendWithPurchase = useMemo(() => {
        if (!trend)
            return [];
        let result = [...trend];
        // Prepend purchase point if it predates the first value
        if (purchasePrice && purchaseDate) {
            if (result.length === 0 || purchaseDate < result[0].date) {
                result = [{ date: purchaseDate, amount: purchasePrice }, ...result];
            }
        }
        return result;
    }, [trend, purchasePrice, purchaseDate]);
    // Buy/sell markers on the value chart (shares the ledger's query cache).
    // Without these, a jump in the line could be either a price move or a
    // quantity change — the markers label "you bought/sold here".
    const { data: assetTrades } = useQuery({
        queryKey: ['asset-transactions', assetId],
        queryFn: () => assets.transactions(assetId),
        enabled: valuationMethod === 'market_price',
    });
    const chartData = useMemo(() => {
        const pts = trendWithPurchase.map(p => ({ ...p, trades: [] }));
        if (!assetTrades || pts.length === 0)
            return pts;
        for (const tx of assetTrades) {
            const txTime = new Date(tx.date + 'T00:00:00').getTime();
            let best = 0;
            let bestDiff = Infinity;
            for (let i = 0; i < pts.length; i++) {
                const diff = Math.abs(new Date(pts[i].date + 'T00:00:00').getTime() - txTime);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    best = i;
                }
            }
            pts[best].trades.push(tx);
        }
        return pts;
    }, [trendWithPurchase, assetTrades]);
    // Build value history with purchase as the initial entry
    const valuesWithPurchase = useMemo(() => {
        if (!values)
            return [];
        if (!purchasePrice || !purchaseDate)
            return values;
        const hasPurchaseValue = values.some(v => v.date === purchaseDate && v.amount === purchasePrice);
        if (hasPurchaseValue)
            return values;
        const purchaseEntry = {
            id: 'purchase',
            asset_id: assetId,
            amount: purchasePrice,
            date: purchaseDate,
            source: 'purchase',
        };
        return [...values, purchaseEntry];
    }, [values, purchasePrice, purchaseDate, assetId]);
    const addValueMutation = useMutation({
        mutationFn: ({ assetId: id, ...data }) => assets.addValue(id, data),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['assets'] });
            queryClient.refetchQueries({ queryKey: ['asset-values', assetId] });
            queryClient.refetchQueries({ queryKey: ['asset-trend', assetId] });
            queryClient.refetchQueries({ queryKey: ['portfolio-trend'] });
            queryClient.refetchQueries({ queryKey: ['dashboard'] });
            setValueAmount('');
            toast.success(t('assets.valueAdded'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const deleteValueMutation = useMutation({
        mutationFn: (valueId) => assets.deleteValue(valueId),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['assets'] });
            queryClient.refetchQueries({ queryKey: ['asset-values', assetId] });
            queryClient.refetchQueries({ queryKey: ['asset-trend', assetId] });
            queryClient.refetchQueries({ queryKey: ['portfolio-trend'] });
            queryClient.refetchQueries({ queryKey: ['dashboard'] });
            toast.success(t('assets.valueDeleted'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    // Determine chart color based on trend direction
    const trendIsPositive = trendWithPurchase.length >= 2
        ? trendWithPurchase[trendWithPurchase.length - 1].amount >= trendWithPurchase[0].amount
        : true;
    const chartColor = trendIsPositive ? '#10B981' : '#F43F5E';
    const hasChart = trendWithPurchase.length > 1;
    // In chart-only mode (market-priced holdings, paired with the ledger) there's
    // nothing to show until the value series has at least two points.
    if (chartOnly && !hasChart)
        return null;
    return (_jsxs("div", { className: "border-t border-border px-5 py-5 space-y-5 bg-muted/5", children: [hasChart && (_jsxs("div", { children: [_jsx("p", { className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3", children: t('assets.valueTrend') }), _jsx("div", { className: "h-44 -mx-1", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: chartData, margin: { top: 4, right: 12, left: 0, bottom: 0 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: `gradient-${assetId}`, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: chartColor, stopOpacity: 0.2 }), _jsx("stop", { offset: "100%", stopColor: chartColor, stopOpacity: 0 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "var(--border)", strokeOpacity: 0.5 }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, tickFormatter: (v) => new Date(v + 'T00:00:00').toLocaleDateString(dateLoc, { month: 'short', year: '2-digit' }) }), _jsx(YAxis, { tick: { fontSize: 10, fill: 'var(--muted-foreground)' }, axisLine: false, tickLine: false, width: 56, domain: ['dataMin', 'dataMax'], tickFormatter: (v) => {
                                            const abs = Math.abs(v);
                                            let formatted;
                                            if (abs >= 1_000_000)
                                                formatted = `${(v / 1_000_000).toFixed(1)}M`;
                                            else if (abs >= 1_000)
                                                formatted = `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
                                            else
                                                formatted = v.toLocaleString(loc, { maximumFractionDigits: 0 });
                                            return mask(formatted);
                                        } }), _jsx(RechartsTooltip, { content: ({ active, payload, label }) => {
                                            if (!active || !payload?.length)
                                                return null;
                                            const pt = payload[0].payload;
                                            return (_jsxs("div", { style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '8px 10px' }, children: [_jsx("p", { style: { fontWeight: 600, marginBottom: 4 }, children: new Date(String(label) + 'T00:00:00').toLocaleDateString(dateLoc, { day: 'numeric', month: 'long', year: 'numeric' }) }), _jsx("div", { style: { fontVariantNumeric: 'tabular-nums' }, children: mask(formatCurrency(pt.amount ?? 0, currency, loc)) }), pt.trades?.map((tx) => (_jsxs("div", { style: { marginTop: 3, fontSize: 11, fontWeight: 500, color: tx.kind === 'buy' ? '#10B981' : '#F43F5E' }, children: [tx.kind === 'buy' ? t('assets.txBuy') : t('assets.txSell'), " ", mask(`${tx.quantity}`), " \u00D7 ", mask(formatCurrency(tx.price, currency, loc))] }, tx.id)))] }));
                                        } }), _jsx(Area, { type: "monotone", dataKey: "amount", stroke: chartColor, strokeWidth: 2, fill: `url(#gradient-${assetId})`, dot: renderAssetTradeDot, activeDot: { r: 4, strokeWidth: 2, fill: 'var(--card)', stroke: chartColor } })] }) }) })] })), !chartOnly && valuationMethod === 'manual' && canWrite && _jsxs("div", { className: "flex items-end gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx(Label, { className: "text-[11px] text-muted-foreground", children: t('assets.amount') }), _jsx(Input, { type: "number", step: "any", value: valueAmount, onChange: e => setValueAmount(e.target.value), placeholder: "0.00", className: "h-8 text-sm" })] }), _jsxs("div", { className: "w-36", children: [_jsx(Label, { className: "text-[11px] text-muted-foreground", children: t('assets.date') }), _jsx(DatePickerInput, { value: valueDate, onChange: setValueDate })] }), _jsxs(Button, { size: "sm", className: "h-8 px-3 text-xs", disabled: !valueAmount || addValueMutation.isPending, onClick: () => {
                            if (valueAmount) {
                                addValueMutation.mutate({
                                    assetId,
                                    amount: parseFloat(valueAmount),
                                    date: valueDate,
                                });
                            }
                        }, children: [_jsx(Plus, { size: 14, className: "mr-1" }), t('assets.addValue')] })] }), !chartOnly && _jsxs("div", { children: [_jsx("p", { className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2", children: t('assets.valueHistory') }), valuesLoading ? (_jsx(Skeleton, { className: "h-20 w-full rounded-lg" })) : valuesWithPurchase.length > 0 ? (_jsx("div", { className: "rounded-lg border border-border overflow-hidden divide-y divide-border", children: valuesWithPurchase.map((v, idx) => {
                            const isPurchase = v.source === 'purchase';
                            // Calculate change from previous entry (next in array since sorted desc)
                            const prev = valuesWithPurchase[idx + 1];
                            const change = prev ? v.amount - prev.amount : null;
                            const changePct = prev && prev.amount !== 0 ? (change / prev.amount) * 100 : null;
                            return (_jsxs("div", { className: `flex items-center justify-between py-2 px-3 transition-colors ${isPurchase ? 'bg-primary/5' : 'hover:bg-muted/30'}`, children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("span", { className: "text-sm tabular-nums font-semibold text-foreground", children: mask(formatCurrency(v.amount, currency, loc)) }), change != null && (_jsxs("span", { className: `text-[11px] tabular-nums font-medium ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`, children: [change >= 0 ? '+' : '', mask(formatCurrency(change, currency, loc)), changePct != null && ` (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`] }))] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx(Badge, { variant: isPurchase ? 'default' : 'outline', className: `text-[10px] px-1.5 py-0 ${isPurchase ? 'bg-primary/15 text-primary border-primary/30' : ''}`, children: t(`assets.source${v.source.charAt(0).toUpperCase() + v.source.slice(1)}`) }), _jsx("span", { className: "text-[11px] text-muted-foreground tabular-nums", children: new Date(v.date + 'T00:00:00').toLocaleDateString(dateLoc) }), valuationMethod === 'manual' && v.source === 'manual' && canWrite && (_jsx("button", { onClick: () => deleteValueMutation.mutate(v.id), className: "p-1 rounded text-muted-foreground/40 hover:text-rose-600 transition-colors", disabled: deleteValueMutation.isPending, title: t('common.delete'), children: _jsx(Trash2, { size: 12 }) }))] })] }, v.id));
                        }) })) : (_jsx("p", { className: "text-xs text-muted-foreground py-3 text-center", children: t('dashboard.noData') }))] })] }));
}
// Transactions tab (issue #235): the buy/sell ledger behind the consolidated
// holdings. Lists every transaction across the portfolio and lets users add a
// buy (to a new or existing ticker), record a sell, or edit/delete entries.
// Each mutation recomputes the affected holding's preço médio server-side.
function AssetTransactionsTab({ holdings, wallets, locale, dateLocale, mask, canWrite, onChanged, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: txs, isLoading } = useQuery({
        queryKey: ['asset-transactions'],
        queryFn: () => assets.allTransactions(),
    });
    const marketHoldings = useMemo(() => holdings.filter((h) => h.valuation_method === 'market_price' && !h.sell_date), [holdings]);
    // Market holdings that exist but have no recorded buys → flagged in amber so
    // the user knows their average price / return can't be computed yet.
    const holdingsWithoutCost = useMemo(() => marketHoldings.filter((h) => h.average_price == null && h.units != null), [marketHoldings]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    // Form state
    const [formKind, setFormKind] = useState('buy');
    const [formHolding, setFormHolding] = useState('__new__');
    const [formTicker, setFormTicker] = useState('');
    const [formGroupId, setFormGroupId] = useState('');
    const [formQuantity, setFormQuantity] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formFee, setFormFee] = useState('');
    const [formDate, setFormDate] = useState(localDateString);
    function afterChange() {
        queryClient.refetchQueries({ queryKey: ['asset-transactions'] });
        onChanged();
    }
    const saveMutation = useMutation({
        mutationFn: async () => {
            const quantity = parseFloat(formQuantity);
            const price = parseFloat(formPrice);
            const fee = formFee ? parseFloat(formFee) : 0;
            if (editingTx) {
                return assets.updateTransaction(editingTx.id, {
                    kind: formKind,
                    quantity,
                    price,
                    fee,
                    date: formDate,
                });
            }
            if (formHolding === '__new__') {
                return assets.buy({
                    ticker: formTicker.trim().toUpperCase(),
                    quantity,
                    price,
                    fee,
                    date: formDate,
                    group_id: formGroupId || null,
                });
            }
            return assets.addTransaction(formHolding, { kind: formKind, quantity, price, fee, date: formDate });
        },
        onSuccess: () => {
            afterChange();
            setDialogOpen(false);
            setEditingTx(null);
            toast.success(t('assets.txSaved'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => assets.deleteTransaction(id),
        onSuccess: () => {
            afterChange();
            setDeletingId(null);
            toast.success(t('assets.txDeleted'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    function openAdd() {
        setEditingTx(null);
        setFormKind('buy');
        setFormHolding(marketHoldings.length > 0 ? marketHoldings[0].id : '__new__');
        setFormTicker('');
        setFormGroupId('');
        setFormQuantity('');
        setFormPrice('');
        setFormFee('');
        setFormDate(localDateString());
        setDialogOpen(true);
    }
    function openEdit(tx) {
        setEditingTx(tx);
        setFormKind(tx.kind);
        setFormHolding(tx.asset_id);
        setFormQuantity(`${tx.quantity}`);
        setFormPrice(`${tx.price}`);
        setFormFee(tx.fee ? `${tx.fee}` : '');
        setFormDate(tx.date);
        setDialogOpen(true);
    }
    function openAddForHolding(holdingId) {
        setEditingTx(null);
        setFormKind('buy');
        setFormHolding(holdingId);
        setFormTicker('');
        setFormGroupId('');
        setFormQuantity('');
        setFormPrice('');
        setFormFee('');
        setFormDate(localDateString());
        setDialogOpen(true);
    }
    const isNewTicker = !editingTx && formHolding === '__new__';
    // Warn before a sell that exceeds the held quantity (no shorting). Only on a
    // fresh sell into an existing holding; edits are validated server-side.
    const selectedHeldUnits = marketHoldings.find((h) => h.id === formHolding)?.units ?? 0;
    const oversell = !editingTx && !isNewTicker && formKind === 'sell' && !!formQuantity && parseFloat(formQuantity) > selectedHeldUnits;
    const canSave = !!formQuantity &&
        parseFloat(formQuantity) > 0 &&
        !!formPrice &&
        (isNewTicker ? !!formTicker.trim() : true) &&
        !oversell &&
        !saveMutation.isPending;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: t('assets.txTabHint') }), canWrite && (_jsxs(Button, { onClick: openAdd, className: "gap-1.5", children: [_jsx(Plus, { size: 16 }), t('assets.addTransaction')] }))] }), holdingsWithoutCost.length > 0 && (_jsx("div", { className: "space-y-1.5", children: holdingsWithoutCost.map((h) => (_jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20", children: [_jsx(AlertTriangle, { size: 16, className: "text-amber-500 shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-amber-900 dark:text-amber-200 truncate", children: h.ticker || h.name }), _jsx("p", { className: "text-[11px] text-amber-700 dark:text-amber-300/80", children: t('assets.noPriceWarning') })] }), canWrite && (_jsx(Button, { size: "sm", variant: "outline", className: "h-7 px-2.5 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40 shrink-0", onClick: () => openAddForHolding(h.id), children: t('assets.addBuys') }))] }, h.id))) })), isLoading ? (_jsx("div", { className: "space-y-2", children: Array.from({ length: 4 }).map((_, i) => _jsx(Skeleton, { className: "h-12 rounded-lg" }, i)) })) : (txs ?? []).length === 0 ? (holdingsWithoutCost.length === 0 ? (_jsxs("div", { className: "text-center py-16", children: [_jsx(TrendingUp, { className: "mx-auto h-12 w-12 text-muted-foreground/40 mb-3" }), _jsx("p", { className: "text-muted-foreground", children: t('assets.noTransactions') })] })) : null) : (_jsx("div", { className: "rounded-xl border border-border overflow-hidden divide-y divide-border", children: (txs ?? []).map((tx) => {
                    const total = tx.quantity * tx.price;
                    const cur = tx.currency ?? 'USD';
                    return (_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors", children: [_jsx(Badge, { variant: "outline", className: `text-[10px] px-1.5 py-0 shrink-0 ${tx.kind === 'buy' ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 border-rose-200'}`, children: tx.kind === 'buy' ? t('assets.txBuy') : t('assets.txSell') }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-foreground truncate", children: tx.ticker || tx.asset_name }), _jsxs("p", { className: "text-[11px] text-muted-foreground tabular-nums", children: [new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale), " \u00B7", ' ', mask(`${tx.quantity}`), " \u00D7 ", mask(formatCurrency(tx.price, cur, locale))] })] }), _jsxs("div", { className: "text-right shrink-0", children: [_jsx("p", { className: "text-sm font-semibold tabular-nums text-foreground", children: mask(formatCurrency(total, cur, locale)) }), tx.fee > 0 && (_jsxs("p", { className: "text-[10px] text-muted-foreground tabular-nums", children: [t('assets.txFee'), " ", mask(formatCurrency(tx.fee, cur, locale))] }))] }), canWrite && (_jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("button", { onClick: () => openEdit(tx), title: t('common.edit'), className: "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors", children: _jsx(Pencil, { size: 14 }) }), _jsx("button", { onClick: () => setDeletingId(tx.id), title: t('common.delete'), className: "p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors", children: _jsx(Trash2, { size: 14 }) })] }))] }, tx.id));
                }) })), _jsx(Dialog, { open: dialogOpen, onOpenChange: setDialogOpen, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: editingTx ? t('assets.editTransaction') : t('assets.addTransaction') }) }), _jsxs("div", { className: "space-y-4", children: [!editingTx && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.holding') }), _jsxs("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full", value: formHolding, onChange: (e) => {
                                                setFormHolding(e.target.value);
                                                if (e.target.value === '__new__')
                                                    setFormKind('buy');
                                            }, children: [_jsx("option", { value: "__new__", children: t('assets.newTicker') }), marketHoldings.map((h) => (_jsx("option", { value: h.id, children: h.ticker || h.name }, h.id)))] })] })), isNewTicker && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.ticker') }), _jsx(Input, { value: formTicker, onChange: (e) => setFormTicker(e.target.value), placeholder: t('assets.tickerPlaceholder') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.wallet') }), _jsxs("select", { className: "bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary px-3 py-2 rounded-lg text-foreground text-sm w-full", value: formGroupId, onChange: (e) => setFormGroupId(e.target.value), children: [_jsx("option", { value: "", children: t('assets.noWallet') }), wallets.map((w) => (_jsx("option", { value: w.id, children: w.name }, w.id)))] })] })] })), !isNewTicker && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.txType') }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: ['buy', 'sell'].map((k) => (_jsx("button", { type: "button", className: `px-3 py-2 rounded-lg text-sm font-medium border transition-all ${formKind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`, onClick: () => setFormKind(k), children: k === 'buy' ? t('assets.txBuy') : t('assets.txSell') }, k))) })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.quantity') }), _jsx(Input, { type: "number", step: "any", min: "0", value: formQuantity, onChange: (e) => setFormQuantity(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.unitPrice') }), _jsx(Input, { type: "number", step: "any", min: "0", value: formPrice, onChange: (e) => setFormPrice(e.target.value) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.fee') }), _jsx(Input, { type: "number", step: "any", min: "0", value: formFee, onChange: (e) => setFormFee(e.target.value), placeholder: "0" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.date') }), _jsx(DatePickerInput, { value: formDate, onChange: setFormDate })] })] }), oversell && (_jsxs("p", { className: "flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400", children: [_jsx(AlertTriangle, { size: 13, className: "shrink-0" }), t('assets.oversellWarning', { available: selectedHeldUnits })] })), formQuantity && formPrice && parseFloat(formQuantity) > 0 && (_jsxs("div", { className: "flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30", children: [_jsx("span", { className: "text-xs font-medium text-muted-foreground", children: t('assets.txTotal') }), _jsx("span", { className: "text-sm font-bold tabular-nums text-foreground", children: formatCurrency(parseFloat(formQuantity) * parseFloat(formPrice) + (formFee ? parseFloat(formFee) : 0) * (formKind === 'buy' ? 1 : -1), 'USD', locale) })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDialogOpen(false), children: t('common.cancel') }), _jsx(Button, { onClick: () => saveMutation.mutate(), disabled: !canSave, children: t('common.save') })] })] }) }), _jsx(Dialog, { open: !!deletingId, onOpenChange: () => setDeletingId(null), children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('assets.confirmDeleteTxTitle') }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: t('assets.confirmDeleteTx') }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeletingId(null), children: t('common.cancel') }), _jsx(Button, { variant: "destructive", onClick: () => deletingId && deleteMutation.mutate(deletingId), disabled: deleteMutation.isPending, children: t('common.delete') })] })] }) })] }));
}
// Inline buy/sell ledger shown when a holding row is expanded (the
// "Lançamentos" of the reference). Lists the holding's transactions and
// offers a one-tap add — the consolidated row above is recomputed server-side.
function HoldingLedger({ asset, locale, dateLocale, mask, canWrite, onAdd, onChanged, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: txs, isLoading } = useQuery({
        queryKey: ['asset-transactions', asset.id],
        queryFn: () => assets.transactions(asset.id),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => assets.deleteTransaction(id),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['asset-transactions', asset.id] });
            queryClient.refetchQueries({ queryKey: ['asset-transactions'] });
            onChanged();
            toast.success(t('assets.txDeleted'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    return (_jsxs("div", { className: "border-t border-border bg-muted/10 px-4 py-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider", children: t('assets.ledgerTitle') }), canWrite && (_jsxs(Button, { size: "sm", variant: "outline", className: "h-7 px-2 text-xs gap-1", onClick: onAdd, children: [_jsx(Plus, { size: 13 }), t('assets.addTransaction')] }))] }), isLoading ? (_jsx(Skeleton, { className: "h-16 w-full rounded-lg" })) : (txs ?? []).length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground py-2", children: t('assets.noLedgerYet') })) : (_jsx("div", { className: "rounded-lg border border-border overflow-hidden divide-y divide-border bg-card", children: (txs ?? []).map((tx) => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2", children: [_jsx(Badge, { variant: "outline", className: `text-[9px] px-1 py-0 shrink-0 ${tx.kind === 'buy' ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 border-rose-200'}`, children: tx.kind === 'buy' ? t('assets.txBuy') : t('assets.txSell') }), _jsxs("span", { className: "text-[11px] text-muted-foreground tabular-nums flex-1", children: [new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale), " \u00B7", ' ', mask(`${tx.quantity}`), " \u00D7 ", mask(formatCurrency(tx.price, asset.currency, locale))] }), _jsx("span", { className: "text-xs font-semibold tabular-nums text-foreground", children: mask(formatCurrency(tx.quantity * tx.price, asset.currency, locale)) }), canWrite && (_jsx("button", { onClick: () => deleteMutation.mutate(tx.id), disabled: deleteMutation.isPending, className: "p-1 rounded text-muted-foreground/50 hover:text-rose-600 transition-colors", title: t('common.delete'), children: _jsx(Trash2, { size: 12 }) }))] }, tx.id))) }))] }));
}
// Lightweight dialog to add a buy/sell to an already-existing holding. Used by
// the holdings table ("+ add buys") and the inline ledger.
function AddHoldingTransactionDialog({ assetId, holding, locale, onClose, onChanged, }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [kind, setKind] = useState('buy');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [fee, setFee] = useState('');
    const [date, setDate] = useState(localDateString);
    const [formSource, setFormSource] = useState(null);
    if (!formSource || formSource.assetId !== assetId) {
        setFormSource({ assetId });
        if (assetId) {
            setKind('buy');
            setQuantity('');
            setPrice('');
            setFee('');
            setDate(localDateString());
        }
    }
    const saveMutation = useMutation({
        mutationFn: () => assets.addTransaction(assetId, {
            kind,
            quantity: parseFloat(quantity),
            price: parseFloat(price),
            fee: fee ? parseFloat(fee) : 0,
            date,
        }),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['asset-transactions'] });
            if (assetId)
                queryClient.refetchQueries({ queryKey: ['asset-transactions', assetId] });
            onChanged();
            onClose();
            toast.success(t('assets.txSaved'));
        },
        onError: (e) => toast.error(assetErrorMessage(e, t('common.error'))),
    });
    const cur = holding?.currency ?? 'USD';
    const heldUnits = holding?.units ?? 0;
    const oversell = kind === 'sell' && !!quantity && parseFloat(quantity) > heldUnits;
    const canSave = !!quantity && parseFloat(quantity) > 0 && !!price && !oversell && !saveMutation.isPending;
    return (_jsx(Dialog, { open: !!assetId, onOpenChange: (o) => { if (!o)
            onClose(); }, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { children: [t('assets.addTransaction'), holding ? ` · ${holding.ticker || holding.name}` : ''] }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.txType') }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: ['buy', 'sell'].map((k) => (_jsx("button", { type: "button", className: `px-3 py-2 rounded-lg text-sm font-medium border transition-all ${kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`, onClick: () => setKind(k), children: k === 'buy' ? t('assets.txBuy') : t('assets.txSell') }, k))) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.quantity') }), _jsx(Input, { type: "number", step: "any", min: "0", value: quantity, onChange: (e) => setQuantity(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.unitPrice') }), _jsx(Input, { type: "number", step: "any", min: "0", value: price, onChange: (e) => setPrice(e.target.value) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.fee') }), _jsx(Input, { type: "number", step: "any", min: "0", value: fee, onChange: (e) => setFee(e.target.value), placeholder: "0" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: t('assets.date') }), _jsx(DatePickerInput, { value: date, onChange: setDate })] })] }), oversell && (_jsxs("p", { className: "flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400", children: [_jsx(AlertTriangle, { size: 13, className: "shrink-0" }), t('assets.oversellWarning', { available: heldUnits })] })), quantity && price && parseFloat(quantity) > 0 && (_jsxs("div", { className: "flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30", children: [_jsx("span", { className: "text-xs font-medium text-muted-foreground", children: t('assets.txTotal') }), _jsx("span", { className: "text-sm font-bold tabular-nums text-foreground", children: formatCurrency(parseFloat(quantity) * parseFloat(price) + (fee ? parseFloat(fee) : 0) * (kind === 'buy' ? 1 : -1), cur, locale) })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onClose, children: t('common.cancel') }), _jsx(Button, { onClick: () => saveMutation.mutate(), disabled: !canSave, children: t('common.save') })] })] }) }));
}
