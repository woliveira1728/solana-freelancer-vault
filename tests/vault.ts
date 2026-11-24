import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("freelancer-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FreelancerVault as Program<any>;

  const client = Keypair.generate();
  const freelancer = Keypair.generate();
  const attacker = Keypair.generate();

  const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

  let vaultPda: PublicKey;
  let vaultBump: number;

  before(async () => {
    const airdropClient = await provider.connection.requestAirdrop(
      client.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropClient);

    const airdropAttacker = await provider.connection.requestAirdrop(
      attacker.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropAttacker);

    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), client.publicKey.toBuffer()],
      program.programId
    );
  });

  it("1. Inicializa o cofre e deposita o pagamento do freelancer com sucesso", async () => {
    await program.methods
      .initializeVault(depositAmount)
      .accounts({
        vault: vaultPda,
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

    const vaultAccount = await program.account.vaultAccount.fetch(vaultPda);
    expect(vaultAccount.client.toBase58()).to.equal(client.publicKey.toBase58());
    expect(vaultAccount.freelancer.toBase58()).to.equal(freelancer.publicKey.toBase58());
    expect(vaultAccount.amount.toNumber()).to.equal(depositAmount.toNumber());
    expect(vaultAccount.isReleased).to.be.false;

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    expect(vaultBalance).to.be.at.least(depositAmount.toNumber());
  });

  it("2. [SECURITY EXPLOIT] Impede que um invasor tente drenar os fundos para sua própria carteira", async () => {
    try {
      await program.methods
        .releasePayment()
        .accounts({
          vault: vaultPda,
          freelancer: attacker.publicKey,
          client: client.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      expect.fail("O contrato deveria ter rejeitado a carteira maliciosa!");
    } catch (err: any) {
      expect(err.toString()).to.include("InvalidFreelancer");
    }
  });

  it("3. [SECURITY] Impede que uma carteira não autorizada assine a liberação dos fundos", async () => {
    try {
      await program.methods
        .releasePayment()
        .accounts({
          vault: vaultPda,
          freelancer: freelancer.publicKey,
          client: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();

      expect.fail("Deveria ter falhado: apenas o cliente pagador original pode autorizar a liberação!");
    } catch (err: any) {
      expect(err.toString()).to.include("UnauthorizedClient");
    }
  });

  it("4. Libera o pagamento com sucesso para a carteira legítima do freelancer", async () => {
    const balanceBefore = await provider.connection.getBalance(freelancer.publicKey);

    await program.methods
      .releasePayment()
      .accounts({
        vault: vaultPda,
        freelancer: freelancer.publicKey,
        client: client.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

    const vaultAccount = await program.account.vaultAccount.fetch(vaultPda);
    expect(vaultAccount.isReleased).to.be.true;

    const balanceAfter = await provider.connection.getBalance(freelancer.publicKey);
    expect(balanceAfter - balanceBefore).to.equal(depositAmount.toNumber());
  });

  it("5. [REPLAY ATTACK] Impede que o pagamento seja liberado duas vezes", async () => {
    try {
      await program.methods
        .releasePayment()
        .accounts({
          vault: vaultPda,
          freelancer: freelancer.publicKey,
          client: client.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([client])
        .rpc();

      expect.fail("Deveria ter falhado: o cofre já foi liberado!");
    } catch (err: any) {
      expect(err.toString()).to.include("AlreadyReleased");
    }
  });
});
