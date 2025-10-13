// This file is no longer used as the bank data is now fetched from the Google Sheet API.
export interface BankBranch {
  bankCode: string;
  branchCode: string;
  bankName: string;
  branchName: string;
  fullName: string;
  fullCode: string;
}

export const TAIWAN_BANK_CODES: BankBranch[] = [];
