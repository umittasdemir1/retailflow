import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchVisionStatus,
  fetchCatalog,
  addCatalogProduct,
  deleteCatalogProduct,
  recognizeShelf,
} from '../lib/api';

export function useVisionStatus() {
  return useQuery({
    queryKey: ['visionStatus'],
    queryFn: fetchVisionStatus,
    staleTime: 30_000,
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: ['visionCatalog'],
    queryFn: fetchCatalog,
  });
}

export function useAddCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      images,
      meta,
    }: {
      images: File[];
      meta: { productCode: string; productName: string; color: string; description: string };
    }) => addCatalogProduct(images, meta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visionCatalog'] });
    },
  });
}

export function useDeleteCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCatalogProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visionCatalog'] });
    },
  });
}

export function useRecognizeShelf() {
  return useMutation({
    mutationFn: recognizeShelf,
  });
}
