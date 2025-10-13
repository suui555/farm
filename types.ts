export interface Vendor {
  id: string;
  name: string;
  bank: string;
  bankCode: string;
  accountNumber: string;
  sheetName?: string;
  taxId?: string;
  address?: string;
  remarks?: string;
}

export interface TransferItem extends Vendor {
  amountPayable: number;
  manualFee: number;
  actualAmount: number; // For UI state consistency
  feeReason?: 'cash' | 'waived' | '';
}

export interface BankInfo {
  fullName: string;
  fullCode: string;
}
