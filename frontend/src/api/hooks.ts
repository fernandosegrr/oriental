import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  CreateProductoInput,
  CreateUsuarioInput,
  InventoryFilters,
  InventoryResponse,
  Producto,
  Proveedor,
  UpdateProductoInput,
  UpdateUsuarioInput,
  UploadResult,
  Usuario,
} from './types';

const INVENTORY_KEY = 'inventory';
const USERS_KEY = 'users';

/* ------------------------------- Inventory ------------------------------- */

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: [INVENTORY_KEY, filters],
    queryFn: async (): Promise<InventoryResponse> => {
      const params: Record<string, string | number | boolean> = {};
      if (filters.medida) params.medida = filters.medida;
      if (filters.marca) params.marca = filters.marca;
      if (filters.conStock) params.conStock = true;
      if (filters.q) params.q = filters.q;
      if (filters.page) params.page = filters.page;
      if (filters.pageSize) params.pageSize = filters.pageSize;
      const { data } = await api.get<InventoryResponse>('/inventory', { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductoInput): Promise<Producto> => {
      const { data } = await api.post<{ producto: Producto }>('/inventory', input);
      return data.producto;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [INVENTORY_KEY] });
    },
  });
}

export function useUpdateProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: number;
      input: UpdateProductoInput;
    }): Promise<Producto> => {
      const { data } = await api.put<{ producto: Producto }>(
        `/inventory/${vars.id}`,
        vars.input,
      );
      return data.producto;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [INVENTORY_KEY] });
    },
  });
}

export function useDeleteProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/inventory/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [INVENTORY_KEY] });
    },
  });
}

export function useUploadExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      file: File;
      proveedor: Proveedor;
      dryRun: boolean;
    }): Promise<UploadResult> => {
      const form = new FormData();
      form.append('file', vars.file);
      form.append('proveedor', vars.proveedor);
      const { data } = await api.post<UploadResult>('/inventory/upload', form, {
        params: vars.dryRun ? { dryRun: true } : undefined,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      // Only a real (non-dry-run) upload mutates the inventory.
      if (!vars.dryRun) {
        void qc.invalidateQueries({ queryKey: [INVENTORY_KEY] });
      }
    },
  });
}

/* -------------------------------- Usuarios ------------------------------- */

export function useUsuarios() {
  return useQuery({
    queryKey: [USERS_KEY],
    queryFn: async (): Promise<Usuario[]> => {
      const { data } = await api.get<{ users: Usuario[] }>('/users');
      return data.users;
    },
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUsuarioInput): Promise<Usuario> => {
      const { data } = await api.post<{ user: Usuario }>('/users', input);
      return data.user;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: number;
      input: UpdateUsuarioInput;
    }): Promise<Usuario> => {
      const { data } = await api.put<{ user: Usuario }>(
        `/users/${vars.id}`,
        vars.input,
      );
      return data.user;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}
