import React, { useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandLogo } from './components/ui/BrandLogo';
import { SplashScreen } from './components/ui/SplashScreen';
import { LandingPage } from './pages/LandingPage';
import { AuthPages } from './pages/AuthPages';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssistantPage } from './pages/AssistantPage';
import { IndoorAirPage, RoutinePlannerPage } from './pages/RoutineIndoorPage';
import { AlternativesImpactPage } from './pages/AlternativesImpactPage';
import { CommunityPage, FamilyPage } from './pages/FamilyCommunityPage';
import { EducationPage, NotificationsSettingsPage } from './pages/EducationNotificationsAccountPage';
import { AdminPage } from './pages/AdminPage';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-md w-full p-6 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 space-y-3">
            <h1 className="font-display text-lg font-bold">Something went wrong</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
            >
              Recover View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BreatheWiseAppShell() {
  const { user, logout, t, isDemoAccount } = useAuth();
  const [surface, setSurface] = useState<'landing' | 'auth' | 'onboarding' | 'workspace'>('landing');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (surface === 'auth' && !user) {
    return (
      <AuthPages
        initialTab={authTab}
        onBack={() => setSurface('landing')}
        onSuccess={(signedUser) => {
          if (!signedUser.onboardingCompleted) {
            setSurface('onboarding');
          } else {
            setSurface('workspace');
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }

  if (surface === 'landing' || !user) {
    return (
      <LandingPage
        onNavigate={(tab) => {
          setActiveTab(tab);
          setSurface('workspace');
        }}
        onOpenAuth={(tab) => {
          setAuthTab(tab);
          setSurface('auth');
        }}
      />
    );
  }

  if (surface === 'onboarding') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <OnboardingPage
          onComplete={() => {
            setSurface('workspace');
            setActiveTab('dashboard');
          }}
        />
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    { id: 'assistant', label: t.navAssistant, icon: MessageSquare },
    { id: 'routine', label: t.navRoutine, icon: CalendarClock },
    { id: 'indoor', label: t.navIndoor, icon: Wind },
    { id: 'impact', label: t.navImpact, icon: Leaf },
    { id: 'family', label: t.navFamily, icon: Home },
    { id: 'community', label: t.navCommunity, icon: Users },
    { id: 'learn', label: t.navLearn, icon: BookOpen },
    { id: 'settings', label: t.navSettings, icon: Settings },
  ];

  if (user.role === 'COMMUNITY_MODERATOR' || user.role === 'SYSTEM_ADMIN') {
    navItems.push({ id: 'admin', label: t.navAdmin, icon: Shield });
  }

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-md"
      >
        Skip to workspace content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSurface('landing')}
            className="whitespace-nowrap shrink-0 text-left"
            aria-label="Go to BreatheWise AI Home"
          >
            <BrandLogo size="sm" />
          </button>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div>
            <div className="font-semibold text-slate-900 dark:text-white truncate">{user.fullName}</div>
            <div className="text-slate-500 dark:text-slate-400 truncate">
              {user.role}{isDemoAccount ? ' · Demo Mode' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              setSurface('landing');
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 flex">
          <div className="w-64 bg-white dark:bg-slate-900 h-full p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <BrandLogo size="sm" />
                <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                        activeTab === item.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                setMobileNavOpen(false);
                setSurface('landing');
              }}
              className="w-full py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 lg:h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              BreatheWise AI / <span className="font-medium text-slate-900 dark:text-white capitalize">{activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSurface('landing')}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline whitespace-nowrap shrink-0"
            >
              Public Home
            </button>
          </div>
        </header>

        <main id="workspace-main" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
          {activeTab === 'assistant' && <AssistantPage />}
          {activeTab === 'routine' && <RoutinePlannerPage />}
          {activeTab === 'indoor' && <IndoorAirPage />}
          {activeTab === 'impact' && <AlternativesImpactPage />}
          {activeTab === 'family' && <FamilyPage />}
          {activeTab === 'community' && <CommunityPage />}
          {activeTab === 'learn' && <EducationPage />}
          {activeTab === 'settings' && <NotificationsSettingsPage onEditOnboarding={() => setSurface('onboarding')} />}
          {activeTab === 'admin' && <AdminPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  React.useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  return (
    <AppErrorBoundary>
      <AuthProvider>
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <BreatheWiseAppShell />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
