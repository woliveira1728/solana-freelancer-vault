import FreelancerVaultCard from "@/components/FreelancerVaultCard";
import { WalletContextProvider } from "@/components/WalletContextProvider";

export default function Home() {
  return (
    <WalletContextProvider>
      <main className="min-h-screen bg-[#060608] flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300 mb-3">
            <span className="text-[#FF1E1E] font-bold">&gt;_</span> ONCHAIN CODE REPO
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Web2 para Web3 <span className="text-[#FF1E1E]">na prática</span>
          </h1>
        </div>

        <FreelancerVaultCard />
      </main>
    </WalletContextProvider>
  );
}
