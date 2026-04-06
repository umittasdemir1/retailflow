import { useState } from 'react';
import type { UploadResult } from '@retailflow/shared';

export function UploadZone(props: { isUploading: boolean; uploadInfo: UploadResult | null; onFileSelect: (file: File) => void }) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div
      className={dragActive ? 'rf-upload-zone is-dragging' : 'rf-upload-zone'}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) props.onFileSelect(file);
      }}
    >
      <div>
        <strong>CSV veya Excel dosyasini buraya birak</strong>
        <p>Tekstil magazalari arasi stok transfer verisi icin .csv, .xls veya .xlsx yukleyebilirsin.</p>
      </div>
      <label className="rf-upload-button">
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onFileSelect(file);
          }}
        />
        {props.isUploading ? 'Yukleniyor...' : 'Dosya Sec'}
      </label>
      <div className="rf-upload-meta">
        <span>{props.uploadInfo?.fileName ?? 'Henuz dosya yok'}</span>
        <small>
          {props.uploadInfo
            ? props.uploadInfo.storeCount + ' magaza · ' + props.uploadInfo.rowCount + ' satir'
            : 'Analiz icin once veri yukleyin'}
        </small>
      </div>
    </div>
  );
}
