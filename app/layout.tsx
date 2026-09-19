import type { Metadata, Viewport } from 'next';

import '../index.css';

export const metadata: Metadata = {
  title: 'Phòng Giám định - Chứng nhận và Phát triển thị trường - TVCI',
  description: 'Hệ thống quản lý vận hành của Phòng Giám định - Chứng nhận và Phát triển thị trường thuộc Trung tâm TVCI (IEMM); bao gồm hai phân hệ nghiệp vụ Chứng nhận (PCN) và Giám định (PGD).',
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
