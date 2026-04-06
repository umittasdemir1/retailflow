import { useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { RejectedTransfer } from '@retailflow/shared';

const COLUMNS: ColumnDef<RejectedTransfer>[] = [
  {
    id: 'urun',
    header: 'Urun',
    accessorFn: (row) => row.productName,
    cell: ({ row }) => (
      <td>
        <strong>{row.original.productName}</strong>
        <small>{row.original.color} · {row.original.size}</small>
      </td>
    ),
  },
  { accessorKey: 'storeCount', header: 'Magaza sayisi' },
  {
    accessorKey: 'strDiff',
    header: 'STR fark',
    cell: ({ getValue }) => String(getValue<number>()) + '%',
  },
  { accessorKey: 'reason', header: 'Neden' },
];

export function RejectedTable(props: { rows: RejectedTransfer[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'strDiff', desc: true }]);

  const table = useReactTable({
    data: props.rows,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (props.rows.length === 0) {
    return <div className="rf-inline-note">Red edilen urun bulunmuyor.</div>;
  }

  return (
    <div className="rf-table-wrap">
      <table className="rf-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
