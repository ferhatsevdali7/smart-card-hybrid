// Uygulama girişi: yönetim konsolu (?view=admin) ya da müşteri sitesi.
import { AdminDashboardContainer } from './components/AdminDashboardContainer';
import { CustomerApp } from './customer/CustomerApp';

export function App() {
  const isAdmin = new URLSearchParams(window.location.search).get('view') === 'admin';
  return isAdmin ? <AdminDashboardContainer /> : <CustomerApp />;
}

export default App;
