import { useMutation } from '@tanstack/react-query';
import { exportExcel, resetData } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function useExport() {
  return useMutation({ mutationFn: exportExcel });
}

export function useReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
