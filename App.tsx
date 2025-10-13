import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { VendorList } from './components/VendorList';
import { TransferForm } from './components/TransferForm';
import { AddVendorModal } from './components/AddVendorModal';
import { Vendor, TransferItem } from './types';
import { searchVendorsOnline, addVendorOnline, updateMainDataInCloud } from './services/googleSheetService';

const App: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transferList, setTransferList] = useState<TransferItem[]>(() => {
    try {
      // Detect hard reload and clear previous session data for a fresh list
      const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined);
      const isReload = nav?.type === 'reload';
      if (isReload) {
        try { sessionStorage.removeItem('transferList'); } catch {}
        return [];
      }

      const stored = sessionStorage.getItem('transferList');
      if (!stored) return [];
      const parsed = JSON.parse(stored) as TransferItem[];
      return parsed.map(item => ({
        ...item,
        amountPayable: Number(item.amountPayable) || 0,
        manualFee: Number(item.manualFee) || 0,
        actualAmount: Number(item.actualAmount) || 0,
      }));
    } catch {
      return [];
    }
  });
  const [isAddVendorModalOpen, setIsAddVendorModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const transferVendorIds = useMemo(() => new Set(transferList.map(v => v.id)), [transferList]);

  // Persist transfer list to sessionStorage (cleared when the tab/session ends)
  useEffect(() => {
    try {
      sessionStorage.setItem('transferList', JSON.stringify(transferList));
    } catch {
      // ignore write errors
    }
  }, [transferList]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term); // Keep search term in input
    if (term.length < 2) {
      setVendors([]);
      setSearchError(null);
      return;
    }
    setIsLoading(true);
    setSearchError(null);
    setVendors([]); // Clear previous results immediately
    try {
      const results = await searchVendorsOnline(term);
      setVendors(results);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("CORS")) {
         setSearchError("後端拒絕連線 (CORS)！解決方案：請確認您的 Google Apps Script 已使用提供的最新程式碼，並以「新版本」重新部署。");
      } else {
         setSearchError(`搜尋時發生錯誤: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVendorToTransfer = (vendor: Vendor) => {
    if (!transferVendorIds.has(vendor.id)) {
      setTransferList(prev => [...prev, { ...vendor, amountPayable: 0, manualFee: 0, actualAmount: 0, feeReason: '' }]);
      setDownloadUrl(null);
      setGenerateError(null);
    }
  };

  const handleRemoveVendorFromTransfer = (id: string) => {
    setTransferList(prev => prev.filter(v => v.id !== id));
  };
  
  const handleUpdateAmountPayable = useCallback((id: string, amount: string) => {
    const value = parseInt(amount, 10) || 0;
    setTransferList(prev => prev.map(v => 
      v.id === id ? { ...v, amountPayable: value, actualAmount: value - v.manualFee } : v
    ));
    setDownloadUrl(null);
    setGenerateError(null);
  }, []);
  
  const handleUpdateManualFee = useCallback((id: string, fee: string) => {
    const value = parseInt(fee, 10) || 0;
    setTransferList(prev => prev.map(v => 
      v.id === id ? { 
        ...v, 
        manualFee: value, 
        actualAmount: v.amountPayable - value,
        feeReason: value > 0 ? '' : v.feeReason 
      } : v
    ));
    setDownloadUrl(null);
    setGenerateError(null);
  }, []);

  const handleUpdateFeeReason = useCallback((id: string, reason: 'cash' | 'waived' | '') => {
    setTransferList(prev => prev.map(v =>
      v.id === id ? {
        ...v,
        feeReason: reason,
        manualFee: 0,
        actualAmount: v.amountPayable,
      } : v
    ));
    setDownloadUrl(null);
    setGenerateError(null);
  }, []);

  const handleAddVendor = async (vendorData: Omit<Vendor, 'id'>) => {
    await addVendorOnline(vendorData);
    // Automatically search for the newly added vendor to provide feedback
    handleSearch(vendorData.name);
  };

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setDownloadUrl(null);
    try {
      const itemsToUpdate = transferList.filter(item => item.amountPayable > 0 || item.manualFee > 0 || item.feeReason);
      if (itemsToUpdate.length === 0 && transferList.length > 0) {
        setGenerateError('請至少為一位廠商輸入有效的應付金額或手續費。');
        setIsGenerating(false);
        return;
      }
      const result = await updateMainDataInCloud(itemsToUpdate);
      
      // Fetch the file from the download URL
      const response = await fetch(result.downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      const blob = await response.blob();
      
      // Create a filename with the current date (YYYYMMDD)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `${dateStr}農會匯款單.xlsx`;
      
      // Create a temporary link to trigger the download with the new filename
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up the temporary link
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setDownloadUrl(result.downloadUrl); // Keep original URL for reference if needed
    } catch (error) {
      console.error("Error updating main data in cloud:", error);
      const errorMessage = error instanceof Error ? error.message : "發生未知錯誤，請檢查主控台。";
      if (errorMessage.includes("row not found in Column B")) {
        const missingTerm = errorMessage.split("'")[1] || "關鍵字";
        setGenerateError(`更新失敗：請檢查您的 "mainData" 工作表，確認 B 欄中包含 "${missingTerm}" 的儲存格。`);
      } else {
        setGenerateError(`更新失敗：${errorMessage}`);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [transferList]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 h-[calc(100vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            <div className="lg:col-span-1 h-full">
              <VendorList
                vendors={vendors}
                onAddVendorToTransfer={handleAddVendorToTransfer}
                onAddNewVendorClick={() => setIsAddVendorModalOpen(true)}
                onSearch={handleSearch}
                transferVendorIds={transferVendorIds}
                isLoading={isLoading}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchError={searchError}
              />
            </div>
            <div className="lg:col-span-2 h-full">
              <TransferForm
                transferList={transferList}
                onRemoveVendor={handleRemoveVendorFromTransfer}
                onUpdateAmountPayable={handleUpdateAmountPayable}
                onUpdateManualFee={handleUpdateManualFee}
                onUpdateFeeReason={handleUpdateFeeReason}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                generateError={generateError}
                downloadUrl={downloadUrl}
              />
            </div>
          </div>
      </main>
      <AddVendorModal
        isOpen={isAddVendorModalOpen}
        onClose={() => setIsAddVendorModalOpen(false)}
        onAddVendor={handleAddVendor}
      />
    </div>
  );
};

export default App;