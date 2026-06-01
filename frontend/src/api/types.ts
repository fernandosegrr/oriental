export type Proveedor = 'LEON' | 'DILLAMA';
export type Rol = 'admin' | 'operador';
export type Origen = 'excel' | 'manual';

export interface Producto {
  id: number;
  proveedor: Proveedor;
  descripcion: string;
  medida: string | null;
  medida_norm?: string | null;
  marca: string | null;
  modelo: string | null;
  specs: string | null;
  stock: number;
  precio_costo: number;
  precio_venta: number;
  origen: Origen;
  activo: boolean;
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

/** Authenticated user as returned by /auth/me and /auth/login. */
export interface AuthUser {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface InventoryFilters {
  medida?: string;
  marca?: string;
  proveedor?: Proveedor | '';
  conStock?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryResponse {
  items: Producto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadStats {
  total: number;
  conMedida: number;
  sinMedida: number;
  hojaUsada: string;
  hojasDisponibles: string[];
}

export interface UploadResult {
  stats: UploadStats;
  sample?: Producto[];
}

export interface CreateProductoInput {
  proveedor: Proveedor;
  descripcion?: string;
  medida?: string;
  marca?: string;
  modelo?: string;
  specs?: string;
  stock: number;
  precio_costo: number;
}

export type UpdateProductoInput = Partial<{
  proveedor: Proveedor;
  descripcion: string;
  medida: string;
  marca: string;
  modelo: string;
  specs: string;
  stock: number;
  precio_costo: number;
}>;

export interface CreateUsuarioInput {
  email: string;
  nombre: string;
  password: string;
  rol: Rol;
}

export type UpdateUsuarioInput = Partial<{
  nombre: string;
  rol: Rol;
  activo: boolean;
  password: string;
}>;
