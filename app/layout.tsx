import type { Metadata, Viewport } from 'next';

import '../index.css';

export const metadata: Metadata = {
  title: 'Phòng Giám định - Chứng nhận - TVCI',
  description: 'Hệ thống quản lý vận hành của Phòng Giám định - Chứng nhận và Phát triển thị trường thuộc Trung tâm TVCI (IEMM); bao gồm hai phân hệ nghiệp vụ Phòng Chứng nhận (PCN) và Giám định (PGD).',
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
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var ua = navigator.userAgent || '';
                  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
                    || (navigator.maxTouchPoints > 1 && !/Windows NT|Macintosh|Linux x86/i.test(ua));
                  if (!isMobile) {
                    document.documentElement.classList.add('is-desktop');
                  } else {
                    document.documentElement.classList.add('is-mobile');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <div id="root">{children}</div>
        <div id="portrait-only-message" aria-hidden="true">
          <div className="max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
            <h2 className="text-base font-bold text-slate-800">Vui lòng xoay dọc thiết bị</h2>
            <p className="mt-2 text-xs text-slate-500">Ứng dụng TVCI Web App được tối ưu cho trải nghiệm màn hình dọc trên thiết bị di động.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
