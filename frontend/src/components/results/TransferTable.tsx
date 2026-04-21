import { useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { TransferSuggestion } from '@retailflow/shared';

const COLUMNS: ColumnDef<TransferSuggestion>[] = [
  {
    id: 'urun',
    header: 'Product',
    accessorFn: (row) => row.productName,
    cell: ({ row }) => (
      <td>
        <strong>{row.original.productName}</strong>
        <small>{row.original.color} · {row.original.size}</small>
      </td>
    ),
  },
  { accessorKey: 'senderStore', header: 'Sender' },
  { accessorKey: 'receiverStore', header: 'Receiver' },
  { accessorKey: 'quantity', header: 'Quantity' },
  {
    accessorKey: 'dosDiff',
    header: 'DOS Farkı (gün)',
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      return v != null ? `${v}g` : '∞';
    },
  },
  { accessorKey: 'appliedFilter', header: 'Filter' },
  {
    accessorKey: 'isPrioritySource',
    header: 'Source',
    cell: ({ getValue }) => (getValue<boolean>() ? 'Priority' : 'Standard'),
  },
];

export function TransferTable(props: { rows: TransferSuggestion[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dosDiff', desc: true }]);

  const table = useReactTable({
    data: props.rows,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (props.rows.length === 0) {
    return <div className="rf-inline-note">Transfer results will be listed here.</div>;
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
