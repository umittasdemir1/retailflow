import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchVisionStatus,
  fetchCatalog,
  addCatalogProduct,
  addCatalogProductFromCdn,
  updateCatalogProduct,
  deleteCatalogProduct,
  recognizeShelf,
  type VisionProvider,
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
      meta: { productCode: string; productName: string; color: string; description: string; provider?: VisionProvider };
    }) => addCatalogProduct(images, meta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visionCatalog'] });
    },
  });
}

export function useAddCatalogProductFromCdn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meta: {
      productCode: string; colorCode: string;
      productName: string; color: string; description: string;
      provider?: VisionProvider;
    }) => addCatalogProductFromCdn(meta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visionCatalog'] });
    },
  });
}

export function useUpdateCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, meta }: { id: string; meta: { productCode?: string; productName?: string; color?: string; description?: string } }) =>
      updateCatalogProduct(id, meta),
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
    mutationFn: ({ image, provider }: { image: File; provider: VisionProvider }) => recognizeShelf(image, provider),
  });
}
