import { Vendor, TransferItem, BankInfo } from '../types';

// Use the latest deployed Google Apps Script URL provided by the user
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxmPsuqEBvyZm5h1j_vd7MriHQPDuavhWAn8MLOe37px_j3eljjGheZsoKLBS_aP6lcaw/exec';

// --- IMPORTANT ---
// Please replace 'YOUR_SHEET_ID_HERE' with your actual Google Sheet ID.
// This URL is used for the "Open Cloud Database" button.
// Example: https://docs.google.com/spreadsheets/d/12345abcde_FGHIJKLMNOPQRSTUVWXYZ/edit
export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ok8-2vnj9wrq4sAsenyx6ZiYLrs66018z5YotC1zsX0/edit?gid=690810697#gid=690810697';


interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const callAppsScript = async <T>(action: string, payload: object): Promise<T> => {
  if (!SCRIPT_URL.startsWith('https://')) {
    throw new Error('Please set your Apps Script URL in services/googleSheetService.ts');
  }

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    throw new Error(`Network request failed with status: ${response.status}`);
  }

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'An unknown error occurred in the Apps Script execution.');
  }

  return result.data as T;
};

export const searchVendorsOnline = async (searchTerm: string): Promise<Vendor[]> => {
  return await callAppsScript<Vendor[]>('search', { searchTerm });
};

export const searchBanksOnline = async (searchTerm: string): Promise<BankInfo[]> => {
  return await callAppsScript<BankInfo[]>('searchBank', { searchTerm });
};

export const addVendorOnline = async (vendorData: Omit<Vendor, 'id'>): Promise<{ status: string }> => {
  return await callAppsScript<{ status: string }>('add', { vendorData });
};

export const updateMainDataInCloud = async (items: TransferItem[]): Promise<{ status: string; downloadUrl: string; }> => {
  return await callAppsScript<{ status: string; downloadUrl: string; }>('updateMainData', { items });
};