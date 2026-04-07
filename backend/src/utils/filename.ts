const MOJIBAKE_MARKERS = /[\u0080-\u009fÃÂÄÅ]/g;

function countMojibakeMarkers(value: string): number {
  return value.match(MOJIBAKE_MARKERS)?.length ?? 0;
}

export function normalizeUploadedFileName(fileName: string): string {
  const markerCount = countMojibakeMarkers(fileName);
  if (markerCount === 0) {
    return fileName;
  }

  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  return countMojibakeMarkers(decoded) < markerCount ? decoded : fileName;
}
