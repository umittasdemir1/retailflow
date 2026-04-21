import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchVisionStatus,
  fetchCatalog,
  addCatalogProduct,
  addCatalogProductFromCdn,
  updateCatalogProduct,
  deleteCatalogProduct,
  recognizeShelf,
  fetchCalibrations,
  saveCalibration,
  deleteCalibration,
  type VisionProvider,
  type StoreCalibration,
  type CalibrationRect,
  type CalibrationDot,
} from '../lib/api';

export type { StoreCalibration, CalibrationRect, CalibrationDot };

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
      meta: { productCode: string; productName: string; color: string; provider?: VisionProvider };
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
      productName: string; color: string;
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
    mutationFn: ({ id, meta }: { id: string; meta: { productCode?: string; productName?: string; color?: string } }) =>
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
    mutationFn: ({
      image,
      provider,
      calibrationId,
      catalogProductIds,
    }: {
      image: File;
      provider: VisionProvider;
      calibrationId?: string;
      catalogProductIds?: string[];
    }) => recognizeShelf(image, provider, calibrationId, catalogProductIds),
  });
}

export function useCalibrations() {
  return useQuery({
    queryKey: ['calibrations'],
    queryFn: fetchCalibrations,
  });
}

export function useSaveCalibration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storeName,
      data,
      image,
    }: {
      storeName: string;
      data: Omit<StoreCalibration, 'id' | 'storeName' | 'createdAt' | 'updatedAt'>;
      image?: File;
    }) => saveCalibration(storeName, data, image),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
    },
  });
}

export function useDeleteCalibration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCalibration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
    },
  });
}
