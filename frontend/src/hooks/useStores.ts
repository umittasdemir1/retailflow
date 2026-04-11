import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchProducts, fetchStores, fetchStrategies } from '../lib/api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15000,
  });
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: fetchStores,
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
    staleTime: 60_000,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
}
