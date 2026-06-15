import Link from 'next/link';
import {
  Shield, Zap, Globe, Lock, ArrowRight, CheckCircle,
  DollarSign, Users, Star, ChevronRight,
  Layers, Key, RefreshCw,
} from 'lucide-react';

const STEPS_CLIENT = [
  'Connect your Stellar wallet (no password required)',
  'Create a project and define milestones',
  'Deposit USDC — funds are locked in a smart contract',
  'Review each milestone submission',
  'Approve to release payment instantly on-chain',
];

const STEPS_FREELANCER = [
  'Connect your Stellar wallet',
  'Browse open projects and accept an invitation',
  'View milestones and start working',
  'Submit deliverables with proof links and files',
  'Receive USDC automatically on client approval',
];

const FEATURES = [
  {
    icon: Lock,
    title: 'Non-Custodial Smart Contract',
    desc: 'Funds are locked in an immutable Soroban contract on Stellar. No one — not even us — can touch the money until milestones are approved.',
    badge: 'Zero counterparty risk',
    accent: 'blue',
  },
  {
    icon: CheckCircle,
    title: 'Milestone-Based Payments',
    desc: 'Break any project into milestones. Each milestone is independently approved before its funds are released. Incremental trust, incremental payment.',
    badge: 'Granular control',
    accent: 'emerald',
  },
  {
    icon: Globe,
    title: 'On-Chain Dispute Resolution',
    desc: 'Neutral arbitrators resolve disputes. Their decision triggers a signed transaction — fair, transparent, and executable without any central authority.',
    badge: 'Verifiable on Stellar',
    accent: 'purple',
  },
];

const TRUST_BADGES = [
  { icon: Zap, label: 'Stellar Network', sub: 'Fast & cheap transactions' },
  { icon: DollarSign, label: 'USDC Stablecoin', sub: 'No price volatility risk' },
  { icon: Key, label: 'Non-custodial', sub: 'We never hold your keys' },
  { icon: Layers, label: 'Soroban Contracts', sub: 'Auditable on-chain logic' },
  { icon: RefreshCw, label: '1% Platform Fee', sub: 'Only on fund release' },
  { icon: Star, label: 'Reputation System', sub: 'Built-in review scores' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-lg font-bold tracking-tight">EscrowX</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/projects/browse"
              className="hidden sm:block px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Browse Projects
            </Link>
            <Link
              href="/connect"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-semibold transition-colors shadow-lg shadow-blue-500/25"
            >
              Connect Wallet
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Live on Stellar Testnet &amp; Mainnet
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Trustless Escrow
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              for Global Freelancers
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Lock funds in a Soroban smart contract before work begins.
            Release payments only when milestones are approved.
            No middlemen. No fraud. No excuses.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/connect"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 font-bold text-lg transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              Get Started Free <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/projects/browse"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 font-semibold text-lg transition-all"
            >
              Browse Projects <ChevronRight className="h-5 w-5 text-slate-400" />
            </Link>
          </div>

          <p className="mt-8 text-sm text-slate-600">
            Non-custodial · USDC on Stellar · 1% fee on release only
          </p>
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {TRUST_BADGES.map(b => (
            <div
              key={b.label}
              className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white/3 border border-white/5 text-center"
            >
              <b.icon className="h-5 w-5 text-blue-400" />
              <p className="text-xs font-semibold text-white">{b.label}</p>
              <p className="text-xs text-slate-500">{b.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Built for real trust, not promises
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Every protection is enforced on-chain. No company policy, no support tickets — just code.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className={`relative p-6 rounded-2xl border overflow-hidden group hover:-translate-y-1 transition-all duration-200 ${
                f.accent === 'blue'
                  ? 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40'
                  : f.accent === 'emerald'
                  ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                  : 'border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40'
              }`}
            >
              <div className={`inline-flex p-2.5 rounded-xl mb-4 ${
                f.accent === 'blue' ? 'bg-blue-500/15' :
                f.accent === 'emerald' ? 'bg-emerald-500/15' :
                'bg-purple-500/15'
              }`}>
                <f.icon className={`h-6 w-6 ${
                  f.accent === 'blue' ? 'text-blue-400' :
                  f.accent === 'emerald' ? 'text-emerald-400' :
                  'text-purple-400'
                }`} />
              </div>
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${
                f.accent === 'blue' ? 'text-blue-400 bg-blue-400/10 border border-blue-400/20' :
                f.accent === 'emerald' ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' :
                'text-purple-400 bg-purple-400/10 border border-purple-400/20'
              }`}>
                {f.badge}
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-slate-400">The complete escrow lifecycle — start to finish</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-gradient-to-b from-blue-950/40 to-transparent border border-blue-500/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-blue-300">For Clients</h3>
            </div>
            <div className="space-y-4">
              {STEPS_CLIENT.map((step, i) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-slate-300 text-sm leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-b from-emerald-950/30 to-transparent border border-emerald-500/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <Star className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-emerald-300">For Freelancers</h3>
            </div>
            <div className="space-y-4">
              {STEPS_FREELANCER.map((step, i) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-slate-300 text-sm leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Contract ── */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-slate-900 to-blue-950/30 border border-white/5 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Live Contract</span>
              </div>
              <h3 className="text-xl font-bold mb-1">Deployed on Stellar Testnet</h3>
              <p className="text-slate-400 text-sm">
                Contract ID:{' '}
                <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300">
                  CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO
                </span>
              </p>
            </div>
            <a
              href="https://stellar.expert/explorer/testnet/contract/CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-sm text-slate-300 hover:text-white transition-colors"
            >
              View on Explorer
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center bg-gradient-to-b from-blue-950/40 border border-blue-500/10 rounded-3xl p-14">
          <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 mb-6">
            <Shield className="h-10 w-10 text-blue-400" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Start your first project today</h2>
          <p className="text-slate-400 text-lg max-w-lg mx-auto mb-8">
            Connect your Freighter wallet and create a project in under 2 minutes.
            No email, no password, no KYC.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/connect"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 font-bold text-lg transition-all shadow-xl shadow-blue-500/25"
            >
              Connect Wallet <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-4 rounded-2xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold transition-colors"
            >
              Get Freighter Wallet
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <span className="font-bold text-lg">EscrowX</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/connect" className="hover:text-white transition-colors">App</Link>
              <Link href="/projects/browse" className="hover:text-white transition-colors">Browse</Link>
              <a
                href="https://stellar.expert/explorer/testnet/contract/CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Contract
              </a>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-slate-600">
            <p>EscrowX — Decentralized Escrow on Stellar · 1% fee on fund release</p>
            <p>All transactions are verifiable on Stellar blockchain</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
