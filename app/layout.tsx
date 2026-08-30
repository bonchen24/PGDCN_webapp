import type { Metadata, Viewport } from 'next';

import '../index.css';

export const metadata: Metadata = {
  title: 'Phòng Chứng nhận - TVCI',
  description: 'Hệ thống quản lý Đề nghị, bộ hồ sơ và tài liệu chứng nhận theo Lĩnh vực của Phòng Chứng nhận TVCI.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/iemm-logo-32.png',
    apple: '/icons/iemm-logo-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
