import { useState } from 'react';
import type { UploadResult } from '@retailflow/shared';
import fileIcon from '../../assets/icons/3dfilesicon.svg';

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
        <strong>CSV veya Excel dosyasını buraya bırak</strong>
        <p>Tekstil mağazaları arası stok transfer verisi için .csv, .xls veya .xlsx yükleyebilirsin.</p>
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
        <img src={fileIcon} alt="" width={18} height={18} style={{ flexShrink: 0 }} />
        {props.isUploading ? 'Yükleniyor...' : 'Dosya Seç'}
      </label>
      <div className="rf-upload-meta">
        <span>{props.uploadInfo?.fileName ?? 'Henüz dosya yok'}</span>
        <small>
          {props.uploadInfo
            ? props.uploadInfo.storeCount + ' mağaza · ' + props.uploadInfo.rowCount + ' satır'
            : 'Analiz için önce veri yükleyin'}
        </small>
      </div>
    </div>
  );
}
