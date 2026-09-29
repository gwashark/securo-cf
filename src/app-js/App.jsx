import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner.js';
import { TooltipProvider } from './components/ui/tooltip.js';
import { ThemeProvider } from './components/theme-provider.js';
import { AuthProvider } from './contexts/auth-provider.js';
import { WorkspaceProvider } from './contexts/workspace-provider.js';
import { CollectionFilterProvider } from './contexts/collection-filter-provider.js';
import { ProtectedRoute } from './components/protected-route.js';
import { AdminRoute } from './components/admin-route.js';
import { AgentsRoute } from './components/agents-route.js';
import { ModuleRoute } from './components/module-route.js';
import { AppLayout } from './components/app-layout.js';
import SetupPage from './pages/setup.js';
import LoginPage from './pages/login.js';
import RegisterPage from './pages/register.js';
import DashboardPage from './pages/dashboard.js';
import TransactionsPage from './pages/transactions.js';
import AccountsPage from './pages/accounts.js';
import AccountDetailPage from './pages/account-detail.js';
import ImportPage from './pages/import.js';
import RulesPage from './pages/rules.js';
import CategoriesPage from './pages/categories.js';
import CollectionsPage from './pages/collections.js';
import BudgetsPage from './pages/budgets.js';
import RecurringPage from './pages/recurring.js';
import GoalsPage from './pages/goals.js';
import AssetsPage from './pages/assets.js';
import ReportsPage from './pages/reports.js';
import PayeesPage from './pages/payees.js';
import GroupsPage from './pages/groups.js';
import GroupDetailPage from './pages/group-detail.js';
import AdminSettingsPage from './pages/admin/settings.js';
import AgentsListPage from './pages/agents-list.js';
import AgentDetailPage from './pages/agent-detail.js';
import AgentConnectionsPage from './pages/agent-connections.js';
import InvoicesPage from './pages/invoices.js';
import InvoiceSchedulesPage from './pages/invoice-schedules.js';
import InvoiceScheduleDetailPage from './pages/invoice-schedule-detail.js';
import ProductsPage from './pages/products.js';
import InvoiceDetailPage from './pages/invoice-detail.js';
import SharedInvoicePage from './pages/shared-invoice.js';
import WorkspaceSettingsPage from './pages/workspace-settings.js';
import OAuthCallbackPage from './pages/oauth-callback.js';
import OIDCCallbackPage from './pages/oidc-callback.js';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
        },
    },
});
function App() {
    return (_jsx(ThemeProvider, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(TooltipProvider, { children: _jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsxs(WorkspaceProvider, { children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/setup", element: _jsx(SetupPage, {}) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/auth/oidc/callback", element: _jsx(OIDCCallbackPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(RegisterPage, {}) }), _jsx(Route, { path: "/i/:token", element: _jsx(SharedInvoicePage, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(CollectionFilterProvider, { children: _jsx(AppLayout, {}) }) }), children: [_jsx(Route, { path: "/", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/transactions", element: _jsx(ModuleRoute, { module: "transactions", children: _jsx(TransactionsPage, {}) }) }), _jsx(Route, { path: "/accounts", element: _jsx(ModuleRoute, { module: "accounts", children: _jsx(AccountsPage, {}) }) }), _jsx(Route, { path: "/accounts/:id", element: _jsx(ModuleRoute, { module: "accounts", children: _jsx(AccountDetailPage, {}) }) }), _jsx(Route, { path: "/oauth/callback", element: _jsx(OAuthCallbackPage, {}) }), _jsx(Route, { path: "/enable-banking", element: _jsx(OAuthCallbackPage, {}) }), _jsx(Route, { path: "/import", element: _jsx(ModuleRoute, { module: "import", children: _jsx(ImportPage, {}) }) }), _jsx(Route, { path: "/rules", element: _jsx(ModuleRoute, { module: "rules", children: _jsx(RulesPage, {}) }) }), _jsx(Route, { path: "/categories", element: _jsx(ModuleRoute, { module: "categories", children: _jsx(CategoriesPage, {}) }) }), _jsx(Route, { path: "/collections", element: _jsx(CollectionsPage, {}) }), _jsx(Route, { path: "/budgets", element: _jsx(ModuleRoute, { module: "budgets", children: _jsx(BudgetsPage, {}) }) }), _jsx(Route, { path: "/goals", element: _jsx(ModuleRoute, { module: "goals", children: _jsx(GoalsPage, {}) }) }), _jsx(Route, { path: "/recurring", element: _jsx(ModuleRoute, { module: "recurring", children: _jsx(RecurringPage, {}) }) }), _jsx(Route, { path: "/assets", element: _jsx(ModuleRoute, { module: "assets", children: _jsx(AssetsPage, {}) }) }), _jsx(Route, { path: "/assets/import", element: _jsx(Navigate, { to: "/import?tab=investments", replace: true }) }), _jsx(Route, { path: "/reports", element: _jsx(ModuleRoute, { module: "reports", children: _jsx(ReportsPage, {}) }) }), _jsx(Route, { path: "/payees", element: _jsx(ModuleRoute, { module: "payees", children: _jsx(PayeesPage, {}) }) }), _jsx(Route, { path: "/groups", element: _jsx(ModuleRoute, { module: "split_groups", children: _jsx(GroupsPage, {}) }) }), _jsx(Route, { path: "/groups/:id", element: _jsx(ModuleRoute, { module: "split_groups", children: _jsx(GroupDetailPage, {}) }) }), _jsx(Route, { path: "/invoices", element: _jsx(ModuleRoute, { module: "invoices", children: _jsx(InvoicesPage, {}) }) }), _jsx(Route, { path: "/invoices/schedules", element: _jsx(ModuleRoute, { module: "invoices", children: _jsx(InvoiceSchedulesPage, {}) }) }), _jsx(Route, { path: "/invoices/schedules/:id", element: _jsx(ModuleRoute, { module: "invoices", children: _jsx(InvoiceScheduleDetailPage, {}) }) }), _jsx(Route, { path: "/invoices/products", element: _jsx(ModuleRoute, { module: "invoices", children: _jsx(ProductsPage, {}) }) }), _jsx(Route, { path: "/invoices/:id", element: _jsx(ModuleRoute, { module: "invoices", children: _jsx(InvoiceDetailPage, {}) }) }), _jsx(Route, { path: "/workspace/settings", element: _jsx(WorkspaceSettingsPage, {}) }), _jsx(Route, { path: "/admin", element: _jsx(AdminRoute, { children: _jsx(AdminSettingsPage, {}) }) }), _jsx(Route, { path: "/agents", element: _jsx(AgentsRoute, { children: _jsx(AgentsListPage, {}) }) }), _jsx(Route, { path: "/agents/connections", element: _jsx(AgentsRoute, { children: _jsx(AgentConnectionsPage, {}) }) }), _jsx(Route, { path: "/agents/:id", element: _jsx(AgentsRoute, { children: _jsx(AgentDetailPage, {}) }) })] })] }), _jsx(Toaster, {})] }) }) }) }) }) }));
}
export default App;
