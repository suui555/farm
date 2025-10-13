import React, { useState, useEffect, useCallback } from 'react';
import { Vendor, BankInfo } from '../types';
import { SparklesIcon } from './icons/SparklesIcon';
import { parseVendorInfo, isGeminiAvailable } from '../services/geminiService';
import { searchBanksOnline } from '../services/googleSheetService';


interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVendor: (vendor: Omit<Vendor, 'id'>) => Promise<void>;
}

const INITIAL_STATE: Omit<Vendor, 'id'> = {
  name: '',
  bank: '',
  bankCode: '',
  accountNumber: '',
  sheetName: '廠商', // Default to '廠商'
  taxId: '',
  address: '',
  remarks: '',
};

const sheetOptions = ['廠商', '玉山', '朴子市農會', '幼教', '個人', '少用到', '債權人'];

export const AddVendorModal: React.FC<AddVendorModalProps> = ({ isOpen, onClose, onAddVendor }) => {
  const [vendorData, setVendorData] = useState<Omit<Vendor, 'id'>>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [bankSuggestions, setBankSuggestions] = useState<BankInfo[]>([]);
  const [isBankInputFocused, setIsBankInputFocused] = useState(false);
  const [isSearchingBank, setIsSearchingBank] = useState(false);
  
  // Debounce effect for bank search
  useEffect(() => {
    if (bankSearchTerm.trim().length < 2) {
      setBankSuggestions([]);
      return;
    }

    const timerId = setTimeout(async () => {
      setIsSearchingBank(true);
      try {
        const results = await searchBanksOnline(bankSearchTerm);
        setBankSuggestions(results);
      } catch (err) {
        console.error("Bank search failed:", err);
        // Silently fail or show a small indicator, not a blocking error
      } finally {
        setIsSearchingBank(false);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timerId);
  }, [bankSearchTerm]);


  useEffect(() => {
    if (isOpen) {
      setVendorData(INITIAL_STATE);
      setPastedText('');
      setError(null);
      setIsSubmitting(false);
      setIsParsing(false);
      setBankSuggestions([]);
      setBankSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (vendorData.sheetName !== '廠商') {
      setVendorData(prev => ({ ...prev, taxId: '' }));
    }
  }, [vendorData.sheetName]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setVendorData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBankInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setVendorData(prev => ({...prev, bank: value, bankCode: ''})); // Clear bank code when name changes
    setBankSearchTerm(value);
  }

  const handleBankSuggestionClick = (bank: BankInfo) => {
    setVendorData(prev => ({
      ...prev,
      bank: bank.fullName,
      bankCode: bank.fullCode,
    }));
    setBankSuggestions([]);
    setBankSearchTerm('');
  };

  const handleParse = async () => {
    if (!pastedText.trim() || !isGeminiAvailable) return;
    setIsParsing(true);
    setError(null);
    try {
      const parsedData = await parseVendorInfo(pastedText);
      if (parsedData) {
        // AI parse logic...
        setVendorData(prev => ({
          ...prev,
          name: parsedData.name || prev.name,
          bank: parsedData.bank || prev.bank,
          bankCode: parsedData.bankCode || prev.bankCode,
          accountNumber: parsedData.accountNumber || prev.accountNumber,
          taxId: vendorData.sheetName === '廠商' ? (parsedData.taxId || prev.taxId) : '',
          address: parsedData.address || prev.address,
          remarks: parsedData.remarks || prev.remarks,
        }));
        // Trigger a search for the parsed bank name
        if (parsedData.bank) {
          setBankSearchTerm(parsedData.bank);
        }
      } else {
        setError("無法從提供的文字中解析出廠商資訊。");
      }
    } catch (e) {
      setError(`解析時發生錯誤: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorData.name || !vendorData.bank || !vendorData.bankCode || !vendorData.accountNumber) {
        setError("請填寫廠商名稱、銀行名稱、銀行代碼與銀行帳號。");
        return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const finalVendorData = {
        ...vendorData,
        taxId: vendorData.sheetName === '廠商' ? vendorData.taxId : '',
      };
      await onAddVendor(finalVendorData);
      onClose();
    } catch (err) {
      setError(`新增廠商失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">新增廠商</h3>
                  <div className="mt-4 space-y-4">
                    {isGeminiAvailable ? (
                      <div className="space-y-2">
                         <label htmlFor="pastedText" className="block text-sm font-medium text-gray-700">使用 Gemini AI 從文字中解析 (選用)</label>
                        <textarea id="pastedText" rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="貼上廠商資訊，例如：XX 公司，XX 銀行，代碼 123，帳號 456..." value={pastedText} onChange={(e) => setPastedText(e.target.value)} disabled={isParsing}/>
                        <button type="button" onClick={handleParse} disabled={isParsing || !pastedText.trim()} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
                          <SparklesIcon className="h-4 w-4 mr-1.5" />
                          {isParsing ? '解析中...' : '解析廠商資料'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                        <p className="text-sm text-yellow-800">AI 解析功能已停用。<br />請設定您的 Gemini API 金鑰以啟用此功能。</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">廠商名稱 <span className="text-red-500">*</span></label>
                        <input type="text" name="name" id="name" value={vendorData.name} onChange={handleFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                      <div>
                        <label htmlFor="sheetName" className="block text-sm font-medium text-gray-700">目標工作表 <span className="text-red-500">*</span></label>
                        <select name="sheetName" id="sheetName" value={vendorData.sheetName} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                          {sheetOptions.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <label htmlFor="bank" className="block text-sm font-medium text-gray-700">銀行名稱 <span className="text-red-500">*</span></label>
                        <input type="text" name="bank" id="bank" value={vendorData.bank} onChange={handleBankInputChange} onFocus={() => setIsBankInputFocused(true)} onBlur={() => setTimeout(() => setIsBankInputFocused(false), 200)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" autoComplete="off" placeholder="輸入銀行或分行關鍵字..."/>
                        {isBankInputFocused && (bankSuggestions.length > 0 || isSearchingBank) && (
                          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {isSearchingBank && <li className="px-3 py-2 text-sm text-gray-500">搜尋中...</li>}
                            {!isSearchingBank && bankSuggestions.map(bank => (
                              <li key={bank.fullCode} onMouseDown={() => handleBankSuggestionClick(bank)} className="px-3 py-2 cursor-pointer hover:bg-indigo-50">
                                <p className="text-sm font-medium">{bank.fullName}</p>
                                <p className="text-xs text-gray-500">{bank.fullCode}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <label htmlFor="bankCode" className="block text-sm font-medium text-gray-700">銀行代碼 <span className="text-red-500">*</span></label>
                        <input type="text" name="bankCode" id="bankCode" value={vendorData.bankCode} onChange={handleFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="可手動輸入" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">銀行帳號 <span className="text-red-500">*</span></label>
                        <input type="text" name="accountNumber" id="accountNumber" value={vendorData.accountNumber} onChange={handleFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                      <div>
                        <label htmlFor="taxId" className="block text-sm font-medium text-gray-700">統一編號</label>
                        <input type="text" name="taxId" id="taxId" value={vendorData.taxId || ''} onChange={handleFormChange} disabled={vendorData.sheetName !== '廠商'} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" title={vendorData.sheetName !== '廠商' ? '僅適用於「廠商」工作表' : ''}/>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">地址</label>
                        <input type="text" name="address" id="address" value={vendorData.address || ''} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                       <div className="sm:col-span-2">
                        <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">備註</label>
                         <textarea name="remarks" id="remarks" rows={2} value={vendorData.remarks || ''} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                    </div>
                     {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button type="submit" disabled={isSubmitting} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-indigo-300">
                {isSubmitting ? '儲存中...' : '儲存廠商'}
              </button>
              <button type="button" onClick={onClose} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};