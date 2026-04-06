import { useMutation, useQueryClient } from '@tanstack/react-query';
import { analyzeInventory, simulateCurrentAnalysis } from '../lib/api';

export function useAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analyzeInventory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useSimulate() {
  return useMutation({ mutationFn: simulateCurrentAnalysis });
}
