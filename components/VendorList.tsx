import React from 'react';
import { Vendor } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { GoogleSheetIcon } from './icons/GoogleSheetIcon';
import { SHEET_URL } from '../services/googleSheetService';

interface VendorListProps {
  vendors: Vendor[];
  onAddVendorToTransfer: (vendor: Vendor) => void;
  onAddNewVendorClick: () => void;
  onSearch: (searchTerm: string) => void;
  transferVendorIds: Set<string>;
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchError: string | null;
}

export const VendorList: React.FC<VendorListProps> = ({
  vendors,
  onAddVendorToTransfer,
  onAddNewVendorClick,
  onSearch,
  transferVendorIds,
  isLoading,
  searchTerm,
  setSearchTerm,
  searchError,
}) => {

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };
  
  const handleOpenSheet = () => {
    if (SHEET_URL.includes('YOUR_SHEET_ID_HERE')) {
      alert('請先在 services/googleSheetService.ts 檔案中設定您的 Google Sheet 網址。');
      return;
    }
    window.open(SHEET_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-800">廠商資料庫 (線上)</h2>
        <div className="flex items-center gap-2">
           <button
            onClick={handleOpenSheet}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title="在新分頁中開啟 Google Sheet"
          >
            <GoogleSheetIcon className="h-5 w-5 mr-2 text-green-600" />
            開啟雲端資料庫
          </button>
          <button
            onClick={onAddNewVendorClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            新增廠商
          </button>
        </div>
      </div>
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="搜尋線上廠商資料庫..."
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
            disabled={isLoading || searchTerm.length < 2}
          >
            {isLoading ? '搜尋中...' : '搜尋'}
          </button>
        </div>
      </form>
      <div className="flex-grow overflow-y-auto -mx-2 px-2">
        <ul className="space-y-2">
          {isLoading && (
            <li className="text-center text-gray-500 py-6">正在從 Google Sheet 載入資料...</li>
          )}
          {searchError && (
            <li className="text-center text-red-600 bg-red-50 p-4 rounded-md">
              {searchError}
            </li>
          )}
          {!isLoading && !searchError && vendors.length > 0 && vendors.map((vendor) => (
            <li key={vendor.id} className="p-3 bg-gray-50 rounded-md flex justify-between items-start hover:bg-gray-100 transition-colors">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-gray-900">{vendor.name}</p>
                  {vendor.sheetName && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">{vendor.sheetName}</span>}
                </div>
                <p className="text-sm text-gray-600">{vendor.bank} ({vendor.bankCode})</p>
                <p className="text-xs text-gray-500">帳號: {vendor.accountNumber || 'N/A'}</p>
                {vendor.taxId && <p className="text-xs text-gray-500">統編: {vendor.taxId}</p>}
                {vendor.address && <p className="text-xs text-gray-500">地址: {vendor.address}</p>}
                {vendor.remarks && <p className="text-xs text-gray-500 mt-1 pt-1 border-t border-gray-200">備註: {vendor.remarks}</p>}
              </div>
              <button
                onClick={() => onAddVendorToTransfer(vendor)}
                disabled={transferVendorIds.has(vendor.id)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed flex-shrink-0 mt-1"
              >
                {transferVendorIds.has(vendor.id) ? '已加入' : '加入匯款'}
              </button>
            </li>
          ))}
          {!isLoading && !searchError && vendors.length === 0 && searchTerm.length > 1 && (
             <li className="text-center text-gray-500 py-4">
              在您的 Google Sheet 中找不到結果。
            </li>
           )}
           {!isLoading && !searchError && searchTerm.length <= 1 && (
             <li className="text-center text-gray-500 py-4">
              請輸入至少 2 個關鍵字進行搜尋。
            </li>
           )}
        </ul>
      </div>
    </div>
  );
};
