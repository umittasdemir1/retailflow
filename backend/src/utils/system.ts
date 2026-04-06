import fs from 'node:fs';

export function getMemoryUsagePercent(): number {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const lines = meminfo.split('\n');
    let total = 0;
    let available = 0;

    for (const line of lines) {
      if (line.startsWith('MemTotal:')) {
        total = Number(line.split(/\s+/)[1] ?? 0);
      } else if (line.startsWith('MemAvailable:')) {
        available = Number(line.split(/\s+/)[1] ?? 0);
      }
    }

    if (total > 0 && available > 0) {
      return Number((((total - available) / total) * 100).toFixed(1));
    }
  } catch {
    // Fall through to the default value.
  }

  return 50;
}
