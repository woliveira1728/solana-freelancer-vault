"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import idl from "../idl/freelancer_vault.json";

const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

export default function FreelancerVaultCard() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [freelancerAddress, setFreelancerAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.5");
  const [vaultData, setVaultData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getProgram = () => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const provider = new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "confirmed",
    });
    return new Program(idl as Idl, PROGRAM_ID, provider);
  };

  const getVaultPda = (clientPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), clientPubkey.toBuffer()],
      PROGRAM_ID
    );
  };

  const fetchVaultState = async () => {
    if (!wallet.publicKey) return;
    try {
      const program = getProgram();
      if (!program) return;

      const pda = getVaultPda(wallet.publicKey);
      const account = await program.account.vaultAccount.fetch(pda);
      setVaultData(account);
      setErrorMessage(null);
    } catch (err) {
      setVaultData(null);
    }
  };

  useEffect(() => {
    if (wallet.connected) {
      fetchVaultState();
    }
  }, [wallet.connected, wallet.publicKey]);

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setTxHash(null);

    try {
      const program = getProgram();
      if (!program || !wallet.publicKey) throw new Error("Conecte sua carteira primeiro.");

      const freelancerPubkey = new PublicKey(freelancerAddress);
      const lamports = new BN(parseFloat(depositAmount) * LAMPORTS_PER_SOL);
      const pda = getVaultPda(wallet.publicKey);

      const tx = await program.methods
        .initializeVault(lamports)
        .accounts({
          vault: pda,
          client: wallet.publicKey,
          freelancer: freelancerPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxHash(tx);
      await fetchVaultState();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erro ao inicializar o cofre.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRelease = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTxHash(null);

    try {
      const program = getProgram();
      if (!program || !wallet.publicKey || !vaultData) throw new Error("Dados inválidos.");

      const pda = getVaultPda(wallet.publicKey);

      const tx = await program.methods
        .releasePayment()
        .accounts({
          vault: pda,
          freelancer: vaultData.freelancer,
          client: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxHash(tx);
      await fetchVaultState();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erro ao liberar pagamento.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#0A0A0C] border border-neutral-800 rounded-xl p-6 shadow-2xl text-white font-sans">
      <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF1E1E] animate-pulse"></span>
            <h2 className="text-lg font-bold tracking-tight text-neutral-100">Solana Freelancer Vault</h2>
          </div>
          <p className="text-xs text-neutral-400 font-mono mt-1">Onchain Code // Vídeo #01</p>
        </div>
        <WalletMultiButton className="!bg-[#FF1E1E] hover:!bg-[#d91919] !text-white !font-mono !text-xs !rounded-lg !py-2 !px-4" />
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-800/80 rounded-lg text-xs font-mono text-red-300">
          ⚠️ {errorMessage}
        </div>
      )}

      {txHash && (
        <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-xs font-mono text-emerald-300 break-all">
          ✓ Transação confirmada:{" "}
          <a
            href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="underline text-emerald-400"
          >
            {txHash.slice(0, 24)}...
          </a>
        </div>
      )}

      {!wallet.connected ? (
        <div className="py-12 text-center text-neutral-500 font-mono text-sm">
          &gt; Conecte a carteira Phantom para interagir com o contrato on-chain.
        </div>
      ) : vaultData ? (
        <div className="mt-6 space-y-4">
          <div className="bg-neutral-900/70 p-4 rounded-lg border border-neutral-800 font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-400">Status:</span>
              <span className={vaultData.isReleased ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {vaultData.isReleased ? "PAGAMENTO LIBERADO" : "FUNDOS RETIDOS NO COFRE"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Valor em Custódia:</span>
              <span className="text-white font-bold">{vaultData.amount.toNumber() / LAMPORTS_PER_SOL} SOL</span>
            </div>
            <div className="flex flex-col pt-1">
              <span className="text-neutral-400">Carteira do Freelancer:</span>
              <span className="text-neutral-300 truncate">{vaultData.freelancer.toBase58()}</span>
            </div>
          </div>

          {!vaultData.isReleased && (
            <button
              onClick={handleRelease}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#FF1E1E] hover:bg-[#d91919] disabled:bg-neutral-800 text-white font-mono font-bold rounded-lg transition-all text-sm tracking-wide"
            >
              {isLoading ? "Processando instrução..." : "LIBERAR PAGAMENTO AO FREELANCER"}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleInitialize} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-mono text-neutral-300 mb-1">
              Endereço da Carteira do Freelancer:
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 7Nxk...pubkey"
              value={freelancerAddress}
              onChange={(e) => setFreelancerAddress(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#FF1E1E]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-neutral-300 mb-1">Valor do Pagamento (SOL):</label>
            <input
              type="number"
              step="0.01"
              required
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#FF1E1E]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#FF1E1E] hover:bg-[#d91919] disabled:bg-neutral-800 text-white font-mono font-bold rounded-lg transition-all text-sm tracking-wide"
          >
            {isLoading ? "Enviando Transação..." : "CRIAR COFRE & DEPOSITAR SOL"}
          </button>
        </form>
      )}
    </div>
  );
}
