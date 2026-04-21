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
        <strong>Drop your CSV or Excel file here</strong>
        <p>Upload .csv, .xls or .xlsx inventory transfer data for retail stores.</p>
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
        {props.isUploading ? 'Uploading...' : 'Choose File'}
      </label>
      <div className="rf-upload-meta">
        <span>{props.uploadInfo?.fileName ?? 'No file yet'}</span>
        <small>
          {props.uploadInfo
            ? props.uploadInfo.storeCount + ' stores · ' + props.uploadInfo.rowCount + ' rows'
            : 'Upload data to start analysis'}
        </small>
      </div>
    </div>
  );
}
