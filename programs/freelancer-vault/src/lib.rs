use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod freelancer_vault {
    use super::*;

    /// 1. Inicializa o cofre e transfere o valor acordado em SOL (lamports) do cliente para a PDA
    pub fn initialize_vault(ctx: Context<InitializeVault>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.client = ctx.accounts.client.key();
        vault.freelancer = ctx.accounts.freelancer.key();
        vault.amount = amount;
        vault.is_released = false;
        vault.bump = ctx.bumps.vault;

        // Transfere o valor do cliente para a PDA do cofre via CPI (System Program)
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.client.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        transfer(cpi_context, amount)?;

        msg!("Cofre inicializado com sucesso: {} lamports retidos", amount);
        Ok(())
    }

    /// 2. Libera o pagamento custodiado exclusivamente para a carteira cadastrada do freelancer
    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        // Garante que o cofre não foi esvaziado anteriormente
        require!(!vault.is_released, ErrorCode::AlreadyReleased);

        let amount = vault.amount;

        // O saldo precisa ser enviado da PDA para o freelancer.
        // Debitamos diretamente os lamports da conta controlada pelo programa:
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.freelancer.to_account_info().try_borrow_mut_lamports()? += amount;

        vault.is_released = true;

        msg!("Pagamento de {} lamports liberado com sucesso para o freelancer", amount);
        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Validação de Contas (Anchor Constraints)
// -----------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    // Derivação determinística da PDA usando a seed [b"vault", client_pubkey]
    #[account(
        init,
        payer = client,
        space = 8 + VaultAccount::INIT_SPACE,
        seeds = [b"vault", client.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: Validamos apenas a chave pública que será armazenada no estado
    pub freelancer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleasePayment<'info> {
    #[account(
        mut,
        seeds = [b"vault", client.key().as_ref()],
        bump = vault.bump,
        // 🛡️ SEGURANÇA CRÍTICA:
        // has_one garante que a conta 'freelancer' passada na instrução
        // é EXATAMENTE a mesma salva em vault.freelancer!
        has_one = freelancer @ ErrorCode::InvalidFreelancer,
        // Garante que apenas o cliente pagador original pode assinar a liberação
        has_one = client @ ErrorCode::UnauthorizedClient,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut)]
    /// CHECK: Validada pela constraint `has_one = freelancer` acima
    pub freelancer: AccountInfo<'info>,

    pub client: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// -----------------------------------------------------------------------------
// Estrutura de Estado (Dados gravados na PDA)
// -----------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
    pub client: Pubkey,       // 32 bytes
    pub freelancer: Pubkey,   // 32 bytes
    pub amount: u64,          // 8 bytes
    pub is_released: bool,    // 1 byte
    pub bump: u8,             // 1 byte
}

// -----------------------------------------------------------------------------
// Erros Customizados do Programa
// -----------------------------------------------------------------------------

#[error_code]
pub enum ErrorCode {
    #[msg("A carteira informada não corresponde ao freelancer cadastrado no cofre.")]
    InvalidFreelancer,
    #[msg("Apenas o cliente pagador pode autorizar a liberação deste cofre.")]
    UnauthorizedClient,
    #[msg("O pagamento deste cofre já foi liberado anteriormente.")]
    AlreadyReleased,
}
