import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSeries, createSeries, updateSeries, deleteSeries,
  fetchAssortmentRules, createAssortmentRule, deleteAssortmentRule,
  fetchAllocations, createAllocation, updateAllocation, deleteAllocation, bulkUpsertAllocations,
} from '../lib/api';
import type { Series, AssortmentRule, StoreAllocation } from '../lib/api';

export type { Series, AssortmentRule, StoreAllocation };

export function useSeries() {
  return useQuery({ queryKey: ['series'], queryFn: fetchSeries });
}

export function useSeriesMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['series'] });

  const add = useMutation({ mutationFn: createSeries, onSuccess: inv });
  const update = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; sizes: Record<string, number> }> }) => updateSeries(id, data), onSuccess: inv });
  const remove = useMutation({ mutationFn: deleteSeries, onSuccess: inv });

  return { add, update, remove };
}

export function useAssortmentRules() {
  return useQuery({ queryKey: ['assortment'], queryFn: fetchAssortmentRules });
}

export function useAssortmentMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['assortment'] });

  const add = useMutation({ mutationFn: createAssortmentRule, onSuccess: inv });
  const remove = useMutation({ mutationFn: deleteAssortmentRule, onSuccess: inv });

  return { add, remove };
}

export function useAllocations() {
  return useQuery({ queryKey: ['allocations'], queryFn: fetchAllocations });
}

export function useAllocationMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['allocations'] });

  const add = useMutation({ mutationFn: createAllocation, onSuccess: inv });
  const update = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>> }) => updateAllocation(id, data), onSuccess: inv });
  const remove = useMutation({ mutationFn: deleteAllocation, onSuccess: inv });
  const bulkUpsert = useMutation({ mutationFn: bulkUpsertAllocations, onSuccess: inv });

  return { add, update, remove, bulkUpsert };
}
