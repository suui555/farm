const SHEET_ID = "1ok8-2vnj9wrq4sAsenyx6ZiYLrs66018z5YotC1zsX0";
const MAIN_DATA_SHEET_NAME = "mainData";

// 快取機制 - 使用 PropertiesService 來快取銀行資料
const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘快取
const BANK_DATA_CACHE_KEY = 'bank_data_cache';
const BANK_DATA_TIMESTAMP_KEY = 'bank_data_timestamp';

// Handle the main POST request（純 ContentService 避 CORS）
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;
    let result;

    switch (action) {
      case 'search':
        result = searchVendor(payload.searchTerm);
        break;
      case 'searchBank':
        result = searchBank(payload.searchTerm);
        break;
      case 'add':
        result = addVendor(payload.vendorData);
        break;
      case 'addBankCode':
        result = addBankCode(payload.bankName, payload.bankCode);
        break;
      case 'updateMainData':
        result = updateMainData(payload.items);
        break;
      default:
        throw new Error("Invalid action specified.");
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log(error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional: Simple GET for testing
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ message: 'API is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function searchVendor(searchTerm) {
  if (!searchTerm || searchTerm.trim().length < 2) { return []; }
  
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const allSheets = spreadsheet.getSheets();
  const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
  const results = [];

  // 預先過濾相關的工作表，避免搜尋不需要的工作表
  const relevantSheets = allSheets.filter(sheet => {
    const sheetName = sheet.getName();
    return sheetName !== MAIN_DATA_SHEET_NAME && 
           sheetName !== '銀行代碼' && 
           sheetName !== 'mainData';
  });

  relevantSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    
    // 只取需要的欄位，減少記憶體使用
    const rows = data.slice(1);
    const maxResults = 20; // 限制每個工作表的結果數量
    
    rows.forEach((row, rowIndex) => {
      if (results.length >= 50) return; // 總結果限制
      
      const name = String(row[0] || '').trim();
      if (name.toLowerCase().includes(lowerCaseSearchTerm)) {
        const uniqueId = `${sheetName}_${rowIndex + 2}`;
        const isVendorSheet = sheetName === '廠商';
        
        // 計算匹配分數（完全匹配分數更高）
        const matchScore = name.toLowerCase() === lowerCaseSearchTerm ? 100 : 
                          name.toLowerCase().startsWith(lowerCaseSearchTerm) ? 80 : 60;
        
        results.push({
          id: uniqueId,
          name: name,
          bank: String(row[1] || ''),
          bankCode: String(row[2] || ''),
          accountNumber: String(row[3] || ''),
          taxId: isVendorSheet ? String(row[4] || '') : '',
          address: String(row[isVendorSheet ? 5 : 4] || ''),
          remarks: String(row[isVendorSheet ? 6 : 5] || ''),
          sheetName: sheetName,
          matchScore: matchScore
        });
      }
    });
  });
  
  // 按匹配分數排序，完全匹配的結果優先顯示
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  // 移除 matchScore 屬性，只回傳需要的資料
  return results.slice(0, 30).map(result => {
    const { matchScore, ...cleanResult } = result;
    return cleanResult;
  });
}

function searchBank(searchTerm) {
  if (!searchTerm || searchTerm.trim().length < 2) { 
    return []; 
  }
  
  // 嘗試從快取中獲取資料
  let data = getCachedBankData();
  
  if (!data) {
    // 快取未命中，從工作表載入資料
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName('銀行代碼');
    if (!sheet) { 
      throw new Error('Sheet "銀行代碼" not found.'); 
    }
    
    const rawData = sheet.getDataRange().getValues();
    if (rawData.length <= 1) { 
      return []; 
    }
    
    // 處理並快取資料
    data = rawData.slice(1).map(row => ({
      bankCodeRaw: String(row[0] || ''),
      branchCodeRaw: String(row[1] || ''),
      bankName: String(row[2] || '').trim(),
      branchName: String(row[3] || '').trim()
    }));
    
    setCachedBankData(data);
  }
  
  // 正規化搜尋詞：台→臺，移除常見的銀行後綴詞
  let normalizedSearchTerm = searchTerm
    .replace(/台/g, '臺')
    .replace(/商業銀行/g, '')
    .replace(/銀行/g, '')
    .toLowerCase()
    .trim();
  
  // 分詞：以空白分隔，過濾空字串
  const searchKeywords = normalizedSearchTerm.split(/\s+/).filter(kw => kw.length > 0);
  
  const exactMatches = []; // 完全匹配的結果
  const partialMatches = []; // 部分匹配的結果
  
  // 遍歷快取的資料
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const bankCodeRaw = row.bankCodeRaw;
    const branchCodeRaw = row.branchCodeRaw;
    const bankName = row.bankName;
    const branchName = row.branchName;
    
    if (!bankName) continue; // 跳過空的銀行名稱
    
    const bankCode = bankCodeRaw.padStart(3, '0');
    const branchCode = branchCodeRaw.padStart(4, '0');
    const fullCode = bankCode + branchCode;
    const fullName = branchName ? `${bankName}${branchName}` : bankName;
    
    // 正規化資料庫中的名稱
    const normalizedBankName = bankName
      .replace(/台/g, '臺')
      .replace(/商業銀行/g, '')
      .replace(/銀行/g, '')
      .toLowerCase();
    
    const normalizedBranchName = branchName
      .replace(/台/g, '臺')
      .toLowerCase();
    
    const normalizedFullName = fullName
      .replace(/台/g, '臺')
      .replace(/商業銀行/g, '')
      .replace(/銀行/g, '')
      .toLowerCase();
    
    // 檢查完全匹配（銀行名稱開頭匹配）
    if (normalizedBankName.startsWith(normalizedSearchTerm) || 
        normalizedFullName.startsWith(normalizedSearchTerm)) {
      exactMatches.push({
        fullName: fullName,
        fullCode: fullCode,
        matchType: 'exact'
      });
      continue;
    }
    
    // 檢查部分匹配：所有關鍵字都要在銀行名稱、分行名稱或完整名稱中找到
    const matches = searchKeywords.every(kw => 
      normalizedBankName.includes(kw) || 
      normalizedBranchName.includes(kw) || 
      normalizedFullName.includes(kw)
    );
    
    if (matches) {
      partialMatches.push({
        fullName: fullName,
        fullCode: fullCode,
        matchType: 'partial'
      });
    }
    
    // 限制結果數量以提高效能
    if (exactMatches.length + partialMatches.length >= 30) {
      break;
    }
  }
  
  // 合併結果：完全匹配優先，然後是部分匹配
  const allResults = [...exactMatches, ...partialMatches];
  
  return allResults.slice(0, 25).map(result => ({
    fullName: result.fullName,
    fullCode: result.fullCode
  }));
}

function addVendor(vendorData) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const targetSheetName = vendorData.sheetName || '廠商';
  const sheet = spreadsheet.getSheetByName(targetSheetName);
  if (!sheet) {
    throw new Error(`Target sheet "${targetSheetName}" not found.`);
  }
  const isVendorSheet = targetSheetName === '廠商';
  const newRow = [
    vendorData.name,  // A: 名稱
    vendorData.bank,  // B: 銀行
    vendorData.bankCode,  // C: 銀行代碼
    vendorData.accountNumber,  // D: 帳號
  ];
  if (isVendorSheet) {
    newRow.push(vendorData.taxId || '');  // E: 統編
    newRow.push(vendorData.address || '');  // F: 地址
    newRow.push(vendorData.remarks || '');  // G: 備註
  } else {
    newRow.push(vendorData.address || '');  // E: 地址
    newRow.push(vendorData.remarks || '');  // F: 備註
  }
  sheet.appendRow(newRow);
  return { status: `Vendor added successfully to sheet "${targetSheetName}".` };
}

// 快取銀行資料
function getCachedBankData() {
  const properties = PropertiesService.getScriptProperties();
  const cachedData = properties.getProperty(BANK_DATA_CACHE_KEY);
  const timestamp = properties.getProperty(BANK_DATA_TIMESTAMP_KEY);
  
  if (!cachedData || !timestamp) {
    return null;
  }
  
  const now = new Date().getTime();
  const cacheTime = parseInt(timestamp);
  
  if (now - cacheTime > CACHE_DURATION) {
    // 快取過期，清除快取
    properties.deleteProperty(BANK_DATA_CACHE_KEY);
    properties.deleteProperty(BANK_DATA_TIMESTAMP_KEY);
    return null;
  }
  
  return JSON.parse(cachedData);
}

// 儲存銀行資料到快取
function setCachedBankData(data) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(BANK_DATA_CACHE_KEY, JSON.stringify(data));
  properties.setProperty(BANK_DATA_TIMESTAMP_KEY, new Date().getTime().toString());
}

// 新增銀行代碼到「銀行代碼」工作表
function addBankCode(bankName, bankCode) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName('銀行代碼');
  if (!sheet) {
    throw new Error('Sheet "銀行代碼" not found.');
  }
  
  // 檢查是否已存在相同的銀行名稱和代碼
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const existingBankName = String(row[2] || '').trim();
    const existingBankCode = String(row[0] || '').trim();
    
    if (existingBankName === bankName && existingBankCode === bankCode) {
      return { status: `Bank code "${bankName}" (${bankCode}) already exists.` };
    }
  }
  
  // 解析銀行代碼：假設完整代碼是7位數（3位銀行代碼 + 4位分行代碼）
  const bankCodeStr = bankCode.toString().padStart(7, '0');
  const bankCodePart = bankCodeStr.substring(0, 3);
  const branchCodePart = bankCodeStr.substring(3, 7);
  
  // 新增到銀行代碼工作表
  // 格式：A: 銀行代碼, B: 分行代碼, C: 銀行名稱, D: 分行名稱
  const newRow = [
    bankCodePart,  // A: 銀行代碼
    branchCodePart,  // B: 分行代碼
    bankName,  // C: 銀行名稱
    ''  // D: 分行名稱（空字串，因為是手動輸入的銀行）
  ];
  
  sheet.appendRow(newRow);
  
  // 清除快取，強制下次重新載入資料
  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty(BANK_DATA_CACHE_KEY);
  properties.deleteProperty(BANK_DATA_TIMESTAMP_KEY);
  
  return { status: `Bank code "${bankName}" (${bankCode}) added successfully.` };
}

// 定位 B 欄文字行
function findRowIndex(sheet, searchText, column) {
  const data = sheet.getRange(1, column, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim().includes(searchText.trim())) {
      return i + 1;
    }
  }
  return -1;
}

// 更新 mainData：清舊 + 插入/刪除行調整 + 寫新 + 動態公式
function updateMainData(items) {
  if (!Array.isArray(items)) { 
    throw new Error("Payload must be an array of items."); 
  }
  const validItems = items.filter(item => (item.amountPayable || 0) > 0 || (item.manualFee || 0) > 0 || item.feeReason);
  if (validItems.length === 0) {
    throw new Error("No valid items with payable or fee > 0 or feeReason.");
  }
  if (validItems.some(item => typeof item.amountPayable !== 'number' || typeof item.manualFee !== 'number')) {
    throw new Error("Each item must have valid amountPayable and manualFee (numbers).");
  }
  
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(MAIN_DATA_SHEET_NAME);
  if (!sheet) { 
    throw new Error(`Sheet "${MAIN_DATA_SHEET_NAME}" not found.`); 
  }

  let subtotalRow = findRowIndex(sheet, "小計", 2);
  if (subtotalRow === -1) { 
    throw new Error("'小計' row not found in Column B."); 
  }
  
  let feeRow = findRowIndex(sheet, "手續費", 2);
  if (feeRow === -1) { 
    throw new Error("'手續費' row not found in Column B."); 
  }
  
  let totalRow = findRowIndex(sheet, "合計", 2);
  if (totalRow === -1) { 
    throw new Error("'合計' row not found in Column B."); 
  }
  
  const dataStartRow = 2;
  let originalDataRows = subtotalRow - dataStartRow;
  let numToInsert = Math.max(0, validItems.length - originalDataRows);
  let numToDelete = Math.max(0, originalDataRows - validItems.length);

  // 1. 先處理縮減：刪多餘行
  if (numToDelete > 0) {
    const dataEndRow = subtotalRow - 1;
    const rowsToDeleteStart = dataEndRow - numToDelete + 1;
    sheet.deleteRows(rowsToDeleteStart, numToDelete);
    subtotalRow -= numToDelete;
    feeRow -= numToDelete;
    totalRow -= numToDelete;
  }

  // 2. 再處理擴展：插入行
  if (numToInsert > 0) {
    sheet.insertRowsBefore(subtotalRow, numToInsert);
    subtotalRow += numToInsert;
    feeRow += numToInsert;
    totalRow += numToInsert;
  }

  // 3. 清舊廠商資料範圍 (擴展到6欄以包含F欄原因)
  const dataEndRow = subtotalRow - 1;
  if (dataEndRow >= dataStartRow) {
    sheet.getRange(dataStartRow, 1, dataEndRow - dataStartRow + 1, 6).clearContent();
  }

  // 4. 寫新資料
  let lastDataRow = dataStartRow - 1;
  if (validItems.length > 0) {
    const newRows = validItems.map(item => {
      const actualAmount = item.amountPayable - item.manualFee;
      let feeReasonText = '';
      if (item.feeReason === 'cash') {
        feeReasonText = '現金手續費';
      } else if (item.feeReason === 'waived') {
        feeReasonText = '免手續費';
      }
      return [
        item.bankCode,  // A
        `'${item.accountNumber}`,  // B
        actualAmount,  // C
        item.name,  // D: 中文備註
        item.bank,  // E: 銀行
        feeReasonText  // F: 原因 (若有)
      ];
    });
    sheet.getRange(dataStartRow, 1, newRows.length, 6).setValues(newRows);
    lastDataRow = dataStartRow + newRows.length - 1;

    // 5. 設定F欄紅色字體 (僅對有原因的行)
    validItems.forEach((item, index) => {
      if (item.feeReason) {
        const rowNum = dataStartRow + index;
        const range = sheet.getRange(rowNum, 6);  // F欄
        range.setFontColor('#FF0000');  // 紅色
      }
    });
  }
  
  // 6. 更新公式與摘要
  const subtotalFormula = lastDataRow < dataStartRow ? 0 : `=SUM(C${dataStartRow}:C${lastDataRow})`;
  sheet.getRange(subtotalRow, 3).setValue(subtotalFormula);
  
  const feeCount = validItems.filter(i => i.manualFee > 0).length;
  const totalFee = validItems.reduce((sum, i) => sum + i.manualFee, 0);
  sheet.getRange(feeRow, 2).setValue(feeCount > 0 ? `${feeCount}筆手續費` : "手續費");
  sheet.getRange(feeRow, 3).setValue(totalFee);
  
  sheet.getRange(totalRow, 3).setFormula(`=C${subtotalRow} + C${feeRow}`);

  SpreadsheetApp.flush();

  const sheetGid = sheet.getSheetId();
  const downloadUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${sheetGid}`;
  
  return { 
    status: `Successfully updated ${validItems.length} items in '${MAIN_DATA_SHEET_NAME}'.`,
    downloadUrl: downloadUrl 
  };
}
