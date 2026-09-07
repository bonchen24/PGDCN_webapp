import type { Metadata, Viewport } from 'next';

import '../index.css';

export const metadata: Metadata = {
  title: 'Phòng Giám định - Chứng nhận - TVCI',
  description: 'Hệ thống quản lý hồ sơ giám định và chứng nhận theo miền nghiệp vụ của Phòng Giám định - Chứng nhận TVCI; miền PCN là Phòng Chứng nhận.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/iemm-logo-32.png',
    apple: '/icons/iemm-logo-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#059669',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
