import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AgregarProductoPage } from './pages/AgregarProductoPage';
import { CargarExcelPage } from './pages/CargarExcelPage';
import { InventarioPage } from './pages/InventarioPage';
import { LoginPage } from './pages/LoginPage';
import { UsuariosPage } from './pages/UsuariosPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <InventarioPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cargar"
        element={
          <ProtectedRoute>
            <Layout>
              <CargarExcelPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agregar"
        element={
          <ProtectedRoute>
            <Layout>
              <AgregarProductoPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <UsuariosPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
