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
    header: 'Urun',
    accessorFn: (row) => row.productName,
    cell: ({ row }) => (
      <td>
        <strong>{row.original.productName}</strong>
        <small>{row.original.color} · {row.original.size}</small>
      </td>
    ),
  },
  { accessorKey: 'senderStore', header: 'Gonderen' },
  { accessorKey: 'receiverStore', header: 'Alan' },
  { accessorKey: 'quantity', header: 'Miktar' },
  {
    accessorKey: 'strDiff',
    header: 'STR fark',
    cell: ({ getValue }) => String(getValue<number>()) + '%',
  },
  { accessorKey: 'appliedFilter', header: 'Filtre' },
  {
    accessorKey: 'isPrioritySource',
    header: 'Kaynak',
    cell: ({ getValue }) => (getValue<boolean>() ? 'Oncelikli' : 'Standart'),
  },
];

export function TransferTable(props: { rows: TransferSuggestion[] }) {
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
    return <div className="rf-inline-note">Transfer sonuclari burada listelenecek.</div>;
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
