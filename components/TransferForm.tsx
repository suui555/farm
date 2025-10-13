import React from 'react';
import { TransferItem } from '../types';
import { TrashIcon } from './icons/TrashIcon';

interface TransferFormProps {
  transferList: TransferItem[];
  onRemoveVendor: (id: string) => void;
  onUpdateAmountPayable: (id: string, amount: string) => void;
  onUpdateManualFee: (id: string, fee: string) => void;
  onUpdateFeeReason: (id: string, reason: 'cash' | 'waived' | '') => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generateError: string | null;
  downloadUrl: string | null;
}

export const TransferForm: React.FC<TransferFormProps> = ({
  transferList,
  onRemoveVendor,
  onUpdateAmountPayable,
  onUpdateManualFee,
  onUpdateFeeReason,
  onGenerate,
  isGenerating,
  generateError,
  downloadUrl,
}) => {
  const totalPayable = transferList.reduce((sum, item) => sum + (item.amountPayable || 0), 0);
  const totalFee = transferList.reduce((sum, item) => sum + (item.manualFee || 0), 0);
  const totalActual = transferList.reduce((sum, item) => sum + (item.actualAmount || 0), 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">待匯款清單</h2>
      <div className="flex-grow overflow-y-auto -mx-2 pr-2">
        {transferList.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center px-4">從左側廠商資料庫中<br/>加入廠商以建立匯款單。</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {transferList.map((item) => (
              <li key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm group relative">
                 <button
                  onClick={() => onRemoveVendor(item.id)}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label={`移除 ${item.name}`}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>

                <div className="grid grid-cols-12 gap-y-3 sm:gap-x-4 items-start">
                  {/* Vendor Info */}
                  <div className="col-span-12 sm:col-span-5 pr-6">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.bank} ({item.bankCode})</p>
                    <p className="text-xs text-gray-500">帳號: {item.accountNumber}</p>
                  </div>

                  {/* Amount Payable */}
                  <div className="col-span-6 sm:col-span-2">
                    <label htmlFor={`amount-${item.id}`} className="block text-sm font-medium text-gray-700">應付金額</label>
                    <input
                      type="number"
                      id={`amount-${item.id}`}
                      value={item.amountPayable || ''}
                      onChange={(e) => onUpdateAmountPayable(item.id, e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  {/* Fee */}
                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor={`fee-${item.id}`} className="block text-sm font-medium text-gray-700">手續費</label>
                     <input
                          type="number"
                          id={`fee-${item.id}`}
                          value={item.manualFee || ''}
                          onChange={(e) => onUpdateManualFee(item.id, e.target.value)}
                          disabled={!!item.feeReason}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="0"
                          min="0"
                        />
                    <fieldset className="mt-2">
                      <legend className="sr-only">手續費選項</legend>
                      <div className="flex items-center space-x-3">
                          <div className="flex items-center">
                              <input id={`fee-none-${item.id}`} name={`fee-reason-${item.id}`} type="radio" checked={!item.feeReason} onChange={() => onUpdateFeeReason(item.id, '')} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                              <label htmlFor={`fee-none-${item.id}`} className="ml-1.5 block text-xs text-gray-800">內扣</label>
                          </div>
                          <div className="flex items-center">
                              <input id={`fee-cash-${item.id}`} name={`fee-reason-${item.id}`} type="radio" checked={item.feeReason === 'cash'} onChange={() => onUpdateFeeReason(item.id, 'cash')} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                              <label htmlFor={`fee-cash-${item.id}`} className="ml-1.5 block text-xs text-gray-800">現金</label>
                          </div>
                          <div className="flex items-center">
                              <input id={`fee-waived-${item.id}`} name={`fee-reason-${item.id}`} type="radio" checked={item.feeReason === 'waived'} onChange={() => onUpdateFeeReason(item.id, 'waived')} className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                              <label htmlFor={`fee-waived-${item.id}`} className="ml-1.5 block text-xs text-gray-800">免收</label>
                          </div>
                      </div>
                    </fieldset>
                  </div>
                  
                  {/* Actual Amount */}
                   <div className="col-span-12 sm:col-span-2 sm:text-right">
                       <label className="block text-sm font-medium text-gray-700">實付金額</label>
                       <p className="text-xl font-bold text-indigo-600 mt-1 sm:mt-2">{item.actualAmount.toLocaleString()}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {transferList.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="space-y-2 text-right mb-4">
            <p className="text-sm text-gray-600">應付總額: <span className="font-medium">{totalPayable.toLocaleString()}</span> 元</p>
            <p className="text-sm text-gray-600">手續費總額: <span className="font-medium">{totalFee.toLocaleString()}</span> 元</p>
            <p className="text-lg font-semibold text-gray-800">匯款總額: <span className="text-indigo-600">{totalActual.toLocaleString()}</span> 元</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onGenerate}
              disabled={isGenerating || transferList.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? '產生中...' : '產生匯款單'}
            </button>
            {generateError && (
              <p className="text-sm text-red-600 text-center max-w-md">{generateError}</p>
            )}
            {downloadUrl && !generateError && (
              <div className="text-center p-3 bg-green-50 border border-green-200 rounded-md w-full max-w-md">
                <p className="text-sm font-medium text-green-800">
                  匯款單已成功產生並開始下載。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};