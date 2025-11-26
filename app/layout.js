import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/toast';
import { NavBar } from '@/components/auth/NavBar';

export const metadata = {
  title: 'CivicLens',
  description: 'Community issue reporting platform'
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <AuthProvider>
          <ToastProvider>
            <div className="max-w-5xl mx-auto p-4">
              <NavBar />
              {children}
            </div>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
