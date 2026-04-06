import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadInventoryFile } from '../lib/api';

export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadInventoryFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}
