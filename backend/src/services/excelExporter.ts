import type ExcelJSType from 'exceljs';
import type { Worksheet } from 'exceljs';
import type { AnalysisResult, TransferSuggestion } from '@retailflow/shared';

const headerFill = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF244062' },
};

const headerFont = {
  name: 'Segoe UI',
  size: 14,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const dataFont = {
  name: 'Segoe UI',
  size: 11,
};

const thinBorder = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

export async function buildExcelReport(result: AnalysisResult): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default as typeof ExcelJSType;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RetailFlow';
  workbook.created = new Date();

  buildTransfersSheet(workbook.addWorksheet(getTransfersSheetName(result)), result);
  buildSummarySheet(workbook.addWorksheet('Analiz Ozeti'), result);
  buildStoreMetricsSheet(workbook.addWorksheet('Magaza Metrikleri'), result);
  buildPerformanceSheet(workbook.addWorksheet('Performans'), result);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildTransfersSheet(sheet: Worksheet, result: AnalysisResult): void {
  const rows = result.transfers;

  if (result.analysisType === 'size_completion') {
    sheet.columns = [
      { header: 'Urun Adi', key: 'productName', width: 28 },
      { header: 'Renk', key: 'color', width: 16 },
      { header: 'Eksik Beden', key: 'size', width: 14 },
      { header: 'Gonderen Magaza', key: 'senderStore', width: 20 },
      { header: 'Gonderen Satis', key: 'senderSales', width: 14 },
      { header: 'Gonderen Envanter', key: 'senderInventory', width: 16 },
      { header: 'Hedef Magaza', key: 'receiverStore', width: 18 },
      { header: 'Alan Satis', key: 'receiverSales', width: 12 },
      { header: 'Alan Envanter', key: 'receiverInventory', width: 14 },
      { header: 'Transfer Miktari', key: 'quantity', width: 16 },
      { header: 'Oncelikli Kaynak', key: 'isPrioritySource', width: 16 },
    ];
  } else {
    sheet.columns = [
      { header: 'Urun Kodu', key: 'productCode', width: 18 },
      { header: 'Urun Adi', key: 'productName', width: 28 },
      { header: 'Renk', key: 'color', width: 16 },
      { header: 'Beden', key: 'size', width: 12 },
      { header: 'Gonderen Magaza', key: 'senderStore', width: 20 },
      { header: 'Gonderen Satis', key: 'senderSales', width: 14 },
      { header: 'Gonderen Envanter', key: 'senderInventory', width: 16 },
      { header: 'Alan Magaza', key: 'receiverStore', width: 18 },
      { header: 'Alan Satis', key: 'receiverSales', width: 12 },
      { header: 'Alan Envanter', key: 'receiverInventory', width: 14 },
      { header: 'Transfer Miktari', key: 'quantity', width: 16 },
      { header: 'STR Farki (%)', key: 'strDiff', width: 14 },
      { header: 'Gonderen STR', key: 'senderStr', width: 14 },
      { header: 'Alan STR', key: 'receiverStr', width: 12 },
      { header: 'Uygulanan Filtre', key: 'appliedFilter', width: 18 },
      { header: 'Oncelikli Kaynak', key: 'isPrioritySource', width: 16 },
    ];
  }

  if (rows.length === 0) {
    sheet.addRow({ productName: 'Hic transfer onerisi bulunamadi' });
  } else {
    for (const row of rows) {
      sheet.addRow(formatTransferRow(result.analysisType, row));
    }
  }

  styleWorksheet(sheet);
}

function buildSummarySheet(sheet: Worksheet, result: AnalysisResult): void {
  sheet.columns = [
    { header: 'Alan', key: 'label', width: 28 },
    { header: 'Deger', key: 'value', width: 42 },
  ];

  const summaryRows = [
    { label: 'Analiz Tipi', value: result.analysisType },
    { label: 'Kullanilan Strateji', value: result.strategy },
    { label: 'Hedef Magaza', value: result.targetStore ?? 'Tum Magazalar' },
    { label: 'Toplam Transfer', value: result.transfers.length },
    { label: 'Toplam Red', value: result.rejectedTransfers.length },
    { label: 'Toplam Tasinan Urun', value: result.simulation.totalItemsMoved },
    { label: 'Etkilenen Magaza', value: result.simulation.affectedStores },
    { label: 'Risk Seviyesi', value: result.simulation.riskLevel },
    { label: 'Oncelikli Transfer', value: result.simulation.priorityTransfers },
    { label: 'Dislanan Magazalar', value: result.excludedStores.length > 0 ? result.excludedStores.join(', ') : 'Yok' },
    { label: 'Olusturma Tarihi', value: new Date().toISOString() },
  ];

  sheet.addRows(summaryRows);
  styleWorksheet(sheet);
}

function buildStoreMetricsSheet(sheet: Worksheet, result: AnalysisResult): void {
  sheet.columns = [
    { header: 'Magaza', key: 'name', width: 22 },
    { header: 'Satis', key: 'totalSales', width: 12 },
    { header: 'Envanter', key: 'totalInventory', width: 12 },
    { header: 'STR %', key: 'strPercent', width: 10 },
    { header: 'Urun Sayisi', key: 'productCount', width: 12 },
    { header: 'Envanter Fazlasi', key: 'excessInventory', width: 16 },
    { header: 'Cover Days', key: 'coverDays', width: 12 },
    { header: 'Oncelikli Kaynak', key: 'isPrioritySource', width: 16 },
  ];

  sheet.addRows(result.storeMetrics.map((metric) => ({
    ...metric,
    coverDays: metric.coverDays == null ? 'N/A' : Number(metric.coverDays.toFixed(1)),
  })));

  styleWorksheet(sheet);
}

function buildPerformanceSheet(sheet: Worksheet, result: AnalysisResult): void {
  sheet.columns = [
    { header: 'Metrik', key: 'metric', width: 26 },
    { header: 'Deger', key: 'value', width: 20 },
    { header: 'Detay', key: 'detail', width: 48 },
  ];

  sheet.addRows([
    { metric: 'Islem Suresi', value: result.performance.processingTimeMs + ' ms', detail: 'Analiz motorunun toplam calisma suresi' },
    { metric: 'Toplam Urun Grubu', value: result.performance.totalProducts, detail: 'Analiz edilen benzersiz urun anahtari sayisi' },
    { metric: 'Toplam Magaza', value: result.performance.totalStores, detail: 'Analize giren magaza sayisi' },
    { metric: 'Toplam Satir', value: result.performance.totalRows, detail: 'Yuklenen ham veri satiri' },
    { metric: 'Toplam Red', value: result.performance.rejectedTransfers ?? 0, detail: 'Kosullari saglamadigi icin reddedilen transferler' },
    { metric: 'Dislanan Magaza', value: result.performance.excludedStoresCount ?? 0, detail: 'Analiz disi birakilan magaza sayisi' },
  ]);

  styleWorksheet(sheet);
}

function formatTransferRow(analysisType: AnalysisResult['analysisType'], row: TransferSuggestion) {
  if (analysisType === 'size_completion') {
    return {
      ...row,
      isPrioritySource: row.isPrioritySource ? 'Evet' : 'Hayir',
    };
  }

  return {
    ...row,
    isPrioritySource: row.isPrioritySource ? 'Evet' : 'Hayir',
  };
}

function styleWorksheet(sheet: Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    row.eachCell((cell) => {
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
    });
  });

  for (let i = 1; i <= sheet.columnCount; i += 1) {
    const column = sheet.getColumn(i);
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value);
      if (value.length > maxLength) {
        maxLength = value.length;
      }
    });
    column.width = Math.min(maxLength + 2, 48);
  }
}

function getTransfersSheetName(result: AnalysisResult): string {
  if (result.analysisType === 'size_completion') {
    return (result.targetStore ? result.targetStore + ' Beden Tamamlama' : 'Beden Tamamlama').slice(0, 31);
  }

  if (result.analysisType === 'targeted') {
    return (result.targetStore ? result.targetStore + ' Transferleri' : 'Targeted Transfer').slice(0, 31);
  }

  return 'Transfer Onerileri';
}
